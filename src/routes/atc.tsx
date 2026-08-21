import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatHm, type FlightPlan } from "@/lib/flights";
import { isValidSquawk, QUICK_SQUAWKS } from "@/lib/squawk";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TITLE = "ATC365 — Flight Plan Control";
const DESCRIPTION =
  "Controllers review filed flight plans, approve or deny them and assign transponder squawk codes.";

export const Route = createFileRoute("/atc")({
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
  component: AtcPage,
});

function AtcPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: plans = [] } = useQuery({
    queryKey: ["flight_plans"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_plans")
        .select("*")
        .order("dep_time", { ascending: true });
      if (error) throw error;
      return data as FlightPlan[];
    },
  });

  const review = useMutation({
    mutationFn: async (patch: { id: string } & Partial<FlightPlan>) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("flight_plans").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flight_plans"] });
      toast.success("Flight plan updated");
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
        <h1 className="font-display text-lg tracking-console text-primary">Flight plan control</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 p-3">
        {!user && (
          <p className="rounded-md border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary underline">
              Sign in
            </Link>{" "}
            as a controller to approve or deny flight plans.
          </p>
        )}
        {plans.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No flight plans filed.</p>
        )}
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} canReview={!!user} onReview={(patch) => review.mutate({ id: p.id, ...patch })} />
        ))}
      </main>
    </div>
  );
}

function PlanCard({
  plan,
  canReview,
  onReview,
}: {
  plan: FlightPlan;
  canReview: boolean;
  onReview: (patch: Partial<FlightPlan>) => void;
}) {
  const [squawk, setSquawk] = useState(plan.squawk ?? "2000");

  const rows: [string, string][] = [
    ["CALLSIGN", plan.callsign],
    ["AIRCRAFT", plan.aircraft],
    ["FROM", plan.dep_icao],
    ["TO", plan.arr_icao],
    ["ALTERNATE", plan.alternate_icao || "—"],
    ["CRUISE", `FL${String(Math.round(plan.cruise_alt / 100)).padStart(3, "0")} / ${plan.cruise_speed} kt`],
    ["ROUTE", plan.route?.trim() || "DCT"],
  ];

  const statusTone =
    plan.atc_status === "approved"
      ? "bg-[#2ecc71] text-[#04121f]"
      : plan.atc_status === "denied"
        ? "bg-destructive text-destructive-foreground"
        : "bg-secondary text-muted-foreground";

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl text-primary">{plan.callsign}</h2>
        <Badge className={cn("rounded-full font-mono text-[10px] uppercase", statusTone)}>
          {plan.atc_status}
        </Badge>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {formatHm(plan.dep_time)} → {formatHm(plan.arr_time)}
        </span>
      </div>

      <dl className="mt-3 space-y-1 font-mono text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">{k}:</dt>
            <dd className="min-w-0 break-words text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      {canReview && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-2">
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
                onReview({ squawk });
              }}
            >
              Assign squawk
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_SQUAWKS.map((c) => (
              <Button key={c} size="sm" variant="ghost" className="h-7 font-mono text-xs" onClick={() => setSquawk(c)}>
                {c}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => onReview({ atc_status: "approved" })}>
              <Check className="mr-1.5 size-4" /> Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => onReview({ atc_status: "denied" })}
            >
              <X className="mr-1.5 size-4" /> Deny
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
