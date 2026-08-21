/**
 * Transponder (squawk) code helpers.
 * Reference: https://en.wikipedia.org/wiki/List_of_transponder_codes
 */

export const EMERGENCY_SQUAWKS = ["7500", "7600", "7601", "7700"] as const;

export type SquawkInfo = {
  code: string;
  label: string;
  emergency: boolean;
  description: string;
};

const SPECIAL: Record<string, { label: string; emergency: boolean; description: string }> = {
  "7500": {
    label: "Unlawful interference",
    emergency: true,
    description: "Hijacking — aircraft is under unlawful interference.",
  },
  "7600": {
    label: "Radio failure",
    emergency: true,
    description: "Lost communications. Expect the crew to follow the last cleared route.",
  },
  "7601": {
    label: "Ground emergency",
    emergency: true,
    description: "Emergency declared on the ground / non-standard failure.",
  },
  "7700": {
    label: "General emergency",
    emergency: true,
    description: "Mayday — the crew has declared a general emergency.",
  },
  "7000": { label: "VFR conspicuity", emergency: false, description: "Standard VFR squawk." },
  "2000": { label: "IFR conspicuity", emergency: false, description: "Standard IFR squawk." },
  "1200": { label: "VFR (Americas)", emergency: false, description: "VFR conspicuity code." },
  "7777": { label: "Military intercept", emergency: false, description: "Military interceptor operations." },
  "0000": { label: "Non-discrete", emergency: false, description: "Transponder not set / SSR fault." },
};

export function isValidSquawk(code: string): boolean {
  return /^[0-7]{4}$/.test(code.trim());
}

export function isEmergencySquawk(code: string | null | undefined): boolean {
  return !!code && (EMERGENCY_SQUAWKS as readonly string[]).includes(code.trim());
}

export function squawkInfo(code: string | null | undefined): SquawkInfo | null {
  if (!code) return null;
  const c = code.trim();
  const s = SPECIAL[c];
  if (!s) return { code: c, label: "Discrete code", emergency: false, description: "Assigned by ATC." };
  return { code: c, ...s };
}

/** Codes offered as quick picks in the squawk editor. */
export const QUICK_SQUAWKS = ["2000", "7000", "1200", "7500", "7600", "7601", "7700"];
