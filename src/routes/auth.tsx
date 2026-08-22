import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const TITLE = "Sign in — ATC365 Radar";
const DESCRIPTION =
  "Sign in with Discord to use ATC365: file flight plans, appear on the live island radar, and publish ATIS as ATC.";

export const Route = createFileRoute("/auth")({
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
  component: AuthPage,
});

function AuthPage() {
  const { user, roles, isAdmin, signOut } = useAuth();

  // Surface an access-denied reason handed back by the Discord callback.
  useEffect(() => {
    const denied = new URLSearchParams(window.location.search).get("denied");
    if (denied) {
      toast.error(denied);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const discord = () => {
    window.location.href = "/api/public/auth/discord/start";
  };

  if (user) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="panel w-full max-w-sm rounded-xl p-6 text-center">
          <Logo className="mx-auto h-12" />
          <h1 className="mt-4 font-display text-2xl text-primary text-glow">Signed in</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Roles: {roles.length ? roles.join(", ") : "pilot"}
            {isAdmin ? " · admin panel unlocked" : ""}
          </p>
          <div className="mt-6 space-y-2">
            <Button asChild className="w-full">
              <Link to="/">Back to radar</Link>
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center">
          <Logo className="h-14" alt="ATC365" />
        </div>

        <div className="panel rounded-xl p-6 text-center">
          <h1 className="font-display text-xl text-primary text-glow">Members only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ATC365 uses Discord for sign-in. You need the ATC365 member role in our Discord server to
            access the radar; staff roles unlock the admin panel automatically.
          </p>
          <Button
            className="mt-5 w-full bg-[#5865F2] text-white hover:bg-[#4752c4]"
            onClick={discord}
          >
            Continue with Discord
          </Button>
        </div>
      </div>
    </main>
  );
}
