import { describe, expect, it } from 'vitest';
import { CleaningSession, DirtGrid } from '../src/core/cleaning';

describe('surface dirt', () => {
  it('removes dirt locally and leaves untouched cells dirty', () => {
    const grid = new DirtGrid(32, 32);
    grid.stamp(0.5, 0.5, 0.2, 0.2, 0.05);
    expect(grid.data[16 * 32 + 16]).toBeLessThan(255);
    expect(grid.data[0]).toBe(255);
    expect(grid.progress).toBeGreaterThan(0);
    expect(grid.progress).toBeLessThan(0.1);
  });
  it('does not award more progress for already clean cells', () => {
    const grid = new DirtGrid(8, 8);
    grid.clear();
    expect(grid.stamp(0.5, 0.5, 1, 1, 0.05)).toBe(0);
    expect(grid.progress).toBe(1);
  });
  it('clips an edge brush without modifying the opposite edge', () => {
    const grid = new DirtGrid(16, 16);
    grid.stamp(0, 0, 0.4, 0.4, 0.05);
    expect(grid.data[0]).toBeLessThan(255);
    expect(grid.data[255]).toBe(255);
  });
  it('rejects off-surface and invalid inputs and clamps stalled frames', () => {
    const a = new DirtGrid(16, 16);
    const b = new DirtGrid(16, 16);
    expect(a.stamp(-1, 0.5, 1, 1, 0.05)).toBe(0);
    expect(a.stamp(NaN, 0.5, 1, 1, 0.05)).toBe(0);
    expect(a.stamp(0.5, 0.5, 0, 1, 0.05)).toBe(0);
    a.stamp(0.5, 0.5, 0.4, 0.4, 500);
    b.stamp(0.5, 0.5, 0.4, 0.4, 0.05);
    expect(a.export()).toEqual(b.export());
  });
});

describe('mission progress', () => {
  const specs = [
    { id: 'big', task: 'paving' as const, area: 9, width: 8, height: 8 },
    { id: 'small', task: 'paving' as const, area: 1, width: 8, height: 8 },
  ];
  it('uses area rather than averaging the number of surfaces', () => {
    const session = new CleaningSession(specs);
    session.surfaces.get('small')!.grid.clear();
    expect(session.taskProgress('paving')).toBeCloseTo(0.1);
    expect(session.progress).toBeCloseTo(0.1);
    expect(session.completed).toBe(false);
  });
  it('completes remaining specks once, without completing absent tasks', () => {
    const session = new CleaningSession(specs);
    session.surfaces.get('big')!.grid.clear();
    const small = session.surfaces.get('small')!.grid;
    for (let i = 0; i < 25; i++) small.stamp(0.5, 0.5, 1, 1, 0.05);
    expect(session.settle()).toEqual(['paving']);
    expect(session.taskProgress('paving')).toBe(1);
    expect(session.settle()).toEqual([]);
    expect(session.completed).toBe(false);
  });
  it('restores a snapshot and ignores a mismatched grid size', () => {
    const first = new CleaningSession(specs);
    first.surfaces.get('big')!.grid.stamp(0.3, 0.7, 0.4, 0.2, 0.05);
    const restored = new CleaningSession(specs, first.snapshot());
    expect(restored.progress).toBe(first.progress);
    const invalid = new CleaningSession(specs, { big: [0] });
    expect(invalid.progress).toBe(0);
  });
});
