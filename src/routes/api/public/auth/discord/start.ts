import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/auth/discord/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env["DISCORD_CLIENT_ID"];
        if (!clientId) return new Response("Discord sign-in is not configured", { status: 500 });

        const url = new URL(request.url);
        const redirectUri = `${url.origin}/api/public/auth/discord/callback`;

        const authorize = new URL("https://discord.com/api/oauth2/authorize");
        authorize.searchParams.set("client_id", clientId);
        authorize.searchParams.set("redirect_uri", redirectUri);
        authorize.searchParams.set("response_type", "code");
        authorize.searchParams.set("scope", "identify guilds.members.read");
        authorize.searchParams.set("prompt", "consent");

        return Response.redirect(authorize.toString(), 302);
      },
    },
  },
});
