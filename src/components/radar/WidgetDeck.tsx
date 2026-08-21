import { useEffect, useState } from "react";
import { Clock, Eye, Heart, History, TriangleAlert } from "lucide-react";
import type { LiveFlight } from "@/lib/flights";
import { isEmergencySquawk, squawkInfo } from "@/lib/squawk";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type WidgetKey = "clock" | "emergencies" | "popular" | "favorites" | "playback";

export const WIDGETS: { key: WidgetKey; label: string; hint: string }[] = [
  { key: "clock", label: "Zulu clock", hint: "UTC and local time" },
  { key: "emergencies", label: "Emergencies", hint: "Live 7500/7600/7700 squawks" },
  { key: "popular", label: "Most viewed", hint: "Flights people are watching" },
  { key: "favorites", label: "Favourites", hint: "Your saved aircraft" },
  { key: "playback", label: "Playback", hint: "Rewind the radar in time" },
];

/** Floating widget stack shown on the right of the radar. */
export function WidgetDeck({
  enabled,
  flights,
  now,
  viewCounts,
  favorites,
  offsetMin,
  onOffsetChange,
  onSelectFlight,
}: {
  enabled: Set<WidgetKey>;
  flights: LiveFlight[];
  now: number;
  viewCounts: Map<string, number> | undefined;
  favorites: Set<string>;
  offsetMin: number;
  onOffsetChange: (v: number) => void;
  onSelectFlight: (id: string) => void;
}) {
  // The clock only renders after hydration; SSR time never matches the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (enabled.size === 0) return null;

  const emergencies = flights.filter((f) => isEmergencySquawk(f.plan.squawk));
  const popular = [...flights]
    .map((f) => ({ f, n: viewCounts?.get(f.plan.id) ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  const favs = flights.filter((f) => favorites.has(f.plan.id));

  return (
    <div className="pointer-events-none absolute top-14 right-3 z-20 flex w-52 flex-col gap-2">
      {enabled.has("clock") && (
        <Card icon={<Clock className="size-3.5" />} title="Clock">
          <div className="font-mono text-lg text-primary">
            {mounted ? `${new Date(now).toISOString().slice(11, 19)}Z` : "--:--:--Z"}
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            {mounted ? new Date(now).toLocaleTimeString([], { hour12: false }) : "--:--:--"} local
          </div>
        </Card>
      )}

      {enabled.has("emergencies") && (
        <Card icon={<TriangleAlert className="size-3.5" />} title="Emergencies" tone={emergencies.length ? "alert" : undefined}>
          {emergencies.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active emergencies.</p>
          ) : (
            <ul className="space-y-1">
              {emergencies.map((f) => (
                <li key={f.plan.id}>
                  <button
                    className="w-full text-left font-mono text-xs text-destructive hover:underline"
                    onClick={() => onSelectFlight(f.plan.id)}
                  >
                    {f.plan.callsign} · {f.plan.squawk} · {squawkInfo(f.plan.squawk)?.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {enabled.has("popular") && (
        <Card icon={<Eye className="size-3.5" />} title="Most viewed">
          {popular.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nobody is watching yet.</p>
          ) : (
            <ul className="space-y-1">
              {popular.map(({ f, n }) => (
                <li key={f.plan.id} className="flex items-center justify-between gap-2">
                  <button
                    className="truncate font-mono text-xs text-foreground hover:text-primary"
                    onClick={() => onSelectFlight(f.plan.id)}
                  >
                    {f.plan.callsign}
                  </button>
                  <span className="font-mono text-[10px] text-muted-foreground">{n} 👁</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {enabled.has("favorites") && (
        <Card icon={<Heart className="size-3.5" />} title="Favourites">
          {favs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No favourites airborne.</p>
          ) : (
            <ul className="space-y-1">
              {favs.map((f) => (
                <li key={f.plan.id}>
                  <button
                    className="truncate font-mono text-xs text-foreground hover:text-primary"
                    onClick={() => onSelectFlight(f.plan.id)}
                  >
                    {f.plan.callsign} · {f.plan.dep_icao}→{f.plan.arr_icao}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {enabled.has("playback") && (
        <Card icon={<History className="size-3.5" />} title="Playback">
          <div className="font-mono text-xs text-primary">
            {offsetMin === 0 ? "Live" : `${offsetMin} min`}
          </div>
          <Slider
            className="mt-2"
            value={[offsetMin]}
            min={-180}
            max={0}
            step={5}
            onValueChange={([v]) => onOffsetChange(v ?? 0)}
          />
          <Button
            size="sm"
            variant="secondary"
            className="mt-2 h-7 w-full text-xs"
            onClick={() => onOffsetChange(0)}
          >
            Back to live
          </Button>
        </Card>
      )}
    </div>
  );
}

function Card({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: "alert" | undefined;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto rounded-lg border bg-card/95 p-2.5 shadow-[var(--shadow-panel)] backdrop-blur",
        tone === "alert" ? "border-destructive/70" : "border-border",
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 font-display text-[10px] tracking-console text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
