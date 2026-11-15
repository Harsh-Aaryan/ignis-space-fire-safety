"use client";

import { SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { objectById, roomById, roomsForHabitat, type NavigationMode } from "@/data/habitat-interiors";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/stores/mission-store";
import { habitatCredit, habitatName, levelLabel } from "./format";

const MODES: Array<{ id: NavigationMode; label: string; hint: string }> = [
  { id: "orbit", label: "Orbit", hint: "Exterior view of the whole habitat" },
  { id: "cutaway", label: "Cutaway", hint: "All levels with the shell opened" },
  { id: "interior", label: "Interior", hint: "Inside the selected room" },
  { id: "floor", label: "Floor", hint: "One level at a time" },
  { id: "equipment", label: "Equipment", hint: "Close view of the selected equipment" },
];

const chip =
  "inline-flex min-h-10 items-center gap-2 rounded-md border border-border-subtle bg-elev-1/90 px-2.5 text-[13px] text-foreground backdrop-blur-sm lg:min-h-8";

/** Top-left of the viewport: where you are, then one row of view controls. */
export function ViewToolbar() {
  return (
    <div className="pointer-events-none absolute top-3 right-3 left-3 z-20 flex flex-col items-start gap-2">
      <LocationLine />
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2">
        <ModeControl />
        <RoomSelect />
        <DeckSelect />
        <ViewOptions />
      </div>
    </div>
  );
}

function LocationLine() {
  const missionId = useMissionStore((s) => s.scenario.missionId);
  const room = roomById(useMissionStore((s) => s.selectedRoomId));
  const object = objectById(useMissionStore((s) => s.selectedObjectId));
  const cutaway = useMissionStore((s) => s.cutaway);
  const parts = [habitatName(missionId)];
  if (room) {
    parts.push(levelLabel(missionId, room.level), room.name);
    if (object) parts.push(object.label);
  } else {
    parts.push(cutaway ? (missionId === "gateway-orbit" ? "All modules" : "All levels") : "Exterior");
  }
  return (
    <p
      data-testid="habitat-location"
      aria-live="polite"
      className="max-w-full truncate rounded-md bg-elev-1/80 px-2 py-1 text-[13px] text-foreground backdrop-blur-sm"
    >
      {parts.join(" · ")}
    </p>
  );
}

function ModeControl() {
  const mode = useMissionStore((s) => s.navigationMode);
  const navigate = useMissionStore((s) => s.navigate);
  return (
    <div
      role="group"
      aria-label="View mode"
      className="flex max-w-full overflow-x-auto rounded-md border border-border-subtle bg-elev-1/90 p-0.5 backdrop-blur-sm"
    >
      {MODES.map((item) => (
        <button
          type="button"
          key={item.id}
          title={item.hint}
          aria-pressed={mode === item.id}
          onClick={() => navigate(item.id)}
          className={cn(
            "min-h-9 shrink-0 rounded-[3px] px-3 text-[13px] transition-colors lg:min-h-7",
            mode === item.id ? "bg-elev-4 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function RoomSelect() {
  const missionId = useMissionStore((s) => s.scenario.missionId);
  const selectedRoomId = useMissionStore((s) => s.selectedRoomId);
  const selectRoom = useMissionStore((s) => s.selectRoom);
  const navigate = useMissionStore((s) => s.navigate);
  const rooms = roomsForHabitat(missionId);
  const gateway = missionId === "gateway-orbit";
  return (
    <label className={chip}>
      <span className="text-muted-foreground">{gateway ? "Module" : "Room"}</span>
      <select
        aria-label="Select room"
        value={roomById(selectedRoomId)?.id ?? ""}
        onChange={(event) => {
          if (event.target.value) selectRoom(event.target.value);
          else navigate("orbit");
        }}
        className="max-w-[200px] bg-transparent py-1 text-foreground [&>option]:bg-elev-2"
      >
        <option value="">Exterior</option>
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {gateway ? room.name : `Level ${room.level} · ${room.name}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function DeckSelect() {
  const missionId = useMissionStore((s) => s.scenario.missionId);
  const selectedLevel = useMissionStore((s) => s.selectedLevel);
  const setLevel = useMissionStore((s) => s.setLevel);
  const levels = [...new Set(roomsForHabitat(missionId).map((room) => room.level))];
  if (levels.length < 2) return null;
  return (
    <label className={chip}>
      <span className="text-muted-foreground">Level</span>
      <select
        aria-label="Select floor"
        value={selectedLevel ?? "all"}
        onChange={(event) => setLevel(event.target.value === "all" ? null : Number(event.target.value))}
        className="bg-transparent py-1 text-foreground [&>option]:bg-elev-2"
      >
        <option value="all">All levels</option>
        {levels.map((level) => (
          <option key={level} value={level}>
            Level {level}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Secondary view toggles and camera actions, kept out of the scene until asked for. */
function ViewOptions() {
  const state = useMissionStore();
  const { cutaway, exploded, marsDusk, hideRoof, hideFrontWalls, scenario } = state;
  const object = objectById(state.selectedObjectId);
  const room = roomById(state.selectedRoomId);

  function fitSelected() {
    if (object) state.selectObject(object.id);
    else if (room) state.selectRoom(room.id);
    else if (state.selectedEquipment) state.selectEquipment(state.selectedEquipment);
  }
  function resetView() {
    state.resetCamera();
    if (cutaway) state.navigate("cutaway");
  }

  return (
    <Popover>
      <PopoverTrigger className={cn(chip, "hover:bg-elev-3")}>
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
        View options
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 border border-border bg-popover p-2">
        {cutaway || scenario.missionId !== "gateway-orbit" ? (
          <div role="group" aria-label="Display" className="flex flex-col">
            <p className="micro px-2 pt-1 pb-1.5 text-text-tertiary">Display</p>
            {cutaway ? (
              <>
                <ToggleOption pressed={hideRoof} onClick={() => state.setHideRoof(!hideRoof)}>
                  Hide roof
                </ToggleOption>
                <ToggleOption pressed={hideFrontWalls} onClick={() => state.setHideFrontWalls(!hideFrontWalls)}>
                  Hide front walls
                </ToggleOption>
              </>
            ) : null}
            {scenario.missionId !== "gateway-orbit" ? (
              <ToggleOption pressed={exploded} onClick={() => state.setExploded(!exploded)}>
                Explode levels
              </ToggleOption>
            ) : null}
            {scenario.missionId === "mars-habitat" ? (
              <ToggleOption pressed={marsDusk} onClick={() => state.setMarsDusk(!marsDusk)}>
                Dusk lighting
              </ToggleOption>
            ) : null}
          </div>
        ) : null}
        <div role="group" aria-label="Camera" className="mt-1 flex flex-col border-t border-border-subtle pt-1">
          <p className="micro px-2 pt-1 pb-1.5 text-text-tertiary">Camera</p>
          <ActionOption onClick={fitSelected}>Fit selected</ActionOption>
          <ActionOption onClick={resetView}>Reset view</ActionOption>
          {cutaway ? <ActionOption onClick={() => state.navigate("orbit")}>Return to exterior</ActionOption> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const optionClass =
  "flex min-h-10 w-full items-center justify-between gap-3 rounded-[3px] px-2 text-left text-[13px] text-foreground hover:bg-elev-4 lg:min-h-8";

function ToggleOption({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={optionClass}>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full border transition-colors",
          pressed ? "border-primary bg-primary/30" : "border-border bg-elev-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-2.5 rounded-full transition-all",
            pressed ? "left-3.5 bg-primary" : "left-0.5 bg-muted-foreground",
          )}
        />
      </span>
    </button>
  );
}

function ActionOption({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className={optionClass}>
      {children}
    </button>
  );
}

/** Bottom-left of the viewport: one hint and the habitat credit. */
export function ViewportFootnote() {
  const cutaway = useMissionStore((s) => s.cutaway);
  const missionId = useMissionStore((s) => s.scenario.missionId);
  const hint = cutaway
    ? "Select equipment in the scene to inspect it. Drag to orbit, scroll to zoom."
    : "Drag to orbit, scroll to zoom. Choose Cutaway to see inside.";
  return (
    <p className="pointer-events-none absolute bottom-2 left-3 right-3 z-20 w-fit max-w-full rounded-md bg-elev-1/75 px-2 py-1 text-[12px] leading-4 text-muted-foreground backdrop-blur-sm">
      {hint} <span className="text-text-tertiary">· {habitatCredit(missionId)}</span>
    </p>
  );
}
