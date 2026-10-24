import { describe, expect, it } from "vitest";
import { CleaningSession } from "../src/core/cleaning";
import { LEVELS } from "../src/core/levels";
import { readSave, writeSave, SAVE_KEY } from "../src/core/save";
import { readPreferences, writePreferences } from "../src/core/preferences";
import { clampDevice } from "../src/core/device";

describe("four independent cleaning scenes", () => {
  it.each(LEVELS)("$id completes only its own three tasks", (level) => {
    const specs = level.tasks.map((task) => ({
      id: task,
      task,
      area: 1,
      width: 8,
      height: 8,
    }));
    const session = new CleaningSession(specs, {}, level.tasks);
    session.surfaces.get(level.tasks[0])!.grid.clear();
    expect(session.settle()).toEqual([level.tasks[0]]);
    expect(session.completed).toBe(false);
    for (const surface of session.surfaces.values()) surface.grid.clear();
    session.settle();
    expect(session.completed).toBe(true);
    const restored = new CleaningSession(
      specs,
      session.snapshot(),
      level.tasks,
    );
    expect(restored.completed).toBe(true);
  });
  it("keeps level saves separate and retains the existing courtyard key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    for (const [index, level] of LEVELS.entries())
      writeSave(storage, {
        version: 1,
        level: level.id,
        seconds: index + 10,
        muted: false,
        started: true,
        surfaces: { sample: new Array(16).fill(index) },
      });
    expect(values.has(SAVE_KEY)).toBe(true);
    for (const [index, level] of LEVELS.entries())
      expect(readSave(storage, level.id)?.surfaces.sample[0]).toBe(index);
    writeSave(storage, {
      version: 1,
      level: "glass",
      seconds: 0,
      muted: false,
      started: true,
      surfaces: {},
    });
    expect(readSave(storage, "courtyard")?.seconds).toBe(10);
  });
  it("rejects a save stored under the wrong scene key", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          version: 1,
          level: "courtyard",
          seconds: 2,
          muted: false,
          started: true,
          surfaces: {},
        }),
      setItem: () => {},
    };
    expect(readSave(storage, "glass")).toBeNull();
  });
});
describe("settings and draggable tool boundaries", () => {
  it("restores theme, sound, volume and the selected scene", () => {
    let saved: string | null = null;
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    };
    const preferences = {
      level: "fabric" as const,
      night: true,
      muted: true,
      volume: 30,
      motion: false,
    };
    writePreferences(storage, preferences);
    expect(readPreferences(storage)).toEqual(preferences);
    saved = "{broken";
    expect(readPreferences(storage).level).toBe("courtyard");
  });
  it("clamps untrusted volume and survives unavailable storage", () => {
    const storage = {
      getItem: () => '{"level":"bad","volume":999}',
      setItem: () => {
        throw Error("denied");
      },
    };
    expect(readPreferences(storage).volume).toBe(100);
    expect(readPreferences(storage).level).toBe("courtyard");
    expect(() => writePreferences(storage, readPreferences())).not.toThrow();
  });
  it("keeps the tool reachable after dragging beyond edges and resizing", () => {
    expect(
      clampDevice(
        { x: -300, y: -300 },
        { width: 390, height: 844 },
        { width: 115, height: 132 },
      ),
    ).toEqual({ x: 8, y: 72 });
    expect(
      clampDevice(
        { x: 1400, y: 900 },
        { width: 390, height: 844 },
        { width: 115, height: 132 },
      ),
    ).toEqual({ x: 267, y: 602 });
  });
});
