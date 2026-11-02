import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";

/** Gate every app page behind a Discord sign-in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [guest, setGuest] = useState<boolean | null>(null);
  useEffect(() => setGuest(localStorage.getItem("atc365-guest") === "1"), []);

  useEffect(() => {
    if (guest === null) return;
    if (guest) return;
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate, guest]);

  if (guest) return <>{children}</>;
  if (loading || !user) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4">
        <Logo className="h-12" alt="ATC365" />
        <p className="font-display text-xs tracking-console text-muted-foreground">
          {loading ? "Checking your clearance…" : "Sign in with Discord to continue"}
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
