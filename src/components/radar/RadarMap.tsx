import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ISLANDS,
  WORLD_SIZE,
  airportsOfIsland,
  islandBySlug,
  islandOutline,
  ringToPath,
  roadNetwork,
  terrainPatches,
  type Airport,
  type Island,
} from "@/lib/world";
import type { LiveFlight } from "@/lib/flights";
import { ICON_PATHS } from "@/lib/aircraft";
import { polygonCentroid, type Pt, type Tfr } from "@/lib/tfr";

/**
 * Every aircraft is drawn with the same silhouette and the same colour so the
 * radar reads as one uniform traffic layer. Emergencies stay red.
 */
const UNIFORM_ICON = ICON_PATHS.airliner;

import { POSITIONS, type Atis, type AtcSession } from "@/lib/atc";
import { isEmergencySquawk } from "@/lib/squawk";
import { cn } from "@/lib/utils";

type Camera = { cx: number; cy: number; span: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/**
 * Deterministic scattered cumulus field, positioned in WORLD coordinates so the
 * weather layer zooms and pans with the map instead of sitting on the screen.
 * Few and widely spread, so the drift is obvious rather than a white haze.
 */
const CLOUDS = Array.from({ length: 24 }, (_, i) => {
  const r = (n: number) => {
    const s = Math.sin((i + 1) * n) * 10000;
    return s - Math.floor(s);
  };
  const w = 70 + r(12.9898) * 130;
  return {
    id: i,
    x: r(78.233) * WORLD_SIZE,
    y: r(4.1414) * WORLD_SIZE,
    w,
    h: w * (0.36 + r(19.19) * 0.22),
    opacity: 0.3 + r(39.425) * 0.3,
    drift: 26 + r(93.989) * 26,
    delay: r(11.317) * 40,
    puffs: Array.from({ length: 4 + Math.floor(r(7.77) * 3) }, (_, j) => ({
      dx: (r(3.1 + j) - 0.5) * w * 0.72,
      dy: (r(9.7 + j) - 0.5) * w * 0.2,
      rr: w * (0.16 + r(5.3 + j) * 0.2),
    })),
  };
});



function fitCamera(island: Island | null): Camera {
  if (!island) return { cx: WORLD_SIZE / 2, cy: WORLD_SIZE / 2, span: WORLD_SIZE };
  return { cx: island.x, cy: island.y, span: Math.max(island.radius * 3.2, 70) };
}

type Props = {
  focus: string | null;
  flights: LiveFlight[];
  selectedFlightId: string | null;
  onSelectFlight: (id: string | null) => void;
  onSelectAirport: (icao: string) => void;
  onSelectIsland: (slug: string) => void;
  showClouds?: boolean | undefined;
  showRoutes?: boolean | undefined;
  showLabels?: boolean | undefined;
  showAirlineLogos?: boolean | undefined;
  atcByAirport?: Map<string, AtcSession[]> | undefined;
  atisByAirport?: Map<string, Atis> | undefined;
  airlineLogos?: Map<string, string> | undefined;
  /** Admin placement mode: the next tap on the map returns world coordinates. */
  placing?: boolean | undefined;
  onMapClick?: ((x: number, y: number) => void) | undefined;
  /** Active temporary flight restrictions drawn as translucent red areas. */
  tfrs?: Tfr[] | undefined;
  onSelectTfr?: ((id: string) => void) | undefined;
  /** Polygon currently being drawn by an admin. */
  draftTfr?: Pt[] | undefined;
};

export function RadarMap({
  focus,
  flights,
  selectedFlightId,
  onSelectFlight,
  onSelectAirport,
  onSelectIsland,
  showClouds = false,
  showRoutes = true,
  showLabels = true,
  showAirlineLogos = false,
  atcByAirport,
  atisByAirport,
  airlineLogos,
  placing = false,
  onMapClick,
  tfrs,
  onSelectTfr,
  draftTfr,
}: Props) {


  const island = focus ? (islandBySlug(focus) ?? null) : null;
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 800 });
  const [cam, setCam] = useState<Camera>(() => fitCamera(island));
  const camRef = useRef(cam);
  camRef.current = cam;
  const animRef = useRef<number | null>(null);

  /* ---------------- container size ---------------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(width, 1), h: Math.max(height, 1) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------------- smooth camera flight ---------------- */
  const flyTo = useCallback((target: Camera, duration = 900) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const from = { ...camRef.current };
    const start = performance.now();
    const tick = (now: number) => {
      const t = clamp01((now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      // Interpolate zoom logarithmically so the transition feels even.
      const span = from.span * Math.pow(target.span / from.span, e);
      setCam({
        cx: from.cx + (target.cx - from.cx) * e,
        cy: from.cy + (target.cy - from.cy) * e,
        span,
      });
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    flyTo(fitCamera(island));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  const fitSpan = fitCamera(island).span;
  // Zooming is never gated on picking an island first: the world view can be
  // zoomed all the way down into any island and the detail layer follows.
  const minSpan = 8;
  const maxSpan = WORLD_SIZE * 1.25;

  /* ---------------- wheel zoom (non-passive) ---------------- */
  const handleWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  handleWheelRef.current = (e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const current = camRef.current;
    const next = clamp(current.span * Math.exp(dy * 0.0018), minSpan, maxSpan);
    if (next === current.span) return;
    const scale = current.span / Math.min(rect.width, rect.height);
    const p = unrotate(e.clientX - rect.left - rect.width / 2, e.clientY - rect.top - rect.height / 2);
    const wx = current.cx + p.x * scale;
    const wy = current.cy + p.y * scale;
    const k = next / current.span;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setCam({ cx: wx + (current.cx - wx) * k, cy: wy + (current.cy - wy) * k, span: next });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleWheelRef.current(e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ---------------- pointer pan + pinch ---------------- */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; span: number; angle: number; rot: number } | null>(null);
  const dragged = useRef(false);
  const [rot, setRot] = useState(0);
  const rotRef = useRef(0);
  rotRef.current = rot;

  /** Screen delta -> world delta, accounting for the current map rotation. */
  const unrotate = (dx: number, dy: number) => {
    const a = (-rotRef.current * Math.PI) / 180;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  };

  const scaleOf = (c: Camera) => c.span / Math.min(size.w, size.h);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    if (animRef.current) cancelAnimationFrame(animRef.current);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];

    if (pts.length >= 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      if (!pinchRef.current)
        pinchRef.current = { dist, span: camRef.current.span, angle, rot: rotRef.current };
      else {
        // Capture now: the state updater runs later, by which time a pointerup
        // may already have cleared pinchRef.
        const base = pinchRef.current;
        const ratio = base.dist / Math.max(dist, 1);
        const nextSpan = clamp(base.span * ratio, minSpan, maxSpan);
        setCam((c) => ({ ...c, span: nextSpan }));
        // Two-finger twist rotates the map.
        let delta = angle - base.angle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        setRot(((base.rot + delta) % 360 + 360) % 360);
      }

      dragged.current = true;
      return;
    }

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged.current = true;
    const s = scaleOf(camRef.current);
    const w = unrotate(dx, dy);
    setCam((c) => ({ ...c, cx: c.cx - w.x * s, cy: c.cy - w.y * s }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
  };

  /* ---------------- derived render state ---------------- */
  const scale = scaleOf(cam);
  const viewW = size.w * scale;
  const viewH = size.h * scale;
  const viewBox = `${cam.cx - viewW / 2} ${cam.cy - viewH / 2} ${viewW} ${viewH}`;

  /**
   * 0 = schematic overview, 1 = full high-resolution detail. Purely a function
   * of how close the camera is to an island, so detail mode kicks in on zoom
   * without ever having to select the island first.
   */
  const detailFor = useCallback((isl: Island) => {
    const fit = Math.max(isl.radius * 3.2, 70);
    return clamp01((fit - cam.span) / (fit * 0.45));
  }, [cam.span]);

  const detailT = island ? detailFor(island) : Math.max(0, ...ISLANDS.map(detailFor));
  const labelScale = cam.span / 1000;

  /**
   * Buttons should get EASIER to hit as you zoom in, so markers grow on screen
   * rather than staying pinned to a constant size.
   */
  const baseSpan = island ? fitSpan : WORLD_SIZE;
  const growth = clamp(Math.pow(baseSpan / Math.max(cam.span, 1), 0.5), 1, 3);
  const markerScale = labelScale * growth;

  // Always render every island: zoom, not selection, decides the detail level.
  const visibleIslands = ISLANDS;

  const handleMapClick = (e: React.MouseEvent) => {
    if (!placing || !onMapClick || dragged.current) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = scaleOf(camRef.current);
    const p = unrotate(e.clientX - rect.left - rect.width / 2, e.clientY - rect.top - rect.height / 2);
    const wx = camRef.current.cx + p.x * s;
    const wy = camRef.current.cy + p.y * s;
    onMapClick(Math.round(wx * 10) / 10, Math.round(wy * 10) / 10);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full touch-none overflow-hidden bg-ocean select-none",
        placing && "cursor-crosshair",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={handleMapClick}
    >

      <svg
        viewBox={viewBox}
        className="absolute inset-0 h-full w-full"
        style={{ cursor: "grab" }}
      >
        <defs>
          <radialGradient id="oceanGrad" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#10405f" />
            <stop offset="55%" stopColor="#0a2d47" />
            <stop offset="100%" stopColor="#051a2c" />
          </radialGradient>
          {/* Rolling in-game style swell */}
          <filter id="waterSwell" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 1.6" numOctaves={3} seed={7} result="noise" />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.15  0 0 0 0 0.42  0 0 0 0 0.62  0 0 0 0.35 0"
            />
          </filter>
          <filter id="waterSparkle" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves={2} seed={19} result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale={cam.span * 0.02} />
          </filter>
          <filter id="coastBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={Math.max(cam.span * 0.004, 0.4)} />
          </filter>
          <filter id="cloudBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={Math.max(cam.span * 0.006, 1.2)} />
          </filter>

        </defs>

        <g transform={`rotate(${rot} ${cam.cx} ${cam.cy})`}>
        <rect
          x={cam.cx - viewW}
          y={cam.cy - viewH}
          width={viewW * 2}
          height={viewH * 2}
          fill="url(#oceanGrad)"
        />
        {/* Water surface texture */}
        <rect
          x={cam.cx - viewW}
          y={cam.cy - viewH}
          width={viewW * 2}
          height={viewH * 2}
          filter="url(#waterSwell)"
          opacity={0.5}
          className="pointer-events-none water-drift"
        />

        {visibleIslands.map((isl) => (
          <IslandLayer
            key={isl.slug}
            island={isl}
            detailT={detailFor(isl)}
            labelScale={labelScale}
            markerScale={markerScale}
            focused={island?.slug === isl.slug}
            onSelectIsland={onSelectIsland}
            onSelectAirport={onSelectAirport}
            dragged={dragged}
            atcByAirport={atcByAirport}
            atisByAirport={atisByAirport}
          />
        ))}


        {/* Flight tracks for the selected flight */}
        {flights
          .filter((f) => showRoutes && f.plan.id === selectedFlightId)

          .map((f) => (
            <g key={`trk-${f.plan.id}`}>
              <polyline
                points={f.path.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={labelScale * 1.6}
                strokeDasharray={`${labelScale * 6} ${labelScale * 5}`}
                opacity={0.45}
              />
              <line
                x1={f.dep.x}
                y1={f.dep.y}
                x2={f.x}
                y2={f.y}
                stroke="var(--primary)"
                strokeWidth={labelScale * 2}
                opacity={0.9}
              />
            </g>
          ))}

        {/* Temporary flight restrictions */}
        {(tfrs ?? []).map((t) =>
          t.points.length >= 3 ? (
            <g key={`tfr-${t.id}`}>
              <polygon
                points={t.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="#ef4444"
                fillOpacity={0.22}
                stroke="#ef4444"
                strokeWidth={labelScale * 1.6}
                strokeDasharray={`${labelScale * 5} ${labelScale * 4}`}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!dragged.current) onSelectTfr?.(t.id);
                }}
              />
              {showLabels && (
                <text
                  x={polygonCentroid(t.points).x}
                  y={polygonCentroid(t.points).y}
                  textAnchor="middle"
                  className="pointer-events-none font-display"
                  fill="#fecaca"
                  fontSize={labelScale * 11}
                >
                  TFR · {t.name}
                </text>
              )}
            </g>
          ) : null,
        )}

        {/* Polygon being drawn by an admin */}
        {draftTfr && draftTfr.length > 0 && (
          <g className="pointer-events-none">
            <polygon
              points={draftTfr.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="#ef4444"
              fillOpacity={draftTfr.length > 2 ? 0.16 : 0}
              stroke="#fca5a5"
              strokeWidth={labelScale * 1.4}
            />
            {draftTfr.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={labelScale * 3} fill="#fca5a5" />
            ))}
          </g>
        )}

        {flights.map((f) => (
          <FlightMarker
            key={f.plan.id}
            flight={f}
            labelScale={markerScale}
            showLabel={showLabels}
            logoUrl={
              showAirlineLogos && f.plan.airline
                ? (airlineLogos?.get(f.plan.airline) ?? null)
                : null
            }
            airlineTag={showAirlineLogos ? (f.plan.airline ?? null) : null}
            selected={f.plan.id === selectedFlightId}
            onSelect={() => {
              if (!dragged.current) onSelectFlight(f.plan.id === selectedFlightId ? null : f.plan.id);
            }}
          />
        ))}


        {/* Weather layer — world-anchored, so it zooms and pans with the map */}
        {showClouds && (
          <g className="pointer-events-none" filter="url(#cloudBlur)">
            {CLOUDS.map((c) => (
              <g
                key={c.id}
                className="cloud-drift-svg"
                style={{
                  animationDuration: `${c.drift}s`,
                  animationDelay: `-${c.delay}s`,
                  opacity: c.opacity,
                }}
              >
                <g transform={`translate(${c.x} ${c.y})`}>
                  <ellipse rx={c.w / 2} ry={c.h / 2} fill="#ffffff" opacity={0.7} />
                  {c.puffs.map((p, i) => (
                    <circle key={i} cx={p.dx} cy={p.dy} r={p.rr} fill="#ffffff" opacity={0.75} />
                  ))}
                </g>
              </g>
            ))}
          </g>
        )}
        </g>
      </svg>




      {/* Compass — tap to snap back to north (zoom/rotate use touch or wheel) */}
      {Math.abs(rot) > 0.5 && (
        <button
          aria-label="Reset map rotation to north"
          title={`Heading up ${Math.round(rot)}° — tap for north up`}
          className="deck-surface animate-fade-in absolute right-3 bottom-28 flex size-11 flex-col items-center justify-center rounded-full text-foreground"
          onClick={() => setRot(0)}
        >
          <span
            className="text-base leading-none text-primary transition-transform duration-200"
            style={{ transform: `rotate(${rot}deg)` }}
          >
            ↑
          </span>
          <span className="font-display text-[9px] tracking-console text-muted-foreground">N</span>
        </button>
      )}

      {detailT > 0.02 && (
        <div className="deck-surface animate-fade-in pointer-events-none absolute bottom-28 left-3 rounded-xl px-2.5 py-1.5">
          <div className="font-display text-[11px] tracking-console text-muted-foreground">
            Detail
          </div>
          <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${Math.round(detailT * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function IslandLayer({
  island,
  detailT,
  labelScale,
  markerScale,
  focused,
  onSelectIsland,
  onSelectAirport,
  dragged,
  atcByAirport,
  atisByAirport,
}: {
  island: Island;
  detailT: number;
  labelScale: number;
  markerScale: number;
  focused: boolean;
  onSelectIsland: (slug: string) => void;
  onSelectAirport: (icao: string) => void;
  dragged: React.RefObject<boolean>;
  atcByAirport?: Map<string, AtcSession[]> | undefined;
  atisByAirport?: Map<string, Atis> | undefined;
}) {


  const path = useMemo(() => ringToPath(islandOutline(island)), [island]);
  const patches = useMemo(() => terrainPatches(island), [island]);
  const roads = useMemo(() => roadNetwork(island), [island]);
  const ports = useMemo(() => airportsOfIsland(island.slug), [island]);

  const base =
    island.terrain === "dry"
      ? "var(--land-dry)"
      : island.terrain === "vessel"
        ? "var(--tarmac)"
        : "var(--land)";

  // Real cut-out imagery: fit the image so its longest side spans the island.
  const boxMax = island.radius * 2.2;
  const aspect = island.imageAspect ?? 1;
  const imgW = aspect >= 1 ? boxMax : boxMax * aspect;
  const imgH = aspect >= 1 ? boxMax / aspect : boxMax;

  if (island.image) {
    return (
      <g>
        <image
          href={island.image}
          x={island.x - imgW / 2}
          y={island.y - imgH / 2}
          width={imgW}
          height={imgH}
          preserveAspectRatio="xMidYMid meet"
          className="cursor-pointer"
          style={{ imageRendering: detailT > 0.5 ? "auto" : "auto" }}
          onClick={() => {
            if (!dragged.current && !focused && detailT < 0.3) onSelectIsland(island.slug);
          }}
        />

        {(focused || detailT > 0.15 ? ports : ports.filter((p) => p.major)).map((p) => (
          <AirportMarker
            key={p.icao}
            airport={p}
            labelScale={markerScale}
            showLabel={focused || detailT > 0.2}
            sessions={atcByAirport?.get(p.icao) ?? []}
            atisLetter={atisByAirport?.get(p.icao)?.letter ?? null}
            onClick={() => {
              if (!dragged.current) onSelectAirport(p.icao);
            }}
          />
        ))}


        {!focused && (
          <text
            x={island.x}
            y={island.y + imgH / 2 + labelScale * 16}
            textAnchor="middle"
            fill="var(--primary)"
            fontSize={labelScale * 15}
            className="pointer-events-none font-display"
            style={{ paintOrder: "stroke", stroke: "var(--ocean-deep)", strokeWidth: labelScale * 3 }}
          >
            {island.name}
          </text>
        )}
      </g>
    );
  }

  return (
    <g>
      {/* Shallow water halo */}
      <path d={path} fill="var(--land-dry)" opacity={0.22} transform={`translate(0 ${labelScale})`} filter="url(#coastBlur)" />
      <path
        d={path}
        fill={base}
        stroke="var(--ocean-deep)"
        strokeWidth={labelScale * 0.6}
        className="cursor-pointer"
        onClick={() => {
          if (!dragged.current && !focused && detailT < 0.3) onSelectIsland(island.slug);
        }}
      />

      {/* Terrain detail, crossfaded in on zoom */}
      <g opacity={detailT} style={{ transition: "opacity 120ms linear" }}>
        <clipPath id={`clip-${island.slug}`}>
          <path d={path} />
        </clipPath>
        <g clipPath={`url(#clip-${island.slug})`}>
          {patches.map((p, i) => (
            <rect
              key={i}
              x={p.x - p.w / 2}
              y={p.y - p.h / 2}
              width={p.w}
              height={p.h}
              rx={p.w * 0.08}
              transform={`rotate(${p.rot} ${p.x} ${p.y})`}
              fill={p.tone > 0.65 ? "var(--land-dry)" : p.tone > 0.3 ? "var(--land-hi)" : "var(--land)"}
              opacity={0.75}
            />
          ))}
          {roads.map((r, i) => (
            <line
              key={i}
              x1={r.x1}
              y1={r.y1}
              x2={r.x2}
              y2={r.y2}
              stroke="var(--tarmac)"
              strokeWidth={island.radius * 0.012}
              opacity={0.7}
            />
          ))}
          {ports.map((p) => (
            <g key={`rwy-${p.icao}`} transform={`rotate(${p.runway} ${p.x} ${p.y})`}>
              <rect
                x={p.x - island.radius * 0.16}
                y={p.y - island.radius * 0.012}
                width={island.radius * 0.32}
                height={island.radius * 0.024}
                fill="var(--tarmac)"
              />
            </g>
          ))}
        </g>
      </g>


      {/* Airport markers */}
      {(focused || detailT > 0.15 ? ports : ports.filter((p) => p.major)).map((p) => (
        <AirportMarker
          key={p.icao}
          airport={p}
          labelScale={markerScale}
          showLabel={focused || detailT > 0.2}
          sessions={atcByAirport?.get(p.icao) ?? []}
          atisLetter={atisByAirport?.get(p.icao)?.letter ?? null}
          onClick={() => {
            if (!dragged.current) onSelectAirport(p.icao);
          }}
        />
      ))}


      {!focused && (
        <text
          x={island.x}
          y={island.y + island.radius + labelScale * 16}
          textAnchor="middle"
          fill="var(--primary)"
          fontSize={labelScale * 15}
          className="pointer-events-none font-display"
          style={{ paintOrder: "stroke", stroke: "var(--ocean-deep)", strokeWidth: labelScale * 3 }}
        >
          {island.name}
        </text>
      )}
    </g>
  );
}

function AirportMarker({
  airport,
  labelScale,
  showLabel,
  sessions = [],
  atisLetter = null,
  onClick,
}: {
  airport: Airport;
  labelScale: number;
  showLabel: boolean;
  sessions?: AtcSession[];
  atisLetter?: string | null;
  onClick: () => void;
}) {
  const r = labelScale * 5;

  /** Always-visible status: online ATC positions plus the current ATIS letter. */
  const chips = [
    ...POSITIONS.filter((p) => sessions.some((s) => s.position === p.key)).map((p) => ({
      key: p.key as string,
      short: p.short,
      atis: false,
    })),
    ...(atisLetter ? [{ key: "atis", short: atisLetter, atis: true }] : []),
  ];

  const box = labelScale * 9;
  const gap = labelScale * 2;
  const totalW = chips.length * box + Math.max(chips.length - 1, 0) * gap;

  // The airport "button": a pill carrying the name, easy to hit at any zoom.
  const padX = labelScale * 5;
  const fs = labelScale * 11;
  const pillW = Math.max(airport.icao.length, 4) * fs * 0.62 + padX * 2;
  const pillH = fs * 1.7;

  return (
    <g className="cursor-pointer" onClick={onClick}>
      {/* Generous invisible hit area */}
      <rect
        x={airport.x - Math.max(pillW, totalW) / 2 - labelScale * 4}
        y={airport.y - pillH - labelScale * 6}
        width={Math.max(pillW, totalW) + labelScale * 8}
        height={pillH + box + labelScale * 16}
        fill="transparent"
      />

      <circle
        cx={airport.x}
        cy={airport.y}
        r={r}
        fill="var(--primary)"
        stroke="var(--ocean-deep)"
        strokeWidth={labelScale * 1.2}
      />

      {/* Airport button */}
      <g>
        <rect
          x={airport.x - pillW / 2}
          y={airport.y - pillH - labelScale * 3}
          width={pillW}
          height={pillH}
          rx={pillH / 2}
          fill="var(--card)"
          stroke="var(--primary)"
          strokeWidth={labelScale * 0.9}
          opacity={0.96}
        />
        <text
          x={airport.x}
          y={airport.y - pillH / 2 - labelScale * 2.4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--primary)"
          fontSize={fs}
          className="pointer-events-none font-display font-semibold"
        >
          {airport.icao}
        </text>
      </g>

      {/* ATC positions online + ATIS letter, rendered under the button */}
      {chips.map((c, i) => {
        const x = airport.x - totalW / 2 + i * (box + gap);
        const y = airport.y + r * 1.6;
        return (
          <g key={c.key}>
            <rect
              x={x}
              y={y}
              width={box}
              height={box}
              rx={box * 0.2}
              fill={c.atis ? "var(--primary)" : "#2ecc71"}
              stroke="var(--ocean-deep)"
              strokeWidth={labelScale * 0.6}
            />
            <text
              x={x + box / 2}
              y={y + box * 0.74}
              textAnchor="middle"
              fontSize={box * 0.7}
              fill="#04121f"
              className="pointer-events-none font-display font-bold"
            >
              {c.short}
            </text>
          </g>
        );
      })}

      {showLabel && (
        <text
          x={airport.x}
          y={airport.y + r * 1.6 + (chips.length ? box + labelScale * 10 : labelScale * 8)}
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize={labelScale * 9}
          className="pointer-events-none font-display"
          style={{ paintOrder: "stroke", stroke: "var(--ocean-deep)", strokeWidth: labelScale * 2.4 }}
        >
          {airport.name}
        </text>
      )}
    </g>
  );
}

function FlightMarker({
  flight,
  labelScale,
  selected,
  showLabel = true,
  logoUrl = null,
  airlineTag = null,
  onSelect,
}: {
  flight: LiveFlight;
  labelScale: number;
  selected: boolean;
  showLabel?: boolean;
  logoUrl?: string | null;
  airlineTag?: string | null;
  onSelect: () => void;
}) {
  // One silhouette, one colour for every aircraft type.
  const icon = UNIFORM_ICON;
  const s = labelScale * 1.1 * icon.scale;
  const emergency = isEmergencySquawk(flight.plan.squawk);
  const color = emergency ? "var(--destructive)" : "var(--airborne)";
  const rotate = flight.heading;

  const badgeH = labelScale * 11;
  const tag = airlineTag ? airlineTag.slice(0, 14) : null;
  const badgeW = tag ? Math.max(tag.length * badgeH * 0.42 + badgeH * 0.6, badgeH * 2) : 0;

  return (
    <g className="cursor-pointer" onClick={onSelect}>
      <circle cx={flight.x} cy={flight.y} r={labelScale * 16} fill="transparent" />

      {emergency && (
        <circle
          cx={flight.x}
          cy={flight.y}
          r={labelScale * 15}
          fill="var(--destructive)"
          opacity={0.22}
          className="animate-radar-ping"
        />
      )}

      <g transform={`translate(${flight.x} ${flight.y}) rotate(${rotate}) scale(${s})`}>
        {selected && <circle r={15} fill="var(--primary)" opacity={0.18} />}
        <path d={icon.d} fill={color} stroke="var(--ocean-deep)" strokeWidth={0.7} />
      </g>

      {/* Airline livery marker above the aircraft */}
      {logoUrl ? (
        <image
          href={logoUrl}
          x={flight.x - badgeH}
          y={flight.y - labelScale * 16 - badgeH}
          width={badgeH * 2}
          height={badgeH}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none"
        />
      ) : tag ? (
        <g className="pointer-events-none">
          <rect
            x={flight.x - badgeW / 2}
            y={flight.y - labelScale * 16 - badgeH}
            width={badgeW}
            height={badgeH}
            rx={badgeH * 0.25}
            fill="var(--card)"
            opacity={0.9}
          />
          <text
            x={flight.x}
            y={flight.y - labelScale * 16 - badgeH * 0.26}
            textAnchor="middle"
            fontSize={badgeH * 0.66}
            fill="var(--primary)"
            className="font-display"
          >
            {tag}
          </text>
        </g>
      ) : null}

      {(showLabel || selected) && (
        <text
          x={flight.x}
          y={flight.y + labelScale * 20}
          textAnchor="middle"
          fill={emergency ? "var(--destructive)" : selected ? "var(--primary)" : "var(--foreground)"}
          fontSize={labelScale * 10}
          className={cn("pointer-events-none font-mono")}
          style={{ paintOrder: "stroke", stroke: "var(--ocean-deep)", strokeWidth: labelScale * 2.4 }}
        >
          {flight.plan.callsign}
        </text>
      )}
    </g>
  );
}
