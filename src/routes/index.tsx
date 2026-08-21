import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  Cloud,
  Crosshair,
  Download,
  Globe2,
  BellRing,
  GraduationCap,
  Headphones,
  LayoutGrid,
  ListChecks,
  LogIn,
  MessageSquare,
  Menu,
  Map as MapIcon,
  PlaneTakeoff,
  Radio,
  Route as RouteIcon,
  Search,
  Shield,
  UserRound,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAirportRegistry } from "@/lib/airports";
import { pickAircraftImage, useAircraftImages, useAtcSessions, useAtisMap } from "@/lib/atc";
import { ISLANDS, AIRPORTS, airportsOfIsland, islandBySlug } from "@/lib/world";
import { computeFlight, formatHm, isVisibleOnRadar, type FlightPlan, type LiveFlight } from "@/lib/flights";
import { isEmergencySquawk, squawkInfo } from "@/lib/squawk";
import { CATEGORIES, categoryFor, type CategoryKey } from "@/lib/aircraft";
import { usePersistentSet, usePersistentState } from "@/lib/persist";
import { expiresLabel, useTfrs, type Pt } from "@/lib/tfr";
import { useFavorites, useFlightViewCounts, useRecordView } from "@/lib/favorites";
import { useInstallPrompt } from "@/lib/pwa";
import { requestPinPermission, useFlightPinNotification, usePinnedFlightId } from "@/lib/pin";
import {
  pushSupported,
  sendTestNotification,
  subscribeToFlightPush,
  unsubscribeFromFlightPush,
} from "@/lib/push";

import { RadarMap } from "@/components/radar/RadarMap";
import { AirportPanel } from "@/components/radar/AirportPanel";
import { FlightPanel } from "@/components/radar/FlightPanel";
import { FlightPlanDialog } from "@/components/radar/FlightPlanDialog";
import { AtisDialog } from "@/components/radar/AtisDialog";
import { AtcOnlineDialog } from "@/components/radar/AtcOnlineDialog";
import { AdminDialog } from "@/components/radar/AdminDialog";
import { AcarsDialog } from "@/components/radar/AcarsDialog";

import { WidgetDeck, WIDGETS, type WidgetKey } from "@/components/radar/WidgetDeck";
import { Tutorial, resetTutorial } from "@/components/Tutorial";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


const TITLE = "ATC365 — Live Island Radar & Flight Plans";
const DESCRIPTION =
  "Track live aircraft across every island, file flight plans with departure and arrival times, and read ATC-published ATIS for each airport.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RadarPage,
});

function RadarPage() {
  const { user, isAtc, isAdmin } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [focus, setFocus] = useState<string | null>(null);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [atisOpen, setAtisOpen] = useState(false);
  const [atcOpen, setAtcOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [acarsOpen, setAcarsOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [drawingTfr, setDrawingTfr] = useState(false);
  const [tfrDraft, setTfrDraft] = useState<Pt[]>([]);
  const [selectedTfrId, setSelectedTfrId] = useState<string | null>(null);

  const [regionsOpen, setRegionsOpen] = useState(false);
  const [showClouds, setShowClouds] = usePersistentState("clouds", false);
  const [showRoutes, setShowRoutes] = usePersistentState("routes", true);
  const [showLabels, setShowLabels] = usePersistentState("labels", true);
  const [query, setQuery] = useState("");
  const [widgets, setWidgets] = usePersistentSet<WidgetKey>("widgets", ["clock"]);
  const [hiddenCats, setHiddenCats] = usePersistentSet<CategoryKey>("hidden-categories", []);
  const [offsetMin, setOffsetMin] = useState(0);

  const { canInstall, installed, install } = useInstallPrompt();
  const [pinnedId, setPinnedId] = usePinnedFlightId();

  const toggleWidget = (key: WidgetKey, on: boolean) =>
    setWidgets((prev: Set<WidgetKey>) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const toggleCategory = (key: CategoryKey, on: boolean) =>
    setHiddenCats((prev: Set<CategoryKey>) => {
      const next = new Set(prev);
      if (on) next.delete(key);
      else next.add(key);
      return next;
    });

  useAirportRegistry();
  const { data: atcByAirport } = useAtcSessions();
  const { data: atisByAirport } = useAtisMap();
  const { data: aircraftImages } = useAircraftImages();
  const { data: viewCounts } = useFlightViewCounts();
  const { favorites, toggleFavorite } = useFavorites(user?.id);
  useRecordView(selectedFlightId);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);


  const { data: plans = [] } = useQuery({
    queryKey: ["flight_plans"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_plans")
        .select("*")
        .order("dep_time", { ascending: true });
      if (error) throw error;
      return data as FlightPlan[];
    },
  });

  // Playback simply rewinds the radar clock; everything else follows from it.
  const clock = now + offsetMin * 60_000;

  const { data: tfrs = [] } = useTfrs();
  const selectedTfr = tfrs.find((t) => t.id === selectedTfrId) ?? null;

  const flights: LiveFlight[] = useMemo(() => {
    const all = plans
      .map((p) => computeFlight(p, clock, tfrs))
      .filter((f): f is LiveFlight => !!f)
      .filter((f) => isVisibleOnRadar(f, clock))
      .filter((f) => !hiddenCats.has(categoryFor(f.plan.aircraft)));
    if (!focus) return all;
    const codes = new Set(airportsOfIsland(focus).map((a) => a.icao));
    // Keep flights that touch this island, or are currently over it.
    const isl = islandBySlug(focus);
    return all.filter(
      (f) =>
        codes.has(f.plan.dep_icao) ||
        codes.has(f.plan.arr_icao) ||
        (isl ? Math.hypot(f.x - isl.x, f.y - isl.y) < isl.radius * 3 : false),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, clock, focus, tfrs, Array.from(hiddenCats).sort().join(",")]);


  const selectedFlight = flights.find((f) => f.plan.id === selectedFlightId) ?? null;
  const pinnedFlight = flights.find((f) => f.plan.id === pinnedId) ?? null;

  useFlightPinNotification(
    pinnedFlight
      ? {
          id: pinnedFlight.plan.id,
          callsign: pinnedFlight.plan.callsign,
          depIcao: pinnedFlight.dep.icao,
          arrIcao: pinnedFlight.arr.icao,
          depTime: formatHm(pinnedFlight.plan.dep_time),
          arrTime: formatHm(pinnedFlight.plan.arr_time),
          progress: pinnedFlight.progress,
          phase: pinnedFlight.phase,
          emergency: isEmergencySquawk(pinnedFlight.plan.squawk),
          emergencyLabel: squawkInfo(pinnedFlight.plan.squawk)?.label,
          eta:
            pinnedFlight.phase === "arrived"
              ? "Arrived"
              : pinnedFlight.phase === "scheduled"
                ? `Departs in ${Math.max(pinnedFlight.minutesToDeparture, 0)} min`
                : `${Math.max(pinnedFlight.minutesToArrival, 0)} min until arrival`,
        }
      : null,
    !!pinnedFlight,
  );

  const togglePin = async (id: string) => {
    if (pinnedId === id) {
      setPinnedId(null);
      await unsubscribeFromFlightPush().catch(() => undefined);
      toast.info("Flight unpinned");
      return;
    }
    const ok = await requestPinPermission();
    setPinnedId(id);
    let background = false;
    if (ok && pushSupported()) {
      background = await subscribeToFlightPush(id).catch(() => false);
    }
    toast.success(
      background
        ? "Flight pinned — alerts arrive even with the app closed"
        : ok
          ? "Flight pinned — progress now shows in your notifications"
          : "Flight pinned — allow notifications to see it outside the app",
    );
  };

  const testNotification = async () => {
    try {
      await sendTestNotification();
      toast.success("Test notification sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send a test notification");
    }
  };

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [
      ...AIRPORTS.filter(
        (a) => a.name.toLowerCase().includes(q) || a.icao.toLowerCase().includes(q),
      ).map((a) => ({ kind: "airport" as const, id: a.icao, label: a.name, sub: a.icao })),
      ...plans
        .filter((p) => p.callsign.toLowerCase().includes(q))
        .map((p) => ({ kind: "flight" as const, id: p.id, label: p.callsign, sub: `${p.dep_icao} → ${p.arr_icao}` })),
    ].slice(0, 8);
  }, [query, plans]);

  const focusedIsland = focus ? islandBySlug(focus) : null;
  const airborne = flights.filter((f) => f.phase === "enroute" || f.phase === "departing" || f.phase === "arriving").length;

  const openAirport = (icao: string) => {
    setSelectedFlightId(null);
    setSelectedAirport(icao);
    const a = AIRPORTS.find((x) => x.icao === icao);
    if (a && focus !== a.island) setFocus(a.island);
  };

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="z-40 flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
        <Link
          to="/auth"
          className="flex shrink-0 flex-col items-center gap-0.5 text-muted-foreground transition-colors hover:text-primary"
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-border bg-secondary">
            {user ? <UserRound className="size-4" /> : <LogIn className="size-4" />}
          </span>
          <span className="font-display text-[9px] tracking-console">
            {user ? "Account" : "Sign in"}
          </span>
        </Link>

        <Logo className="h-9 shrink-0" />

        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search flights or airports"
            className="h-10 rounded-full border-border bg-secondary pl-9 font-display text-sm tracking-console placeholder:text-muted-foreground/70"
          />

          {searchResults.length > 0 && (
            <ul className="panel absolute inset-x-0 top-12 z-50 overflow-hidden rounded-lg">
              {searchResults.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    onClick={() => {
                      setQuery("");
                      if (r.kind === "airport") openAirport(r.id);
                      else {
                        setSelectedAirport(null);
                        setSelectedFlightId(r.id);
                      }
                    }}
                  >
                    <span className="truncate text-sm text-foreground">{r.label}</span>
                    <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">{r.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Sheet open={regionsOpen} onOpenChange={setRegionsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open regions">
              <Menu className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[86vw] max-w-sm border-border bg-card p-0">
            <SheetHeader className="border-b border-border px-4 py-4">
              <SheetTitle className="flex items-center gap-2 font-display text-xl text-primary">
                <Logo className="h-7" /> Menu
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100dvh-72px)]">
              <div className="p-3">
                <p className="px-1 pb-2 font-display text-[11px] tracking-console text-muted-foreground">
                  Island selection
                </p>
                <ul className="space-y-1.5">
                  <li>
                    <RegionRow
                      label="Whole World"
                      sub={`${ISLANDS.length} regions`}
                      active={focus === null}
                      onClick={() => {
                        setFocus(null);
                        setSelectedAirport(null);
                        setRegionsOpen(false);
                      }}
                    />
                  </li>
                  {ISLANDS.map((i) => (
                    <li key={i.slug}>
                      <RegionRow
                        label={i.name}
                        sub={`${airportsOfIsland(i.slug).length} spawns`}
                        active={focus === i.slug}
                        onClick={() => {
                          setFocus(i.slug);
                          setSelectedAirport(null);
                          setSelectedFlightId(null);
                          setRegionsOpen(false);
                        }}
                      />
                    </li>
                  ))}
                </ul>

                <p className="px-1 pt-5 pb-2 font-display text-[11px] tracking-console text-muted-foreground">
                  Settings
                </p>
                <div className="space-y-1 rounded-md border border-border bg-secondary/50 p-1">
                  <SettingRow
                    id="set-clouds"
                    icon={<Cloud className="size-4" />}
                    label="Clouds"
                    hint="Drifting weather layer on the map"
                    checked={showClouds}
                    onChange={setShowClouds}
                  />
                  <SettingRow
                    id="set-routes"
                    icon={<RouteIcon className="size-4" />}
                    label="Route lines"
                    hint="Show the track of the selected flight"
                    checked={showRoutes}
                    onChange={setShowRoutes}
                  />
                  <SettingRow
                    id="set-labels"
                    icon={<Radio className="size-4" />}
                    label="Callsign labels"
                    hint="Print callsigns under aircraft"
                    checked={showLabels}
                    onChange={setShowLabels}
                  />
                </div>

                <p className="px-1 pt-5 pb-2 font-display text-[11px] tracking-console text-muted-foreground">
                  Aircraft filters
                </p>
                <div className="space-y-1 rounded-md border border-border bg-secondary/50 p-1">
                  {CATEGORIES.map((c) => (
                    <SettingRow
                      key={c.key}
                      id={`cat-${c.key}`}
                      icon={<PlaneTakeoff className="size-4" />}
                      label={c.label}
                      hint={`Show ${c.label.toLowerCase()} on the radar`}
                      checked={!hiddenCats.has(c.key)}
                      onChange={(v) => toggleCategory(c.key, v)}
                    />
                  ))}
                </div>

                <p className="px-1 pt-5 pb-2 font-display text-[11px] tracking-console text-muted-foreground">
                  Widgets
                </p>
                <div className="space-y-1 rounded-md border border-border bg-secondary/50 p-1">
                  {WIDGETS.map((w) => (
                    <SettingRow
                      key={w.key}
                      id={`widget-${w.key}`}
                      icon={<LayoutGrid className="size-4" />}
                      label={w.label}
                      hint={w.hint}
                      checked={widgets.has(w.key)}
                      onChange={(v) => toggleWidget(w.key, v)}
                    />
                  ))}
                </div>

                <p className="px-1 pt-5 pb-2 font-display text-[11px] tracking-console text-muted-foreground">
                  Pages
                </p>
                <div className="space-y-2">
                  <Button asChild variant="secondary" className="w-full justify-start gap-2">
                    <Link to="/my-flights" onClick={() => setRegionsOpen(false)}>
                      <PlaneTakeoff className="size-4" /> My flights
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full justify-start gap-2">
                    <Link to="/atc" onClick={() => setRegionsOpen(false)}>
                      <ListChecks className="size-4" /> Flight plan control
                    </Link>
                  </Button>
                  {!installed && (
                    <Button
                      variant="secondary"
                      className="w-full justify-start gap-2"
                      onClick={async () => {
                        if (!canInstall) {
                          toast.info("Use your browser menu → Add to Home Screen to install ATC365.");
                          return;
                        }
                        await install();
                      }}
                    >
                      <Download className="size-4" /> Install ATC365 app
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="w-full justify-start gap-2"
                    onClick={() => void testNotification()}
                  >
                    <BellRing className="size-4" /> Send test notification
                  </Button>
                  <Button variant="secondary" className="w-full justify-start gap-2" onClick={resetTutorial}>
                    <GraduationCap className="size-4" /> Replay tutorial
                  </Button>
                </div>

                <p className="px-1 pt-5 pb-2 font-display text-[11px] tracking-console text-muted-foreground">
                  Charts
                </p>
                <div className="space-y-2">
                  <Button asChild variant="secondary" className="w-full justify-start gap-2">
                    <a href="https://aeronav.space/app" target="_blank" rel="noreferrer noopener">
                      <MapIcon className="size-4" /> AeroNav charts
                    </a>
                  </Button>
                  <Button asChild variant="secondary" className="w-full justify-start gap-2">
                    <a href="https://ptfs.app/charts" target="_blank" rel="noreferrer noopener">
                      <MapIcon className="size-4" /> PTFS.app charts
                    </a>
                  </Button>
                </div>

                {isAdmin && (
                  <Button
                    variant="secondary"
                    className="mt-4 w-full gap-2"
                    onClick={() => {
                      setRegionsOpen(false);
                      setAdminOpen(true);
                    }}
                  >
                    <Shield className="size-4" />
                    Open admin mode
                  </Button>
                )}

              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </header>

      {/* Map */}
      <main className="relative flex-1">
        <RadarMap
          focus={focus}
          flights={flights}
          selectedFlightId={selectedFlightId}
          showClouds={showClouds}
          showRoutes={showRoutes}
          showLabels={showLabels}
          atcByAirport={atcByAirport}
          atisByAirport={atisByAirport}
          onSelectFlight={(id) => {
            setSelectedAirport(null);
            setSelectedFlightId(id);
          }}
          onSelectAirport={openAirport}
          onSelectIsland={(slug) => setFocus(slug)}
          placing={placing || drawingTfr}
          tfrs={tfrs}
          onSelectTfr={(id) => setSelectedTfrId(id)}
          draftTfr={drawingTfr ? tfrDraft : undefined}
          onMapClick={(x, y) => {
            if (drawingTfr) {
              setTfrDraft((p) => [...p, { x, y }]);
              return;
            }
            setPendingPoint({ x, y });
            setPlacing(false);
            setAdminOpen(true);
            toast.success(`Position captured — ${x}, ${y}`);
          }}
        />

        {drawingTfr && (
          <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center px-3">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-destructive/60 bg-card/95 px-3 py-1.5 shadow-[var(--shadow-panel)] backdrop-blur">
              <Crosshair className="size-4 text-destructive" />
              <span className="font-display text-[11px] tracking-console text-foreground">
                Tap to add points · {tfrDraft.length}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => setTfrDraft((p) => p.slice(0, -1))}
              >
                Undo
              </Button>
              <Button
                size="sm"
                className="h-6 px-2"
                disabled={tfrDraft.length < 3}
                onClick={() => {
                  setDrawingTfr(false);
                  setAdminOpen(true);
                }}
              >
                Done
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => {
                  setDrawingTfr(false);
                  setTfrDraft([]);
                  setAdminOpen(true);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {selectedTfr && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center px-3">
            <div className="deck-surface pointer-events-auto max-w-sm animate-fade-in rounded-2xl border border-destructive/40 p-3">
              <div className="font-display text-sm tracking-console text-destructive">
                TFR · {selectedTfr.name}
              </div>
              {selectedTfr.reason && (
                <p className="mt-1 text-sm text-foreground">{selectedTfr.reason}</p>
              )}
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                {selectedTfr.min_alt}–{selectedTfr.max_alt} ft · {expiresLabel(selectedTfr, clock)}
                {selectedTfr.allowed_callsigns.length
                  ? ` · exempt: ${selectedTfr.allowed_callsigns.join(", ")}`
                  : ""}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 h-7"
                onClick={() => setSelectedTfrId(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}

        {placing && (
          <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center px-3">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-primary/60 bg-card/95 px-3 py-1.5 shadow-[var(--shadow-panel)] backdrop-blur">
              <Crosshair className="size-4 text-primary" />
              <span className="font-display text-[11px] tracking-console text-foreground">
                Tap the map to place the airport
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => {
                  setPlacing(false);
                  setAdminOpen(true);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}




        {/* Region chip */}
        <div className="pointer-events-none absolute inset-x-0 top-3 flex items-center justify-between px-3">
          <div className="pointer-events-auto flex items-center gap-2">
            {focusedIsland && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 gap-1 rounded-full"
                onClick={() => {
                  setFocus(null);
                  setSelectedAirport(null);
                }}
              >
                <ChevronLeft className="size-4" /> World
              </Button>
            )}
            <Badge className="rounded-full bg-card font-display tracking-console text-primary" variant="secondary">
              {focusedIsland ? focusedIsland.name : "All regions"}
            </Badge>
          </div>
          <Badge variant="secondary" className="rounded-full bg-card font-mono text-[11px]">
            {airborne} airborne
          </Badge>
        </div>

        <WidgetDeck
          enabled={widgets}
          flights={flights}
          now={clock}
          viewCounts={viewCounts}
          favorites={favorites}
          offsetMin={offsetMin}
          onOffsetChange={setOffsetMin}
          onSelectFlight={(id) => {
            setSelectedAirport(null);
            setSelectedFlightId(id);
          }}
        />

        {selectedFlight && (
          <FlightPanel
            flight={selectedFlight}
            aircraftImage={pickAircraftImage(
              aircraftImages?.map,
              selectedFlight.plan.aircraft,
              selectedFlight.plan.airline,
            )}
            viewers={viewCounts?.get(selectedFlight.plan.id) ?? 0}
            canFavorite={!!user}
            isFavorite={favorites.has(selectedFlight.plan.id)}
            onToggleFavorite={() => toggleFavorite.mutate(selectedFlight.plan.id)}
            isPinned={pinnedId === selectedFlight.plan.id}
            onTogglePin={() => void togglePin(selectedFlight.plan.id)}
            onOpenAcars={() => setAcarsOpen(true)}
            onClose={() => setSelectedFlightId(null)}
          />
        )}


        {selectedAirport && !selectedFlight && (
          <AirportPanel
            icao={selectedAirport}
            flights={flights}
            canEditAtis={!!user}
            isAdmin={isAdmin}
            sessions={atcByAirport?.get(selectedAirport) ?? []}
            onEditAtis={() => setAtisOpen(true)}
            onGoOnline={() => setAtcOpen(true)}
            onEditAirport={() => setAdminOpen(true)}
            onClose={() => setSelectedAirport(null)}
            onSelectFlight={(id) => {
              setSelectedAirport(null);
              setSelectedFlightId(id);
            }}
          />
        )}
      </main>

      {/* Bottom dock — hidden while a panel covers the lower half of the map */}
      {!selectedFlight && !selectedAirport && (
        <nav className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1.5 shadow-[var(--shadow-panel)] backdrop-blur">
            <DockButton icon={<Globe2 className="size-5" />} label="Regions" onClick={() => setRegionsOpen(true)} />

          <DockButton
            icon={<RouteIcon className="size-5" />}
            label="Flight plan"
            highlight
            onClick={() => {
              if (!user) {
                window.location.href = "/auth";
                return;
              }
              setPlanOpen(true);
            }}
          />
          <DockButton
            icon={<MessageSquare className="size-5" />}
            label="ACARS"
            onClick={() => {
              if (!user) {
                window.location.href = "/auth";
                return;
              }
              setAcarsOpen(true);
            }}
          />
          <DockButton
            icon={<Radio className="size-5" />}
            label="ATIS"
            onClick={() => {
              if (!user) {
                window.location.href = "/auth";
                return;
              }
              setAtisOpen(true);
            }}
          />
          <DockButton
            icon={<Headphones className="size-5" />}
            label="Claim ATC"
            onClick={() => {
              if (!user) {
                window.location.href = "/auth";
                return;
              }
              setAtcOpen(true);
            }}
          />
          </div>
        </nav>
      )}


      {user && <FlightPlanDialog open={planOpen} onOpenChange={setPlanOpen} userId={user.id} />}
      {user && (
        <AcarsDialog
          open={acarsOpen}
          onOpenChange={setAcarsOpen}
          flights={flights}
          userId={user.id}
          displayName={user.email?.split("@")[0] ?? "PILOT"}
          isAtc={isAtc}
          initialFlightId={selectedFlightId}
        />
      )}
      {user && (
        <AtcOnlineDialog
          open={atcOpen}
          onOpenChange={setAtcOpen}
          airportIcao={selectedAirport}
          userId={user.id}
        />
      )}
      {isAdmin && (
        <AdminDialog
          open={adminOpen}
          onOpenChange={setAdminOpen}
          initialIcao={selectedAirport}
          pendingPoint={pendingPoint}
          onRequestPlace={() => {
            setAdminOpen(false);
            setPlacing(true);
          }}
          tfrDraft={tfrDraft}
          onRequestDrawTfr={() => {
            setAdminOpen(false);
            setTfrDraft([]);
            setSelectedTfrId(null);
            setDrawingTfr(true);
          }}
          onClearTfrDraft={() => setTfrDraft([])}
        />
      )}
      {user && (
        <AtisDialog
          open={atisOpen}
          onOpenChange={setAtisOpen}
          airportIcao={selectedAirport}
          userId={user.id}
        />
      )}

      <Tutorial />
    </div>

  );
}

function SettingRow({
  id,
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2">
      <span className="text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="font-display text-sm tracking-console">
          {label}
        </Label>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}


function RegionRow({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border bg-secondary/60 text-foreground hover:bg-accent",
      )}
    >
      <span className="font-display text-lg leading-none">{label}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{sub}</span>
    </button>
  );
}

function DockButton({
  icon,
  label,
  onClick,
  highlight,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  highlight?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-w-[74px] flex-col items-center gap-0.5 rounded-full px-3 py-2 transition-colors",
        highlight ? "text-primary" : "text-foreground",
        disabled ? "opacity-35" : "hover:bg-accent",
      )}
    >
      {icon}
      <span className="font-display text-[10px] tracking-console">{label}</span>
    </button>
  );
}
