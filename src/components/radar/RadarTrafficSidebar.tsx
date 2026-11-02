import { useState } from "react";
import { ArrowUpRight, Globe2, Plane, Radio, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { LiveFlight } from "@/lib/flights";
import { AIRPORTS, ISLANDS } from "@/lib/world";
import { cn } from "@/lib/utils";

export function RadarTrafficSidebar({ flights, selectedFlightId, focus, onSelectFlight, onSelectAirport, onFocus }: {
  flights: LiveFlight[];
  selectedFlightId: string | null;
  focus: string | null;
  onSelectFlight: (id: string) => void;
  onSelectAirport: (icao: string) => void;
  onFocus: (slug: string | null) => void;
}) {
  const [filter, setFilter] = useState("");
  const term = filter.trim().toLowerCase();
  const visibleFlights = flights.filter(f => `${f.plan.callsign} ${f.plan.aircraft} ${f.dep.icao} ${f.arr.icao}`.toLowerCase().includes(term));
  const airports = AIRPORTS.filter(a => (!focus || a.island === focus) && `${a.icao} ${a.name}`.toLowerCase().includes(term));
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="border-b border-border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Traffic monitor</h2>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-primary"><span className="size-1.5 rounded-full bg-primary" /> RADAR</span>
        </div>
        <div className="relative">
          <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input aria-label="Filter radar traffic" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Callsign, aircraft or airport" className="h-10 rounded-md bg-background pl-9" />
        </div>
      </div>
      <Tabs defaultValue="traffic" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className="mx-4 mt-4 grid h-9 shrink-0 grid-cols-2 rounded-md bg-secondary">
          <TabsTrigger value="traffic" className="rounded-sm">Aircraft <span className="font-mono text-xs text-muted-foreground">{flights.length}</span></TabsTrigger>
          <TabsTrigger value="airports" className="rounded-sm">Airports <span className="font-mono text-xs text-muted-foreground">{airports.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="traffic" className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 text-xs text-muted-foreground"><span>CALLSIGN / ROUTE</span><span>ALT / SPEED</span></div>
          {visibleFlights.map(f => (
            <Button key={f.plan.id} variant="ghost" onClick={() => onSelectFlight(f.plan.id)} className={cn("h-auto w-full justify-between gap-3 rounded-none border-l-2 border-b border-b-border px-4 py-4 text-left", selectedFlightId === f.plan.id ? "border-l-primary bg-accent" : "border-l-transparent")}>
              <span className="flex min-w-0 items-start gap-3"><Plane className="mt-1 size-4 text-primary" /><span className="min-w-0"><span className="block truncate font-display text-lg font-semibold">{f.plan.callsign}</span><span className="block font-mono text-[10px] text-muted-foreground">{f.dep.icao} → {f.arr.icao}</span><span className="block truncate text-xs text-muted-foreground">{f.plan.aircraft}</span></span></span>
              <span className="shrink-0 text-right font-mono text-[11px]"><span className="block">{f.altitude.toLocaleString()} <span className="text-muted-foreground">ft</span></span><span className="mt-1 block text-muted-foreground">{f.groundSpeed} kt</span></span>
            </Button>
          ))}
          {!visibleFlights.length && <div className="flex flex-col items-center px-5 py-14 text-center"><div className="mb-4 flex size-14 items-center justify-center rounded-full border border-border"><Plane className="size-6 text-primary" /></div><p className="font-display text-xl">{term ? "No matching aircraft" : "Quiet skies"}</p><p className="mt-2 text-sm text-muted-foreground">{term ? "No results for this search." : "No aircraft in this region."}</p></div>}
        </TabsContent>
        <TabsContent value="airports" className="min-h-0 flex-1 overflow-y-auto pt-3">
          {airports.map(a => <Button key={a.icao} variant="ghost" className="h-auto w-full justify-start rounded-none border-b border-border px-5 py-3 text-left" onClick={() => onSelectAirport(a.icao)}><Radio className="text-primary" /><span className="min-w-0 flex-1"><span className="block font-mono text-xs">{a.icao}</span><span className="block truncate text-sm text-muted-foreground">{a.name}</span></span><ArrowUpRight className="text-muted-foreground" /></Button>)}
          {!airports.length && <p className="p-5 text-sm text-muted-foreground">No matching airports.</p>}
        </TabsContent>
      </Tabs>
      <div className="flex shrink-0 items-center gap-3 border-t border-border p-4">
        <Globe2 className="size-4 text-primary" />
        <select aria-label="Radar region" value={focus ?? ""} onChange={e => onFocus(e.target.value || null)} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground">
          <option value="">All regions</option>
          {ISLANDS.map(i => <option key={i.slug} value={i.slug}>{i.name}</option>)}
        </select>
      </div>
    </div>
  );
}