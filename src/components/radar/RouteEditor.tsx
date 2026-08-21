import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Compass, Route as RouteIcon, TriangleAlert, X } from "lucide-react";

import { WAYPOINTS } from "@/lib/waypoints";
import { routeViolations } from "@/lib/route";
import { airportByIcao } from "@/lib/world";
import type { Tfr } from "@/lib/tfr";
import type { NavMode } from "@/lib/flights";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Pilot- and controller-facing routing control: radar vectors (direct track that
 * automatically avoids restricted areas) or a hand-picked waypoint route.
 */
export function RouteEditor({
  navMode,
  waypoints,
  depIcao,
  arrIcao,
  callsign,
  airline,
  tfrs,
  onChange,
}: {
  navMode: NavMode;
  waypoints: string[];
  depIcao: string;
  arrIcao: string;
  callsign: string;
  airline: string | null;
  tfrs: Tfr[];
  onChange: (next: { navMode: NavMode; waypoints: string[] }) => void;
}) {
  const [filter, setFilter] = useState("");

  const dep = airportByIcao(depIcao);
  const arr = airportByIcao(arrIcao);

  /** Chart fixes, nearest to the direct track first, so the list stays useful. */
  const options = useMemo(() => {
    const q = filter.trim().toUpperCase();
    const list = WAYPOINTS.filter((w) => !waypoints.includes(w.name) && w.name.includes(q));
    if (!dep || !arr) return list.slice(0, 40);
    const dx = arr.x - dep.x;
    const dy = arr.y - dep.y;
    const len = Math.hypot(dx, dy) || 1;
    const offTrack = (x: number, y: number) =>
      Math.abs((x - dep.x) * (dy / len) - (y - dep.y) * (dx / len));
    return [...list].sort((a, b) => offTrack(a.x, a.y) - offTrack(b.x, b.y)).slice(0, 40);
  }, [filter, waypoints, dep, arr]);

  const violations = useMemo(
    () =>
      navMode === "waypoints"
        ? routeViolations(depIcao, arrIcao, waypoints, tfrs, callsign, airline)
        : [],
    [navMode, depIcao, arrIcao, waypoints, tfrs, callsign, airline],
  );

  const setMode = (mode: NavMode) => onChange({ navMode: mode, waypoints });
  const setWps = (next: string[]) => onChange({ navMode, waypoints: next });

  const move = (i: number, dir: -1 | 1) => {
    const next = [...waypoints];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setWps(next);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="font-display text-[11px] tracking-console text-muted-foreground">Navigation</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("vectors")}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
              navMode === "vectors"
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-secondary/40 text-muted-foreground",
            )}
          >
            <Compass className="size-4 shrink-0 text-primary" />
            <span>
              <span className="block font-display tracking-console">Radar vectors</span>
              Direct to the airport, avoiding TFRs
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("waypoints")}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
              navMode === "waypoints"
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-secondary/40 text-muted-foreground",
            )}
          >
            <RouteIcon className="size-4 shrink-0 text-primary" />
            <span>
              <span className="block font-display tracking-console">Waypoints</span>
              Fly the fixes you pick, in order
            </span>
          </button>
        </div>
      </div>

      {navMode === "waypoints" && (
        <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
          <p className="font-mono text-[11px] break-words text-foreground">
            {[depIcao, ...waypoints, arrIcao].join(" → ")}
          </p>

          {waypoints.length > 0 && (
            <ul className="space-y-1.5">
              {waypoints.map((w, i) => (
                <li
                  key={`${w}-${i}`}
                  className="flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1"
                >
                  <span className="font-display text-[10px] tracking-console text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-mono text-xs text-foreground">{w}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={`Move ${w} up`}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={`Move ${w} down`}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={`Remove ${w}`}
                    onClick={() => setWps(waypoints.filter((_, k) => k !== i))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Input
            value={filter}
            placeholder="Search chart waypoints (BEANS, UWAIS…)"
            className="font-mono uppercase"
            onChange={(e) => setFilter(e.target.value.toUpperCase())}
          />
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {options.map((w) => (
              <button
                key={w.name}
                type="button"
                onClick={() => setWps([...waypoints, w.name])}
                className="rounded-full border border-border bg-background/60 px-2.5 py-1 font-mono text-[11px] text-foreground hover:border-primary hover:text-primary"
              >
                {w.name}
              </button>
            ))}
            {options.length === 0 && (
              <p className="text-xs text-muted-foreground">No chart waypoint matches that.</p>
            )}
          </div>

          {violations.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-2.5 py-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">
                This route enters restricted airspace: {violations.join(", ")}. You are not cleared into it — pick
                waypoints around it.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
