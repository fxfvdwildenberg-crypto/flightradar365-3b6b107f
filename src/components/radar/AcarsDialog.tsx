import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatHm, type LiveFlight } from "@/lib/flights";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AcarsMessage = {
  id: string;
  flight_plan_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: string;
  label: string;
  body: string;
  created_at: string;
};

const LABELS = ["MSG", "REQ CLX", "PDC", "POS REP", "WX REQ", "OPS"];

const QUICK = [
  "Request pushback and start",
  "Request enroute clearance",
  "Request descent",
  "Position report — on schedule",
  "Request gate assignment",
];

/** ACARS datalink between pilots and controllers, per flight. */
export function AcarsDialog({
  open,
  onOpenChange,
  flights,
  userId,
  displayName,
  isAtc,
  initialFlightId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  flights: LiveFlight[];
  userId: string;
  displayName: string;
  isAtc: boolean;
  initialFlightId?: string | null;
}) {
  const qc = useQueryClient();
  const [flightId, setFlightId] = useState<string | null>(initialFlightId ?? null);
  const [label, setLabel] = useState("MSG");
  const [body, setBody] = useState("");

  const mine = useMemo(() => flights.filter((f) => f.plan.user_id === userId), [flights, userId]);
  const options = isAtc ? flights : mine.length ? mine : flights;

  useEffect(() => {
    if (open && !flightId && options[0]) setFlightId(options[0].plan.id);
  }, [open, flightId, options]);

  const { data: messages = [] } = useQuery({
    queryKey: ["acars", flightId],
    enabled: open && !!flightId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acars_messages")
        .select("*")
        .eq("flight_plan_id", flightId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AcarsMessage[];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!flightId) throw new Error("Select a flight first");
      if (!body.trim()) throw new Error("Message is empty");
      const { error } = await supabase.from("acars_messages").insert({
        flight_plan_id: flightId,
        sender_id: userId,
        sender_name: displayName,
        sender_role: isAtc ? "atc" : "pilot",
        label,
        body: body.trim().toUpperCase(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["acars", flightId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = flights.find((f) => f.plan.id === flightId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="font-display text-xl tracking-console text-primary">
            ACARS datalink
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-4 pt-3">
          <div className="space-y-1.5">
            <Label className="font-display text-[11px] tracking-console text-muted-foreground">
              Flight
            </Label>
            <Select value={flightId ?? ""} onValueChange={setFlightId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a flight" />
              </SelectTrigger>
              <SelectContent>
                {options.map((f) => (
                  <SelectItem key={f.plan.id} value={f.plan.id}>
                    {f.plan.callsign} · {f.plan.dep_icao}→{f.plan.arr_icao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected && (
            <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {selected.plan.aircraft} · FL{Math.round(selected.altitude / 100)} ·{" "}
              {selected.groundSpeed} kt · SQ {selected.plan.squawk}
            </div>
          )}
        </div>

        <ScrollArea className="mt-3 h-[36vh] border-y border-border">
          <ul className="space-y-2 p-4">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "rounded-md border p-2.5 font-mono text-[12px] whitespace-pre-wrap",
                  m.sender_role === "atc"
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border bg-secondary/50 text-foreground",
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2 font-display text-[10px] tracking-console text-muted-foreground">
                  <span>
                    {m.sender_role === "atc" ? "ATC" : "PILOT"} · {m.sender_name} · {m.label}
                  </span>
                  <span>{formatHm(m.created_at)}Z</span>
                </div>
                {m.body}
              </li>
            ))}
            {!messages.length && (
              <li className="py-8 text-center text-sm text-muted-foreground">
                No ACARS traffic on this flight yet.
              </li>
            )}
          </ul>
        </ScrollArea>

        <div className="space-y-2 p-4">
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => setBody(q)}
                className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger className="w-32 shrink-0 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Uplink message"
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && send.mutate()}
            />
            <Button size="icon" onClick={() => send.mutate()} disabled={send.isPending}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
