import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN, isAllowedOrigin } from "@/lib/discord-oauth";

export const Route = createFileRoute("/api/public/auth/discord/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env["DISCORD_CLIENT_ID"];
        if (!clientId) return new Response("Discord sign-in is not configured", { status: 500 });

        const url = new URL(request.url);

        // Discord only accepts redirect URIs registered in the developer portal.
        // Visitors can arrive on several hostnames (published site, preview,
        // project URL, custom domain), so always authorize against ONE canonical
        // callback and carry the visitor's own origin along in `state`.
        const redirectUri = `${CANONICAL_ORIGIN}/api/public/auth/discord/callback`;
        const returnOrigin = isAllowedOrigin(url.origin) ? url.origin : CANONICAL_ORIGIN;

        const authorize = new URL("https://discord.com/api/oauth2/authorize");
        authorize.searchParams.set("client_id", clientId);
        authorize.searchParams.set("redirect_uri", redirectUri);
        authorize.searchParams.set("response_type", "code");
        authorize.searchParams.set("scope", "identify guilds.members.read");
        authorize.searchParams.set("state", btoa(returnOrigin));

        return Response.redirect(authorize.toString(), 302);
      },
    },
  },
});
