import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HABITAT_ROOMS,
  objectById,
  roomsForHabitat,
} from "@/data/habitat-interiors";
import { investigationById } from "@/data/research/investigations";
import { oxygenPartialPressurePsi } from "@/lib/physics/atmosphere";
let store: typeof import("@/stores/mission-store").useMissionStore;
beforeAll(async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  store = (await import("@/stores/mission-store")).useMissionStore;
});
beforeEach(() => store.getState().resetScenario());
describe("interior scientific navigation", () => {
  it("has unique object identities and research records for every inspection object", () => {
    const objects = HABITAT_ROOMS.flatMap((room) => room.equipment);
    expect(new Set(objects.map((object) => object.id)).size).toBe(
      objects.length,
    );
    for (const object of objects) {
      expect(
        HABITAT_ROOMS.find((room) => room.id === object.roomId)?.habitatId,
      ).toBe(object.habitatId);
      expect(object.investigations.length).toBeGreaterThan(0);
      for (const id of object.investigations) {
        expect(investigationById(id), `${object.id} links to ${id}`).not.toBeNull();
      }
      expect(object.limitation.length).toBeGreaterThan(30);
    }
    expect(roomsForHabitat("mars-habitat").map((room) => room.level)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(
      new Set(roomsForHabitat("lunar-habitat").map((room) => room.level)).size,
    ).toBe(2);
  });
  it("synchronizes object, room, floor, system and scientific objective, then clears stale selection on habitat switch", () => {
    const id = "lunar-habitat-lab-samples-1";
    store.getState().selectObject(id);
    expect(store.getState()).toMatchObject({
      selectedObjectId: id,
      selectedRoomId: "lunar-habitat-lab",
      selectedLevel: 1,
      selectedEquipment: "material-storage",
      navigationMode: "equipment",
      cutaway: true,
    });
    expect(store.getState().scenario.objective).toBe(objectById(id)?.objective);
    store.getState().patchScenario({ oxygenPct: 35, pressurePsi: 12 });
    store.getState().selectMission("gateway-orbit");
    expect(store.getState()).toMatchObject({
      selectedObjectId: null,
      selectedRoomId: null,
      selectedLevel: null,
      cutaway: false,
      navigationMode: "orbit",
    });
    expect(store.getState().scenario).toMatchObject({
      oxygenPct: 35,
      pressurePsi: 12,
      gravityG: 0,
    });
    store.getState().selectObject(id);
    expect(store.getState().selectedObjectId).toBeNull();
  });
  it("keeps text-based system buttons consistent with object selection and floor isolation", () => {
    store.getState().selectEquipment("smoke-detection");
    expect(objectById(store.getState().selectedObjectId)?.type).toBe(
      "detector",
    );
    store.getState().selectMission("mars-habitat");
    store.getState().setLevel(4);
    expect(store.getState()).toMatchObject({
      selectedRoomId: "mars-habitat-eclss",
      selectedLevel: 4,
      navigationMode: "floor",
    });
    store.getState().setLevel(19);
    expect(store.getState().selectedLevel).toBe(4);
    store.getState().setExploded(true);
    expect(store.getState()).toMatchObject({
      exploded: true,
      cutaway: true,
      selectedLevel: null,
    });
    store.getState().navigate("orbit");
    expect(store.getState()).toMatchObject({
      exploded: false,
      cutaway: false,
      selectedRoomId: null,
    });
  });
  it("derives oxygen partial pressure from the cabin atmosphere", () => {
    expect(oxygenPartialPressurePsi(35, 12)).toBeCloseTo(4.2);
  });
});
