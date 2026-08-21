import { useCallback, useEffect, useRef, useState } from "react";
import { getPushRegistration } from "./push";

/**
 * "Pin" a flight so its callsign and progress stay visible outside the app —
 * a live-activity style notification in the phone's notification shade,
 * refreshed while the flight is airborne, plus event alerts for takeoff,
 * landing and emergencies. Falls back to the tab title when notifications are
 * unavailable or denied.
 */
export type PinnedInfo = {
  id: string;
  callsign: string;
  depIcao: string;
  arrIcao: string;
  depTime: string;
  arrTime: string;
  progress: number;
  eta: string;
  phase: string;
  emergency?: boolean;
  emergencyLabel?: string | undefined;
};

const KEY = "atc365-pinned-flight";

export function usePinnedFlightId() {
  const [pinned, setPinned] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPinned(localStorage.getItem(KEY));
    } catch {
      /* storage blocked */
    }
  }, []);

  const update = useCallback((id: string | null) => {
    setPinned(id);
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked */
    }
  }, []);

  return [pinned, update] as const;
}

function bar(progress: number) {
  const filled = Math.round(Math.min(Math.max(progress, 0), 1) * 14);
  return `${"━".repeat(filled)}✈${"┈".repeat(Math.max(14 - filled, 0))}`;
}

const STICKY_TAG = "atc365-pinned-flight";

/**
 * Shows a notification through the service worker registration. Mobile
 * browsers (Android Chrome in particular) refuse `new Notification(...)`, so
 * `registration.showNotification` is the only path that works there. The
 * constructor stays as a desktop fallback when no worker is available.
 */
async function notify(title: string, body: string, tag: string, sticky = false) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    tag,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    silent: sticky,
    requireInteraction: sticky,
  };
  try {
    const registration = await getPushRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    /* fall through to the constructor */
  }
  try {
    new Notification(title, options);
  } catch {
    /* notifications unavailable */
  }
}

async function closeNotifications(tag: string) {
  try {
    const registration = await getPushRegistration();
    if (!registration) return;
    const open = await registration.getNotifications({ tag });
    open.forEach((n: Notification) => n.close());
  } catch {
    /* nothing to close */
  }
}


/**
 * Keeps a single sticky "live activity" notification in sync with the pinned
 * flight, and fires one-off alerts on takeoff, landing and emergencies.
 */
export function useFlightPinNotification(info: PinnedInfo | null, active: boolean) {
  const lastPhase = useRef<string | null>(null);
  const lastEmergency = useRef(false);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !info) {
      void closeNotifications(STICKY_TAG);
      lastPhase.current = null;
      lastEmergency.current = false;
      lastId.current = null;
      if (typeof document !== "undefined") document.title = "ATC365";
      return;
    }

    document.title = `${info.callsign} · ${Math.round(info.progress * 100)}%`;

    if (info.id !== lastId.current) {
      lastId.current = info.id;
      lastPhase.current = null;
      lastEmergency.current = false;
    }

    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    // --- event alerts ------------------------------------------------------
    if (info.emergency && !lastEmergency.current) {
      notify(
        `🚨 ${info.callsign} — ${info.emergencyLabel ?? "Emergency"}`,
        `${info.depIcao} → ${info.arrIcao} · squawking emergency`,
        `atc365-alert-${info.id}-emergency`,
      );
    }
    lastEmergency.current = !!info.emergency;

    const prev = lastPhase.current;
    if (prev && prev !== info.phase) {
      if (info.phase === "departing")
        notify(
          `🛫 ${info.callsign} has taken off`,
          `Departed ${info.depIcao} at ${info.depTime} · ${info.eta}`,
          `atc365-alert-${info.id}-dep`,
        );
      if (info.phase === "arriving")
        notify(
          `🛬 ${info.callsign} is on approach`,
          `Landing at ${info.arrIcao} · ${info.eta}`,
          `atc365-alert-${info.id}-app`,
        );
      if (info.phase === "arrived")
        notify(
          `🛬 ${info.callsign} has landed`,
          `Arrived at ${info.arrIcao} at ${info.arrTime}`,
          `atc365-alert-${info.id}-arr`,
        );
    }
    lastPhase.current = info.phase;

    // --- live activity -----------------------------------------------------
    void notify(
      `${info.callsign}   ${info.depIcao} → ${info.arrIcao}`,
      `${info.depTime} ${bar(info.progress)} ${info.arrTime}\n${info.eta}`,
      STICKY_TAG,
      true,
    );

    return () => {
      void closeNotifications(STICKY_TAG);
    };
  }, [
    active,
    info?.id,
    info?.callsign,
    info?.eta,
    info?.phase,
    info?.emergency,
    Math.round((info?.progress ?? 0) * 100),
  ]);
}

export async function requestPinPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}