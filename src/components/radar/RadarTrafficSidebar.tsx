import { useState } from "react";
import { ArrowUpRight, Globe2, Plane, Radio, Search, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LiveFlight } from "@/lib/flights";
import { AIRPORTS, ISLANDS } from "@/lib/world";
import { cn } from "@/lib/utils";

export function RadarTrafficSidebar({ flights, selectedFlightId, selectedAirport, focus, onSelectFlight, onSelectAirport, onFocus, mode }: {
  mode?: "traffic" | "airports";
  flights: LiveFlight[];
  selectedFlightId: string | null;
  selectedAirport: string | null;
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
      <div className="border-b border-border p-4">
        <div className="mb-5 flex items-center justify-between">
          <div><p className="radar-module-heading mb-1">Airspace overview</p><h2 className="font-display text-2xl font-semibold">{mode === "traffic" ? "Active flights" : mode === "airports" ? "Airports" : "Traffic monitor"}</h2></div>
          <Navigation className="size-5 text-primary" />
        </div>
        <div className="relative">
          <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input aria-label="Filter radar traffic" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter traffic…" className="h-10 rounded-md bg-background pl-9" />
        </div>
      </div>
      <Tabs value={mode} defaultValue="traffic" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={cn("mx-4 mt-4 grid h-10 shrink-0 grid-cols-2 rounded-md bg-background p-1", mode && "hidden")}>
          <TabsTrigger value="traffic" className="rounded-sm gap-2 data-[state=active]:bg-secondary data-[state=active]:text-primary">Aircraft <span className="font-mono text-xs">{flights.length}</span></TabsTrigger>
          <TabsTrigger value="airports" className="rounded-sm gap-2 data-[state=active]:bg-secondary data-[state=active]:text-primary">Airports <span className="font-mono text-xs">{airports.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="traffic" className="min-h-0 flex-1 overflow-y-auto">
          <div className="radar-module-heading flex items-center justify-between px-4 pt-5 pb-3"><span>Callsign / route</span><span>Telemetry</span></div>
          <div className="space-y-2 px-3 pb-3">
          {visibleFlights.map(f => (
            <Button key={f.plan.id} variant="ghost" onClick={() => onSelectFlight(f.plan.id)} className={cn("h-auto min-h-24 w-full justify-between gap-2 rounded-lg border px-3 py-3 text-left", selectedFlightId === f.plan.id ? "border-primary/60 bg-accent" : "border-border bg-background/60")}>
              <span className="flex min-w-0 items-start gap-2"><Plane className="mt-1 size-4 text-primary" /><span className="min-w-0"><span className="block truncate font-display text-lg font-semibold">{f.plan.callsign}</span><span className="mt-1 block font-mono text-[10px] text-muted-foreground">{f.dep.icao} → {f.arr.icao}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{f.plan.aircraft}</span></span></span>
              <span className="shrink-0 text-right font-mono text-[11px]"><span className="block">{f.altitude.toLocaleString()} <span className="text-muted-foreground">ft</span></span><span className="mt-1 block text-muted-foreground">{f.groundSpeed} kt</span></span>
            </Button>
          ))}
          </div>
          {!visibleFlights.length && <div className="flex flex-col items-center px-5 py-14 text-center"><div className="mb-4 flex size-14 items-center justify-center rounded-full border border-border"><Plane className="size-6 text-primary" /></div><p className="font-display text-xl">{term ? "No matching aircraft" : "Quiet skies"}</p><p className="mt-2 text-sm text-muted-foreground">{term ? "No results for this search." : "No aircraft in this region."}</p></div>}
        </TabsContent>
        <TabsContent value="airports" className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pt-4 pb-3">
          {airports.map(a => <Button key={a.icao} variant="ghost" className={cn("h-auto min-h-16 w-full justify-start rounded-lg border px-3 py-3 text-left", selectedAirport === a.icao ? "border-primary/60 bg-accent" : "border-border bg-background/60")} onClick={() => onSelectAirport(a.icao)}><Radio className="text-primary" /><span className="min-w-0 flex-1"><span className="block font-mono text-xs">{a.icao}</span><span className="block truncate text-sm text-muted-foreground">{a.name}</span></span><ArrowUpRight className="text-muted-foreground" /></Button>)}
          {!airports.length && <p className="p-5 text-sm text-muted-foreground">No matching airports.</p>}
        </TabsContent>
      </Tabs>
      <div className="shrink-0 border-t border-border p-4">
        <p className="radar-module-heading mb-3">Coverage</p>
        <Select value={focus ?? "all"} onValueChange={value => onFocus(value === "all" ? null : value)}>
          <SelectTrigger aria-label="Radar region" className="w-full bg-background"><Globe2 className="size-4 text-primary" /><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All regions</SelectItem>{ISLANDS.map(i => <SelectItem key={i.slug} value={i.slug}>{i.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}