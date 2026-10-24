import { isLevelId } from "./levels";
import type { LevelId } from "./levels";
import type { StoragePort } from "./save";

export interface Preferences {
  level: LevelId;
  night: boolean;
  muted: boolean;
  volume: number;
  motion: boolean;
}
const KEY = "clean-a-little:preferences:v2";
export function readPreferences(storage?: StoragePort): Preferences {
  const defaults: Preferences = {
    level: "courtyard",
    night: false,
    muted: false,
    volume: 65,
    motion: true,
  };
  try {
    const raw = storage?.getItem(KEY);
    if (!raw || raw.length > 1000) return defaults;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return defaults;
    return {
      level: isLevelId(value.level) ? value.level : "courtyard",
      night: value.night === true,
      muted: value.muted === true,
      volume: Number.isFinite(value.volume)
        ? Math.max(0, Math.min(100, value.volume))
        : 65,
      motion: value.motion !== false,
    };
  } catch {
    return defaults;
  }
}
export function writePreferences(
  storage: StoragePort | undefined,
  preferences: Preferences,
): void {
  try {
    storage?.setItem(KEY, JSON.stringify(preferences));
  } catch {
    /* Optional local preferences. */
  }
}
