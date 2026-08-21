import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AIRPORTS } from "@/lib/world";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function AtisDialog({
  open,
  onOpenChange,
  airportIcao,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  airportIcao: string | null;
  userId: string;
}) {
  const qc = useQueryClient();
  const [icao, setIcao] = useState(airportIcao ?? "IRFD");
  const [form, setForm] = useState({
    letter: "A",
    runway_in_use: "",
    wind: "",
    visibility: "",
    clouds: "",
    temperature: "",
    qnh: "",
    remarks: "",
  });

  const target = airportIcao ?? icao;

  const mutation = useMutation({
    mutationFn: async () => {
      await supabase.from("atis").update({ active: false }).eq("airport_icao", target).eq("active", true);
      const { error } = await supabase.from("atis").insert({
        airport_icao: target,
        created_by: userId,
        ...form,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atis"] });
      toast.success(`ATIS ${form.letter} published for ${target}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (key: keyof typeof form, label: string, placeholder: string) => (
    <div className="space-y-1.5">
      <Label className="font-display text-[11px] tracking-console text-muted-foreground">{label}</Label>
      <Input
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="font-mono"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">Publish ATIS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!airportIcao && (
            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">Airport</Label>
              <Select value={icao} onValueChange={setIcao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AIRPORTS.map((a) => (
                    <SelectItem key={a.icao} value={a.icao}>
                      {a.icao} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="font-display text-[11px] tracking-console text-muted-foreground">Information letter</Label>
            <Select value={form.letter} onValueChange={(v) => setForm((f) => ({ ...f, letter: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {LETTERS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field("runway_in_use", "Runway", "27L")}
            {field("wind", "Wind", "250/12KT")}
            {field("visibility", "Visibility", "10KM")}
            {field("clouds", "Clouds", "FEW030")}
            {field("temperature", "Temp / Dew", "18/12")}
            {field("qnh", "QNH", "1013")}
          </div>

          <div className="space-y-1.5">
            <Label className="font-display text-[11px] tracking-console text-muted-foreground">Remarks</Label>
            <Textarea
              value={form.remarks}
              placeholder="Expect ILS approach. Birds reported near threshold."
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? "Broadcasting…" : `Broadcast ATIS ${form.letter}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
