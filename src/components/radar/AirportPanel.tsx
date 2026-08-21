import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CloudSun,
  ExternalLink,
  Gauge,
  Map as MapIcon,
  Pencil,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Radio,
  Settings2,
  Square,
  TowerControl,
  Volume2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { airportByIcao } from "@/lib/world";
import { formatHm, phaseLabel, type LiveFlight } from "@/lib/flights";
import { airportWeather, windArrow } from "@/lib/weather";
import {
  atisReport,
  atisSpokenText,
  speakAtis,
  stopAtisSpeech,
  type Atis,
  type AtcSession,
} from "@/lib/atc";
import { chartsFor } from "@/lib/charts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

/** Stable colour accent per airport, matching the aircraft card deck. */
const ACCENTS = ["deck-blue", "deck-violet", "deck-olive", "deck-gold"] as const;

function accentFor(icao: string) {
  let h = 0;
  for (const ch of icao) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return ACCENTS[h % ACCENTS.length];
}

export function AirportPanel({
  icao,
  flights,
  sessions = [],
  onClose,
  onEditAtis,
  onEditAirport,
  onGoOnline,
  canEditAtis,
  isAdmin = false,
  onSelectFlight,
}: {
  icao: string;
  flights: LiveFlight[];
  sessions?: AtcSession[];
  onClose: () => void;
  onEditAtis: () => void;
  onEditAirport?: (() => void) | undefined;
  onGoOnline?: (() => void) | undefined;
  canEditAtis: boolean;
  isAdmin?: boolean;
  onSelectFlight: (id: string) => void;
}) {
  const airport = airportByIcao(icao);
  const [speaking, setSpeaking] = useState(false);

  const { data: atis } = useQuery({
    queryKey: ["atis", icao],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atis")
        .select("*")
        .eq("airport_icao", icao)
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Atis | null;
    },
  });

  if (!airport) return null;

  const wx = airportWeather(airport.icao);
  const accent = accentFor(airport.icao);
  const departures = flights.filter((f) => f.plan.dep_icao === icao);
  const arrivals = flights.filter((f) => f.plan.arr_icao === icao);

  const toggleSpeech = () => {
    if (speaking) {
      stopAtisSpeech();
      setSpeaking(false);
      return;
    }
    if (!atis) return;
    const ok = speakAtis(atisSpokenText(atis, airport.name));
    setSpeaking(ok);
  };

  return (
    <div className="deck-surface animate-deck-in absolute inset-x-0 bottom-0 z-30 max-h-[86dvh] overflow-hidden rounded-t-3xl">
      <div className="flex justify-center pt-2.5 pb-1">
        <span className="sheet-grab" />
      </div>

      <div className="deck-fade-y max-h-[78dvh] overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className="space-y-3 px-3 pb-6">
          {/* Hero card */}
          <section className={cn("deck-card relative p-4", accent)}>
            {airport.image_url && (
              <img
                src={airport.image_url}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 size-full object-cover opacity-20 mix-blend-overlay"
                loading="lazy"
              />
            )}
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="deck-ink-soft font-display text-[11px] tracking-console">
                  {departures.length} departures · {arrivals.length} arrivals
                </p>
                <h2 className="deck-ink font-display text-3xl leading-tight font-bold break-words">
                  {airport.name}
                </h2>
                <p className="deck-ink-soft mt-1.5 font-mono text-sm">
                  {airport.icao}
                  {airport.iata ? ` / ${airport.iata}` : ""} ·{" "}
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}{" "}
                  LT
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {isAdmin && onEditAirport && (
                  <button
                    onClick={onEditAirport}
                    aria-label="Edit airport"
                    className="deck-chip flex size-8 items-center justify-center rounded-full"
                  >
                    <Settings2 className="size-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close airport panel"
                  className="deck-chip flex size-8 items-center justify-center rounded-full"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Live ATC strip */}
            <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
              {sessions.length ? (
                sessions.map((s) => (
                  <span
                    key={s.id}
                    className="deck-chip rounded-full px-2.5 py-1 font-mono text-[11px] uppercase"
                  >
                    {s.position} · {s.roblox_username ?? "online"}
                  </span>
                ))
              ) : (
                <span className="deck-chip rounded-full px-2.5 py-1 font-mono text-[11px]">
                  No ATC online
                </span>
              )}
              {atis && (
                <span className="deck-chip rounded-full px-2.5 py-1 font-mono text-[11px]">
                  ATIS {atis.letter}
                </span>
              )}
              {canEditAtis && onGoOnline && (
                <button
                  onClick={onGoOnline}
                  className="deck-chip ml-auto rounded-full px-3 py-1 font-display text-[11px] tracking-console"
                >
                  Go online
                </button>
              )}
            </div>
          </section>

          {/* Weather strip */}
          <section className="grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-secondary/40">
            <WxCell label="Conditions" value={wx.condition} icon={<CloudSun className="size-4" />} />
            <WxCell label="Temperature" value={`${wx.temperature}°C`} />
            <WxCell
              label="Wind"
              value={`${windArrow(wx.windDir)} ${String(wx.windDir).padStart(3, "0")}° ${wx.windSpeed} kt`}
            />
          </section>

          <Accordion type="multiple" defaultValue={["wx"]} className="space-y-2">
            <Section value="wx" icon={<Gauge className="size-4" />} title="Weather & METAR">
              <Rows
                rows={[
                  ["Air pressure", `${wx.pressure.toFixed(2)} inHg`],
                  ["QNH", `${wx.qnh} hPa`],
                  ["Dew point", `${wx.dewPoint} °C`],
                  ["Humidity", `${wx.humidity}%`],
                  ["Visibility", wx.visibility >= 9999 ? "10 km or more" : `${wx.visibility} m`],
                ]}
              />
              <pre className="mt-3 rounded-lg border border-border bg-secondary/60 p-3 font-mono text-[12px] break-words whitespace-pre-wrap text-foreground">
                {wx.metar}
              </pre>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Simulated report, refreshed every hour for {airport.icao}.
              </p>
            </Section>

            <Section value="atis" icon={<Radio className="size-4" />} title="ATIS">
              {atis ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-md bg-primary font-display text-2xl font-bold text-primary-foreground">
                      {atis.letter}
                    </div>
                    <div className="flex-1">
                      <div className="font-display text-xs tracking-console text-muted-foreground">
                        Information {atis.letter}
                      </div>
                      <div className="text-sm text-foreground">
                        Updated {formatHm(atis.updated_at)} Z
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={toggleSpeech}>
                      {speaking ? (
                        <>
                          <Square className="mr-1.5 size-4" /> Stop
                        </>
                      ) : (
                        <>
                          <Volume2 className="mr-1.5 size-4" /> Listen
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="rounded-lg border border-border bg-secondary/60 p-3 font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap text-foreground">
                    {atisReport(atis, airport.name)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No ATIS published for {airport.icao}.
                </p>
              )}
              {canEditAtis && (
                <Button className="mt-3 w-full" variant="secondary" onClick={onEditAtis}>
                  <Pencil className="mr-2 size-4" />
                  {atis ? "Update ATIS" : "Publish ATIS"}
                </Button>
              )}
            </Section>

            <Section
              value="atc"
              icon={<TowerControl className="size-4" />}
              title={`Controllers online${sessions.length ? ` · ${sessions.length}` : ""}`}
            >
              {sessions.length ? (
                <ul className="space-y-2">
                  {sessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2"
                    >
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                        {s.position}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground">
                          {s.roblox_username ?? "Unknown controller"}
                        </div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">
                          {s.discord_username ?? "no discord"}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        since {formatHm(s.started_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No ATC online at this airport.</p>
              )}
            </Section>

            <Section value="info" icon={<Plane className="size-4" />} title="Airport information">
              {airport.image_url && (
                <img
                  src={airport.image_url}
                  alt={`${airport.name} seen in game`}
                  className="mb-3 h-40 w-full rounded-lg object-cover"
                  loading="lazy"
                />
              )}
              <p className="text-sm text-foreground">
                {airport.info?.trim() || "No airport information published yet."}
              </p>
            </Section>

            <Section value="charts" icon={<MapIcon className="size-4" />} title="Charts">
              <div className="space-y-3">
                {chartsFor(airport.icao).map((chart) =>
                  chart.kind === "image" ? (
                    <figure key={chart.key} className="space-y-2">
                      <img
                        src={chart.url}
                        alt={`${airport.name} ground chart`}
                        className="w-full rounded-lg border border-border bg-secondary/40"
                        loading="lazy"
                      />
                      <figcaption className="font-mono text-[11px] text-muted-foreground">
                        {chart.label}
                      </figcaption>
                    </figure>
                  ) : (
                    <Button
                      key={chart.key}
                      asChild
                      variant="secondary"
                      className="w-full justify-start gap-2"
                    >
                      <a href={chart.url} target="_blank" rel="noreferrer noopener">
                        <ExternalLink className="size-4" /> {chart.label}
                      </a>
                    </Button>
                  ),
                )}
              </div>
            </Section>

            <Section
              value="dep"
              icon={<PlaneTakeoff className="size-4" />}
              title={`Departures${departures.length ? ` · ${departures.length}` : ""}`}
            >
              <FlightRows list={departures} mode="dep" onSelectFlight={onSelectFlight} />
            </Section>

            <Section
              value="arr"
              icon={<PlaneLanding className="size-4" />}
              title={`Arrivals${arrivals.length ? ` · ${arrivals.length}` : ""}`}
            >
              <FlightRows list={arrivals} mode="arr" onSelectFlight={onSelectFlight} />
            </Section>
          </Accordion>
        </div>
      </div>
    </div>
  );
}

function WxCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="px-2 py-3 text-center not-last:border-r not-last:border-border">
      <div className="font-display text-[10px] tracking-console text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-center gap-1 font-mono text-sm text-foreground">
        {icon && <span className="text-primary">{icon}</span>}
        {value}
      </div>
    </div>
  );
}

function Section({
  value,
  icon,
  title,
  children,
}: {
  value: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-xl border border-border bg-card px-3 last:border-b"
    >
      <AccordionTrigger className="py-3 font-display text-sm tracking-console hover:no-underline">
        <span className="flex items-center gap-2 text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-3">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-1.5">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3">
          <dt className="font-display text-[11px] tracking-console text-muted-foreground">{k}</dt>
          <dd className="max-w-[62%] text-right font-mono text-[13px] break-words text-foreground">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FlightRows({
  list,
  mode,
  onSelectFlight,
}: {
  list: LiveFlight[];
  mode: "dep" | "arr";
  onSelectFlight: (id: string) => void;
}) {
  if (!list.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No {mode === "dep" ? "departures" : "arrivals"} scheduled.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {list.map((f) => (
        <li key={f.plan.id}>
          <button
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-left transition-colors hover:bg-accent"
            onClick={() => onSelectFlight(f.plan.id)}
          >
            <div className="w-12 shrink-0 font-mono text-sm text-primary">
              {formatHm(mode === "dep" ? f.plan.dep_time : f.plan.arr_time)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-base font-semibold text-foreground">
                {mode === "dep" ? f.arr.name : f.dep.name}
              </div>
              <div className="truncate font-mono text-xs text-muted-foreground">
                {f.plan.callsign} · {f.plan.aircraft}
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
              {phaseLabel(f.phase)}
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}
