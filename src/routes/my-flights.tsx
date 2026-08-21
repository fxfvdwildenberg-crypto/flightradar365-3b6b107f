import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Trash2, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatHm, type FlightPlan } from "@/lib/flights";
import { isValidSquawk, QUICK_SQUAWKS, squawkInfo } from "@/lib/squawk";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const TITLE = "ATC365 — My Flights";
const DESCRIPTION =
  "Review your filed ATC365 flight plans, follow their control status and change your transponder squawk code.";

export const Route = createFileRoute("/my-flights")({
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
  component: MyFlightsPage,
});

function MyFlightsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: plans = [] } = useQuery({
    queryKey: ["my_flight_plans", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_plans")
        .select("*")
        .eq("user_id", user!.id)
        .order("dep_time", { ascending: false });
      if (error) throw error;
      return data as FlightPlan[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, squawk }: { id: string; squawk: string }) => {
      const { error } = await supabase.from("flight_plans").update({ squawk }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_flight_plans", user?.id] });
      qc.invalidateQueries({ queryKey: ["flight_plans"] });
      toast.success("Squawk updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flight_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_flight_plans", user?.id] });
      qc.invalidateQueries({ queryKey: ["flight_plans"] });
      toast.success("Flight plan deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
        <Button asChild variant="ghost" size="icon" aria-label="Back to radar">
          <Link to="/">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <Logo className="h-8" />
        <h1 className="font-display text-lg tracking-console text-primary">My flights</h1>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 p-3">
        {!user && (
          <p className="rounded-md border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary underline">
              Sign in
            </Link>{" "}
            to see the flight plans you filed.
          </p>
        )}
        {user && plans.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">You have not filed a flight plan yet.</p>
        )}
        {plans.map((p) => (
          <MyPlanCard
            key={p.id}
            plan={p}
            onSquawk={(squawk) => update.mutate({ id: p.id, squawk })}
            onDelete={() => remove.mutate(p.id)}
          />
        ))}
      </main>
    </div>
  );
}

function MyPlanCard({
  plan,
  onSquawk,
  onDelete,
}: {
  plan: FlightPlan;
  onSquawk: (squawk: string) => void;
  onDelete: () => void;
}) {
  const [squawk, setSquawk] = useState(plan.squawk ?? "2000");
  const info = squawkInfo(squawk);

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl text-primary">{plan.callsign}</h2>
        <Badge variant="secondary" className="font-mono text-[10px] uppercase">
          {plan.atc_status}
        </Badge>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {plan.dep_icao} → {plan.arr_icao}
        </span>
      </div>

      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {formatHm(plan.dep_time)} → {formatHm(plan.arr_time)} · {plan.aircraft} · FL
        {String(Math.round(plan.cruise_alt / 100)).padStart(3, "0")} · {plan.cruise_speed} kt
      </p>

      {plan.atc_note && (
        <p className="mt-2 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm">{plan.atc_note}</p>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <Input
          value={squawk}
          onChange={(e) => setSquawk(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className="h-9 w-24 font-mono"
          aria-label="Squawk code"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (!isValidSquawk(squawk)) {
              toast.error("Squawk must be 4 digits, 0-7");
              return;
            }
            onSquawk(squawk);
          }}
        >
          Set squawk
        </Button>
        <Button size="icon" variant="ghost" className="ml-auto" onClick={onDelete} aria-label="Delete flight plan">
          <Trash2 className="size-4" />
        </Button>
      </div>

      {info && (
        <p className={info.emergency ? "mt-2 flex items-center gap-1.5 text-sm text-destructive" : "mt-2 text-xs text-muted-foreground"}>
          {info.emergency && <TriangleAlert className="size-4" />}
          <span>
            {info.label} — {info.description}
          </span>
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {QUICK_SQUAWKS.map((c) => (
          <Button key={c} size="sm" variant="ghost" className="h-7 font-mono text-xs" onClick={() => setSquawk(c)}>
            {c}
          </Button>
        ))}
      </div>
    </section>
  );
}
