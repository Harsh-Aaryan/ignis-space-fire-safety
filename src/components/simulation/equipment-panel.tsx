"use client";

import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { Note, Tag, actionClass } from "@/components/design/kit";
import { Cite } from "@/components/fire/cite";
import { materialById } from "@/data/fire/materials";
import { ignitionById } from "@/data/fire/options";
import {
  objectById,
  roomById,
  roomsForHabitat,
  type HabitatRoomConfig,
  type InteriorEquipment,
} from "@/data/habitat-interiors";
import { KIND_LABEL, investigationById, type InvestigationRecord } from "@/data/research/investigations";
import { fuelPackageFor } from "@/lib/fire/scenario";
import { ROUTES } from "@/lib/routes";
import { useFireSimStore } from "@/stores/fire-sim-store";
import { useMissionStore } from "@/stores/mission-store";
import { habitatName, levelLabel } from "./format";

const rowClass =
  "flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm text-foreground transition-colors hover:bg-elev-3";

/** What the selected room or equipment is, what it could burn, and the research that bears on it. */
export function EquipmentPanel() {
  const missionId = useMissionStore((state) => state.scenario.missionId);
  const room = roomById(useMissionStore((state) => state.selectedRoomId));
  const object = objectById(useMissionStore((state) => state.selectedObjectId));

  return (
    <aside aria-label="Equipment" className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-card p-4">
      {object ? (
        <EquipmentDetail object={object} room={roomById(object.roomId)} />
      ) : room ? (
        <RoomDetail room={room} />
      ) : (
        <HabitatRooms missionId={missionId} />
      )}
    </aside>
  );
}

function HabitatRooms({ missionId }: { missionId: Parameters<typeof roomsForHabitat>[0] }) {
  const selectRoom = useMissionStore((state) => state.selectRoom);
  const rooms = roomsForHabitat(missionId);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[17px] leading-6 font-medium text-foreground">{habitatName(missionId)}</h2>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          Choose a room to see inside, then select a piece of equipment to see what it could burn and the research behind it.
        </p>
      </div>
      <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
        {rooms.map((room) => (
          <li key={room.id}>
            <button type="button" onClick={() => selectRoom(room.id)} className={rowClass}>
              <span className="min-w-0">
                <span className="block truncate">{room.name}</span>
                <span className="block text-[12px] text-text-tertiary">
                  {levelLabel(missionId, room.level)} · {room.equipment.length} items
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoomDetail({ room }: { room: HabitatRoomConfig }) {
  const selectObject = useMissionStore((state) => state.selectObject);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] leading-4 text-text-tertiary">
          {habitatName(room.habitatId)} · {levelLabel(room.habitatId, room.level)}
        </p>
        <h2 className="mt-0.5 text-[17px] leading-6 font-medium text-foreground">{room.name}</h2>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">Select equipment here or in the scene.</p>
      </div>
      <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
        {room.equipment.map((equipment) => (
          <li key={equipment.id}>
            <button type="button" onClick={() => selectObject(equipment.id)} className={rowClass}>
              <span className="min-w-0 truncate">{equipment.label}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EquipmentDetail({ object, room }: { object: InteriorEquipment; room: HabitatRoomConfig | null }) {
  const selectRoom = useMissionStore((state) => state.selectRoom);
  const pack = fuelPackageFor(object);
  const material = materialById(pack.materialId);
  const ignition = ignitionById(pack.defaultIgnitionId);
  const records = object.investigations.map(investigationById).filter((record): record is InvestigationRecord => record !== null);

  function startFireHere() {
    // Use this equipment's own fuel and heat source, then open the scenario.
    useFireSimStore.getState().patchConfig({ materialId: null, ignitionId: null });
    useFireSimStore.getState().setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        {room ? (
          <button type="button" onClick={() => selectRoom(room.id)} className="text-[12px] leading-4 text-text-tertiary hover:text-foreground">
            {habitatName(room.habitatId)} · {levelLabel(room.habitatId, room.level)} · {room.name}
          </button>
        ) : null}
        <h2 className="mt-0.5 text-[17px] leading-6 font-medium text-foreground">{object.label}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{object.description}</p>
      </div>

      <section aria-labelledby="fuel-heading" className="space-y-3">
        <h3 id="fuel-heading" className="text-[15px] leading-5 font-medium text-foreground">
          What could burn here
        </h3>
        <dl className="space-y-2 rounded-md border border-border-subtle p-3 text-[13px] leading-5">
          <FuelRow label="Fuel">{pack.label}</FuelRow>
          <FuelRow label="Material">{material.name}</FuelRow>
          <FuelRow label="Size">
            {(pack.widthM * 100).toFixed(0)} × {(pack.lengthM * 100).toFixed(0)} cm, {pack.enclosed ? "inside an enclosure" : "open to the cabin"}
          </FuelRow>
          <FuelRow label="Likely heat source">{ignition.name}</FuelRow>
        </dl>
        <p className="text-[13px] leading-5 text-muted-foreground">{material.nasaFinding}</p>
        <p className="flex flex-wrap gap-1.5">
          {material.nasaSources.map((id) => (
            <Cite key={id} id={id} />
          ))}
        </p>
        <button type="button" onClick={startFireHere} className={actionClass("primary")}>
          <Flame className="size-4" aria-hidden="true" />
          Start a fire here
        </button>
      </section>

      <section aria-labelledby="research-heading" className="space-y-3">
        <h3 id="research-heading" className="text-[15px] leading-5 font-medium text-foreground">
          Related research
        </h3>
        <ul className="space-y-2">
          {records.map((record) => (
            <li key={record.id}>
              <Link
                href={ROUTES.investigation(record.id)}
                className="block rounded-md border border-border-subtle p-3 transition-colors hover:border-border hover:bg-elev-3"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{record.name}</span>
                  <Tag>{KIND_LABEL[record.kind]}</Tag>
                </span>
                <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">{record.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Note>{object.limitation}</Note>
    </div>
  );
}

function FuelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}
