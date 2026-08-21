import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AIRPORTS } from "@/lib/world";
import { POSITIONS, type AtcPosition } from "@/lib/atc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Lets a controller go online on a position at an airport. */
export function AtcOnlineDialog({
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
  const [icao, setIcao] = useState(airportIcao ?? AIRPORTS[0]?.icao ?? "IRFD");
  const [position, setPosition] = useState<AtcPosition>("tower");
  const [roblox, setRoblox] = useState("");
  const [discord, setDiscord] = useState("");

  const target = airportIcao ?? icao;

  const goOnline = useMutation({
    mutationFn: async () => {
      // Close any previous session for this controller first.
      await supabase.from("atc_sessions").update({ online: false }).eq("user_id", userId);
      const { error } = await supabase.from("atc_sessions").insert({
        user_id: userId,
        airport_icao: target,
        position,
        roblox_username: roblox.trim() || null,
        discord_username: discord.trim() || null,
        online: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atc_sessions"] });
      toast.success(`Online as ${position} at ${target}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const goOffline = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("atc_sessions")
        .update({ online: false })
        .eq("user_id", userId)
        .eq("online", true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atc_sessions"] });
      toast.success("You are now offline");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-console text-primary">
            Go online
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!airportIcao && (
            <div className="space-y-1.5">
              <Label className="font-display text-[11px] tracking-console text-muted-foreground">
                Airport
              </Label>
              <Select value={icao} onValueChange={setIcao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Label className="font-display text-[11px] tracking-console text-muted-foreground">
              Position
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {POSITIONS.map((p) => (
                <Button
                  key={p.key}
                  variant={position === p.key ? "default" : "secondary"}
                  onClick={() => setPosition(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-display text-[11px] tracking-console text-muted-foreground">
              Roblox username
            </Label>
            <Input value={roblox} onChange={(e) => setRoblox(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-display text-[11px] tracking-console text-muted-foreground">
              Discord username
            </Label>
            <Input value={discord} onChange={(e) => setDiscord(e.target.value)} />
          </div>

          <Button className="w-full" onClick={() => goOnline.mutate()} disabled={goOnline.isPending}>
            Go online at {target}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => goOffline.mutate()}
            disabled={goOffline.isPending}
          >
            Go offline
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
