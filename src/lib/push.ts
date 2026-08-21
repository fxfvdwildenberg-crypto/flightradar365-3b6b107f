import {
  deletePushSubscription,
  getPushPublicKey,
  savePushSubscription,
  sendTestPush,
} from "./push.functions";

const SW_URL = "/push-sw.js";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

/** Registers the messaging worker (never an app-shell cache). */
export async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

function keyToBase64(sub: PushSubscription, name: "p256dh" | "auth"): string {
  const key = sub.getKey(name);
  if (!key) return "";
  return btoa(String.fromCharCode(...new Uint8Array(key)));
}

/**
 * Subscribe this browser to background alerts for a flight. Works with the app
 * closed because delivery happens through the push service, not the page.
 */
export async function subscribeToFlightPush(flightPlanId: string | null): Promise<boolean> {
  if (!pushSupported()) return false;
  if (!(await requestNotificationPermission())) return false;

  const registration = await getPushRegistration();
  if (!registration) return false;
  await navigator.serviceWorker.ready;

  const { publicKey } = await getPushPublicKey();
  if (!publicKey) return false;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  await savePushSubscription({
    data: {
      endpoint: subscription.endpoint,
      p256dh: keyToBase64(subscription, "p256dh"),
      auth: keyToBase64(subscription, "auth"),
      flightPlanId,
    },
  });
  return true;
}

export async function unsubscribeFromFlightPush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await deletePushSubscription({ data: { endpoint: subscription.endpoint } }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}

/** Ask the server to push a one-off notification to this browser. */
export async function sendTestNotification(): Promise<void> {
  if (!pushSupported()) throw new Error("Push notifications aren't supported on this browser");
  const ok = await subscribeToFlightPush(null);
  if (!ok) throw new Error("Allow notifications first");
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) throw new Error("Could not create a push subscription");
  await sendTestPush({ data: { endpoint: subscription.endpoint } });
}