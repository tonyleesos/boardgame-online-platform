import type { CSSProperties } from "react";
import type { DecorRoom } from "../../../../functions/src/shared/decorum";
import { COLOR_LABELS, OBJECT_TYPES, ROOM_LABELS, objectLabel } from "../../../../functions/src/shared/decorum";
import { FurnitureArt } from "./DecorArt";
import { objectIcons, paintColors, roomIcons } from "./constants";

export function RoomScene({ room }: { room: DecorRoom }) {
  const Icon = roomIcons[room.type];
  return <div className="room-scene" style={{ "--wall-color": paintColors[room.wallColor] } as CSSProperties} role="img" aria-label={`${ROOM_LABELS[room.type]}，${COLOR_LABELS[room.wallColor]}牆面，${OBJECT_TYPES.map((t) => room.objects[t] ? objectLabel(room.objects[t]!) : "空位").join("、")}`}>
    <span className="scene-label"><Icon size={14} />{ROOM_LABELS[room.type]}</span>
    <span className="scene-furniture">{OBJECT_TYPES.map((t) => { const EmptyIcon = objectIcons[t]; return <span key={t}>{room.objects[t] ? <FurnitureArt object={room.objects[t]!} /> : <EmptyIcon className="scene-empty" size={22} />}</span>; })}</span>
  </div>;
}
