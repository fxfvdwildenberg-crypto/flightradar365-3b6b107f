import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Download, FileText, Plane } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AIRPORTS } from "@/lib/world";
import { AIRCRAFT_TYPES, aircraftInfo } from "@/lib/aircraft";
import { AIRLINES } from "@/lib/aircraft";
import { buildFpl, typeDesignator, validateFpl, type FplInput } from "@/lib/fpl";
import { announceFlightPlan } from "@/lib/discord.functions";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function localInput(offsetMinutes: number) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FlightPlanDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("form");
  const [form, setForm] = useState({
    callsign: "",
    airline: "",
    aircraft: "Airbus A320",
    aircraft_icao: "A320",
    registration: "",
    flight_rules: "IFR" as "IFR" | "VFR",
    flight_type: "S",
    dep_icao: "IRFD",
    arr_icao: "IPPH",
    alternate_icao: "",
    dep_time: localInput(10),
    arr_time: localInput(45),
    cruise_fl: "350",
    cruise_speed: "450",
    route: "",
    remarks: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  /** Picking a known aircraft prefills its typical cruise level, speed and ICAO code. */
  const pickAircraft = (name: string) => {
    const info = aircraftInfo(name);
    setForm((f) => ({
      ...f,
      aircraft: name,
      aircraft_icao: typeDesignator(name).icao,
      cruise_fl: info ? String(info.fl) : f.cruise_fl,
      cruise_speed: info ? String(info.speed) : f.cruise_speed,
    }));
  };

  const input: FplInput = useMemo(
    () => ({
      callsign: form.callsign,
      flightRules: form.flight_rules,
      flightType: form.flight_type,
      aircraft: form.aircraft,
      aircraftIcao: form.aircraft_icao,
      registration: form.registration,
      depIcao: form.dep_icao,
      arrIcao: form.arr_icao,
      depTime: new Date(form.dep_time).toISOString(),
      arrTime: new Date(form.arr_time).toISOString(),
      cruiseSpeed: Number(form.cruise_speed) || 0,
      cruiseFl: Number(form.cruise_fl) || 0,
      route: form.route,
      alternateIcao: form.alternate_icao,
      remarks: form.remarks,
    }),
    [form],
  );

  const issues = useMemo(() => validateFpl(input), [input]);
  const fpl = useMemo(() => (issues.length ? "" : buildFpl(input)), [issues, input]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (issues.length) throw new Error(issues[0]!.message);
      const { data, error } = await supabase
        .from("flight_plans")
        .insert({
          user_id: userId,
          callsign: form.callsign.trim().toUpperCase(),
          airline: form.airline.trim() || null,
          aircraft: form.aircraft,
          aircraft_icao: form.aircraft_icao.trim().toUpperCase() || null,
          registration: form.registration.trim().toUpperCase() || null,
          flight_rules: form.flight_rules,
          flight_type: form.flight_type,
          dep_icao: form.dep_icao,
          arr_icao: form.arr_icao,
          alternate_icao: form.alternate_icao.trim().toUpperCase() || null,
          dep_time: new Date(form.dep_time).toISOString(),
          arr_time: new Date(form.arr_time).toISOString(),
          cruise_alt: (Number(form.cruise_fl) || 350) * 100,
          cruise_speed: Number(form.cruise_speed) || 450,
          route: form.route.trim().toUpperCase() || null,
          remarks: form.remarks.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      // Mirror the ICAO version into the Discord flight plans channel.
      try {
        await announceFlightPlan({ data: { flightPlanId: data.id } });
      } catch {
        // Discord relay is best-effort; the plan is already filed.
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flight_plans"] });
      toast.success("Flight plan filed — awaiting ATC approval");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async () => {
    await navigator.clipboard.writeText(fpl);
    toast.success("ICAO flight plan copied");
  };

  const download = () => {
    const blob = new Blob([fpl], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(form.callsign || "FPL").toUpperCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const airportSelect = (key: "dep_icao" | "arr_icao", label: string) => (
    <div className="space-y-1.5">
      <Label className="font-display text-[11px] tracking-console text-muted-foreground">{label}</Label>
      <Select value={form[key]} onValueChange={(v) => set(key, v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {AIRPORTS.map((a) => (
            <SelectItem key={a.icao} value={a.icao}>
              <span className="font-mono">{a.icao}</span> — {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">File flight plan</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form" className="gap-1.5">
              <Plane className="size-3.5" /> Flight plan
            </TabsTrigger>
            <TabsTrigger value="icao" className="gap-1.5">
              <FileText className="size-3.5" /> ICAO FPL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-display text-[11px] tracking-console text-muted-foreground">Callsign</Label>
                <Input
                  value={form.callsign}
                  placeholder="KLM123"
                  className="font-mono uppercase"
                  onChange={(e) => set("callsign", e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-display text-[11px] tracking-console text-muted-foreground">Airline</Label>
                <Select value={form.airline || "none"} onValueChange={(v) => set("airline", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Private" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">Private / none</SelectItem>
                    {AIRLINES.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-display text-[11px] tracking-console text-muted-foreground">Aircraft</Label>
                <Select value={form.aircraft} onValueChange={pickAircraft}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {AIRCRAFT_TYPES.map((a) => (
                      <SelectItem key={a.name} value={a.name}>
                        {a.name} <span className="font-mono text-muted-foreground">{typeDesignator(a.name).icao}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-display text-[11px] tracking-console text-muted-foreground">Registration</Label>
                <Input
                  value={form.registration}
                  placeholder="PH-ABC"
                  className="font-mono uppercase"
                  onChange={(e) => set("registration", e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-display text-[11px] tracking-console text-muted-foreground">Flight rules</Label>
                <Select value={form.flight_rules} onValueChange={(v) => set("flight_rules", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IFR">IFR — instrument</SelectItem>
                    <SelectItem value="VFR">VFR — visual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-display text-[11px] tracking-console text-muted-foreground">Flight type</Label>
                <Select value={form.flight_type} onValueChange={(v) => set("flight_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">Scheduled airline</SelectItem>
                    <SelectItem value="N">Non-scheduled / charter</SelectItem>
                    <SelectItem value="G">General aviation</SelectItem>
                    <SelectItem value="M">Military</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {airportSelect("dep_icao", "Departure airport")}
              {airportSelect("arr_icao", "Arrival airport")}
            </div>

            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">
                Alternate airport (optional)
              </Label>
              <Select
                value={form.alternate_icao || "none"}
                onValueChange={(v) => set("alternate_icao", v === "none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">None</SelectItem>
                  {AIRPORTS.map((a) => (
                    <SelectItem key={a.icao} value={a.icao}>
                      <span className="font-mono">{a.icao}</span> — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-display text-[11px] tracking-console text-muted-foreground">Departure time</Label>
                <Input type="datetime-local" value={form.dep_time} onChange={(e) => set("dep_time", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-display text-[11px] tracking-console text-muted-foreground">
                  Estimated arrival
                </Label>
                <Input type="datetime-local" value={form.arr_time} onChange={(e) => set("arr_time", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-display text-[11px] tracking-console text-muted-foreground">
                  Cruising altitude (FL{String(Number(form.cruise_fl) || 0).padStart(3, "0")})
                </Label>
                <Input
                  type="number"
                  step={10}
                  min={10}
                  max={600}
                  value={form.cruise_fl}
                  className="font-mono"
                  onChange={(e) => set("cruise_fl", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-display text-[11px] tracking-console text-muted-foreground">
                  Cruising speed (kt)
                </Label>
                <Input
                  type="number"
                  step={5}
                  value={form.cruise_speed}
                  className="font-mono"
                  onChange={(e) => set("cruise_speed", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">Route</Label>
              <Input
                value={form.route}
                placeholder="DCT ALPHA DCT"
                className="font-mono uppercase"
                onChange={(e) => set("route", e.target.value.toUpperCase())}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">
                Remarks (optional)
              </Label>
              <Input
                value={form.remarks}
                placeholder="PBN/B2B3"
                className="font-mono"
                onChange={(e) => set("remarks", e.target.value)}
              />
            </div>

            {issues.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {issues.map((i) => (
                  <li key={`${i.field}-${i.message}`}>
                    <span className="font-display tracking-console">{i.field}</span> — {i.message}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="icao" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">
              Controllers and the ATC365 Discord see this ICAO-style message. It is a simulation format for PTFS — it is
              not filed with any aviation authority.
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-primary">
              {fpl || "Complete the flight plan form to generate the ICAO message."}
            </pre>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" disabled={!fpl} onClick={copy}>
                <Copy className="size-4" /> Copy FPL
              </Button>
              <Button variant="outline" className="flex-1 gap-2" disabled={!fpl} onClick={download}>
                <Download className="size-4" /> Export
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || issues.length > 0}
          >
            {mutation.isPending ? "Filing…" : "File flight plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
