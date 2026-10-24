import { describe, expect, it } from 'vitest';
import { parseSave, readSave, writeSave } from '../src/core/save';
import type { GameSave } from '../src/core/save';

const valid: GameSave = { version: 1, level: 'courtyard', seconds: 42, muted: true, started: true, surfaces: { 'bench-top': new Array(16).fill(255) } };
describe('local saves', () => {
  it('round-trips the actual dirt and preferences', () => {
    expect(parseSave(JSON.stringify(valid))).toEqual(valid);
  });
  it.each([null, '', 'broken', '[]', '{"version":2}', JSON.stringify({ ...valid, seconds: -1 }), JSON.stringify({ ...valid, surfaces: { broken: [999] } }), JSON.stringify({ ...valid, surfaces: { broken: new Array(16).fill(1.5) } })])('rejects a corrupt or incompatible save: %s', (raw) => {
    expect(parseSave(raw)).toBeNull();
  });
  it('continues when storage is blocked or the quota is exhausted', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(readSave(blocked)).toBeNull();
    expect(writeSave(blocked, valid)).toBe(false);
    expect(writeSave(undefined, valid)).toBe(false);
  });
});
