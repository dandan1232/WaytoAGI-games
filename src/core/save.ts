import type { LevelId } from './levels';
export const saveKey = (level: LevelId): string => `clean-a-little:${level}:v1`;
export const SAVE_KEY = saveKey('courtyard');
export const SAVE_VERSION = 1;
export interface GameSave {
  version: 1;
  level: LevelId;
  seconds: number;
  muted: boolean;
  started: boolean;
  surfaces: Record<string, number[]>;
}
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

export function parseSave(raw: string | null, level: LevelId = 'courtyard'): GameSave | null {
  if (!raw || raw.length > 1_000_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const save = value as Record<string, unknown>;
    if (save.version !== SAVE_VERSION || save.level !== level || typeof save.seconds !== 'number' || !Number.isFinite(save.seconds) || save.seconds < 0 || save.seconds > 604800 || typeof save.muted !== 'boolean' || typeof save.started !== 'boolean' || !save.surfaces || typeof save.surfaces !== 'object' || Array.isArray(save.surfaces)) return null;
    const entries = Object.entries(save.surfaces);
    if (entries.length > 80) return null;
    const surfaces: Record<string, number[]> = {};
    for (const [id, cells] of entries) {
      if (!/^[a-z0-9-]{1,64}$/.test(id) || !Array.isArray(cells) || cells.length < 16 || cells.length > 16384 || !cells.every((v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 255)) return null;
      surfaces[id] = cells;
    }
    return { version: 1, level, seconds: save.seconds, muted: save.muted, started: save.started, surfaces };
  } catch { return null; }
}

export function readSave(storage: StoragePort | undefined, level: LevelId = 'courtyard'): GameSave | null {
  try { return storage ? parseSave(storage.getItem(saveKey(level)), level) : null; } catch { return null; }
}

export function writeSave(storage: StoragePort | undefined, save: GameSave): boolean {
  try { if (!storage) return false; storage.setItem(saveKey(save.level), JSON.stringify(save)); return true; } catch { return false; }
}

export function browserStorage(): StoragePort | undefined {
  try { return window.localStorage; } catch { return undefined; }
}
