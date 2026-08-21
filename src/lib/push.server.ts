import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  sticky?: boolean;
  silent?: boolean;
};

export type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function vapid() {
  return {
    subject: process.env["VAPID_SUBJECT"] ?? "mailto:alerts@atc365.app",
    publicKey: process.env["VAPID_PUBLIC_KEY"],
    privateKey: process.env["VAPID_PRIVATE_KEY"],
  };
}

export function getVapidPublicKey(): string {
  return process.env["VAPID_PUBLIC_KEY"] ?? "";
}

/**
 * Sends one encrypted web push. Returns false when the endpoint is gone so the
 * caller can prune the dead subscription.
 */
export async function sendPush(sub: StoredSubscription, payload: PushPayload): Promise<boolean> {
  const keys = vapid();
  if (!keys.publicKey || !keys.privateKey) throw new Error("VAPID keys are not configured");

  const subscription: PushSubscription = {
    endpoint: sub.endpoint,
    expirationTime: null,
    keys: { auth: sub.auth, p256dh: sub.p256dh },
  };

  const init = await buildPushPayload(
    { data: payload, options: { ttl: 3600, urgency: "high" } },
    subscription,
    keys,
  );

  const headers = new Headers();
  for (const [key, value] of Object.entries(init.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }

  const res = await fetch(sub.endpoint, {
    method: init.method,
    headers,
    body: init.body as unknown as BodyInit,
  });

  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) console.error(`[push] ${res.status} ${await res.text()}`);
  return true;
}