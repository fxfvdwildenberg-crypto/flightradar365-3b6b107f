import { createFileRoute } from "@tanstack/react-router";

function deny(origin: string, reason: string) {
  return Response.redirect(`${origin}/auth?denied=${encodeURIComponent(reason)}`, 302);
}

export const Route = createFileRoute("/api/public/auth/discord/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const code = url.searchParams.get("code");
        if (!code) return deny(origin, "Sign-in was cancelled");

        const clientId = process.env["DISCORD_CLIENT_ID"];
        const clientSecret = process.env["DISCORD_CLIENT_SECRET"];
        const botToken = process.env["DISCORD_BOT_TOKEN"];
        const guildId = process.env["DISCORD_GUILD_ID"];
        const memberRoleId = process.env["DISCORD_MEMBER_ROLE_ID"];
        const staffRoleId = process.env["DISCORD_STAFF_ROLE_ID"];
        if (!clientId || !clientSecret || !botToken || !guildId || !memberRoleId) {
          return deny(origin, "Discord sign-in is not configured");
        }

        // 1. Exchange the code for a Discord access token.
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: `${origin}/api/public/auth/discord/callback`,
          }),
        });
        if (!tokenRes.ok) return deny(origin, "Discord rejected the sign-in");
        const token = (await tokenRes.json()) as { access_token?: string };
        if (!token.access_token) return deny(origin, "Discord rejected the sign-in");

        // 2. Identify the Discord user.
        const meRes = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (!meRes.ok) return deny(origin, "Could not read your Discord profile");
        const me = (await meRes.json()) as { id: string; username: string; global_name?: string | null };

        // 3. Read the member's roles in the guild with the bot token.
        const memberRes = await fetch(
          `https://discord.com/api/guilds/${guildId}/members/${me.id}`,
          { headers: { Authorization: `Bot ${botToken}` } },
        );
        if (memberRes.status === 404) return deny(origin, "You are not a member of the ATC365 Discord server");
        if (!memberRes.ok) return deny(origin, "Could not check your Discord roles");
        const member = (await memberRes.json()) as { roles?: string[] };
        const roles = member.roles ?? [];

        if (!roles.includes(memberRoleId)) {
          return deny(origin, "Your Discord account does not have the required role");
        }
        const isStaff = !!staffRoleId && roles.includes(staffRoleId);

        // 4. Match or create the Supabase user for this Discord ID.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const email = `discord-${me.id}@atc365.users`;
        const displayName = me.global_name || me.username;

        let userId: string | null = null;
        const created = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { display_name: displayName, discord_id: me.id },
        });
        if (created.data.user) {
          userId = created.data.user.id;
        } else {
          const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          userId = list.data.users.find((u) => u.email === email)?.id ?? null;
          if (userId) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              user_metadata: { display_name: displayName, discord_id: me.id },
            });
          }
        }
        if (!userId) return deny(origin, "Could not create your account");

        await supabaseAdmin
          .from("profiles")
          .upsert({ id: userId, display_name: displayName }, { onConflict: "id" });

        // 5. Sync roles: staff gets admin, everyone else keeps pilot.
        if (isStaff) {
          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
        } else {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        }
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "pilot" }, { onConflict: "user_id,role" });

        // 6. Issue a magic link so a real Supabase session lands in the browser.
        const link = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: `${origin}/` },
        });
        const actionLink = link.data.properties?.action_link;
        if (!actionLink) return deny(origin, "Could not start your session");

        return Response.redirect(actionLink, 302);
      },
    },
  },
});
