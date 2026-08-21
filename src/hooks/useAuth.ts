import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "atc" | "pilot";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
      if (next?.user) {
        const uid = next.user.id;
        setTimeout(() => {
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", uid)
            .then(({ data }) => setRoles((data ?? []).map((r) => r.role as Role)));
        }, 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("admin");
  const isAtc = roles.includes("atc") || isAdmin;

  return { session, user, roles, isAtc, isAdmin, loading, signOut: () => supabase.auth.signOut() };
}
