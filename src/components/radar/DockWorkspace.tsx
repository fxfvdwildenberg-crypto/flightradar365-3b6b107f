import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type IDockviewPanelProps, type IDockviewPanelHeaderProps, type IDockviewHeaderActionsProps } from "dockview-react";
import { GripVertical, Radar, Plane, Radio, Move, RotateCcw, Columns2, Rows2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type PanelId = "radar" | "flights" | "airports";
const titles = { radar: "Radar", flights: "Active flights", airports: "Airports" };
const icons = { radar: Radar, flights: Plane, airports: Radio };
const Content = createContext<Record<PanelId, ReactNode>>({ radar: null, flights: null, airports: null });
function Panel({ api }: IDockviewPanelProps) {
  const content = useContext(Content);
  return <div className="h-full min-h-0 overflow-hidden" data-workspace-panel={api.id}>{content[api.id as PanelId]}</div>;
}
function Tab({ api }: IDockviewPanelHeaderProps) {
  const Icon = icons[api.id as PanelId];
  return <div className="flex h-full items-center gap-2 px-3" data-workspace-tab={api.id}><GripVertical className="size-3 shrink-0 opacity-50" /><Icon className="size-3.5 shrink-0" /><span className="whitespace-nowrap text-xs font-medium">{api.title}</span></div>;
}
function Placement({ activePanel, containerApi }: IDockviewHeaderActionsProps) {
  const move = (position: "left" | "right" | "top" | "bottom" | "center") => {
    if (!activePanel) return;
    const other = containerApi.panels.find(p => p.id === "radar" && p.id !== activePanel.id) ?? containerApi.panels.find(p => p.id !== activePanel.id);
    if (!other) return;
    activePanel.api.moveTo({ group: other.api.group, position });
    activePanel.api.setActive();
  };
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Move ${activePanel?.title ?? "tab"}`} title="Move tab"><Move className="size-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent className="radar-workspace" align="end">
    <DropdownMenuItem onSelect={() => move("left")}><Columns2 />Dock left</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => move("right")}><Columns2 />Dock right</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => move("top")}><Rows2 />Dock top</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => move("bottom")}><Rows2 />Dock bottom</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => move("center")}><Layers />Group as tabs</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>;
}
const components = { panel: Panel };
const tabComponents = { tab: Tab };

export default function DockWorkspace({ radar, flights, airports, selection }: { radar: ReactNode; flights: ReactNode; airports: ReactNode; selection: string | null }) {
  const apiRef = useRef<DockviewApi | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const [active, setActive] = useState("radar");
  const storageKey = useRef("atc365:workspace-desktop-v1");
  const defaults = (api: DockviewApi) => {
    api.clear();
    const mobile = window.innerWidth < 768;
    api.addPanel({ id: "radar", component: "panel", tabComponent: "tab", title: titles.radar, renderer: "always" });
    api.addPanel({ id: "flights", component: "panel", tabComponent: "tab", title: titles.flights, position: { referencePanel: "radar", direction: mobile ? "within" : "left" }, initialWidth: 300, inactive: true });
    api.addPanel({ id: "airports", component: "panel", tabComponent: "tab", title: titles.airports, position: { referencePanel: "flights", direction: "within" }, inactive: true });
    api.getPanel("radar")?.api.setActive();
  };
  const onReady = ({ api }: DockviewReadyEvent) => {
    apiRef.current = api;
    storageKey.current = window.innerWidth < 768 ? "atc365:workspace-mobile-v1" : "atc365:workspace-desktop-v1";
    try {
      const raw = localStorage.getItem(storageKey.current);
      if (raw) {
        const saved = JSON.parse(raw);
        api.fromJSON(saved);
        if (api.panels.length !== 3 || !Object.keys(titles).every(id => api.getPanel(id))) defaults(api);
      } else defaults(api);
    } catch { defaults(api); }
    setActive(api.activePanel?.id ?? "radar");
    const layout = api.onDidLayoutChange(() => {
      try { localStorage.setItem(storageKey.current, JSON.stringify(api.toJSON())); } catch { /* Storage may be unavailable. */ }
    });
    const activation = api.onDidActivePanelChange(panel => setActive(panel?.id ?? "radar"));
    cleanup.current = () => { layout.dispose(); activation.dispose(); };
  };
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => { if (selection) apiRef.current?.getPanel("radar")?.api.setActive(); }, [selection]);
  return <Content.Provider value={{ radar, flights, airports }}>
    <section className="flex min-h-0 flex-1 flex-col gap-2" aria-label="Dockable workspace">
      <div className="flex shrink-0 items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">{(Object.keys(titles) as PanelId[]).map(id => {
          const Icon = icons[id];
          return <Button key={id} variant="ghost" size="sm" aria-pressed={active === id} onClick={() => apiRef.current?.getPanel(id)?.api.setActive()} className={active === id ? "bg-secondary text-primary" : "text-muted-foreground"}><Icon className="size-3.5" /><span className="text-[11px] sm:text-xs">{titles[id]}</span></Button>;
        })}</div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground" aria-label="Reset workspace layout" title="Reset layout" onClick={() => { if (apiRef.current) defaults(apiRef.current); }}><RotateCcw className="size-3.5" /></Button>
      </div>
      <DockviewReact className="radar-dock min-h-0 flex-1" components={components} tabComponents={tabComponents} rightHeaderActionsComponent={Placement} onReady={onReady} disableFloatingGroups />
    </section>
  </Content.Provider>;
}