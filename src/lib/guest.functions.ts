import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Checks the guest access code on the server so it isn't shipped to browsers. */
export const checkGuestCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().max(100) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env.GUEST_ACCESS_CODE?.trim() || "eLHRFUHE#*";
    return { ok: data.code.trim() === expected };
  });
