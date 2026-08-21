import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TITLE = "Sign in — ATC365 Radar";
const DESCRIPTION =
  "Sign in to ATC365 to file flight plans, appear on the live island radar, and publish ATIS as ATC.";

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
  const navigate = useNavigate();
  const { user, roles, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/" });
  };

  const signUp = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName || email.split("@")[0] },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setConfirmSent(true);
      toast.success("Account created — check your email to confirm it");
      return;
    }
    toast.success("Account created — you can start filing flight plans");
    navigate({ to: "/" });
  };

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

          <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Roles: {roles.length ? roles.join(", ") : "pilot"}
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


        <div className="panel rounded-xl p-5">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4 space-y-3">
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <Field label="Password" value={password} onChange={setPassword} type="password" />
              <Button className="w-full" onClick={signIn} disabled={busy}>
                Sign in
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-4 space-y-3">
              {confirmSent && (
                <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  We sent a confirmation link to {email}. Click it, then sign in.
                </p>
              )}
              <Field label="Callsign / name" value={displayName} onChange={setDisplayName} />
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <Field label="Password" value={password} onChange={setPassword} type="password" />
              <Button className="w-full" onClick={signUp} disabled={busy}>
                Create account
              </Button>
            </TabsContent>
          </Tabs>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="font-display text-[10px] tracking-console text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            className="w-full bg-[#5865F2] text-white hover:bg-[#4752c4]"
            onClick={discord}
          >
            Continue with Discord
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            You need the ATC365 member role in our Discord. Staff roles unlock the admin panel
            automatically.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline hover:text-primary">
            Continue to the radar without signing in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-display text-[11px] tracking-console text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
