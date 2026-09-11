import { useState } from "react";
import { Paintbrush, Trash2, ArrowLeftRight, ArrowRight, Check, BedDouble } from "lucide-react";
import { GameDialog } from "../../components/GameDialog";
import { FurnitureArt } from "./DecorArt";
import { paintColors, objectIcons } from "./constants";
import { RoomScene } from "./RoomScene";
import { DECOR_COLORS, DECOR_OBJECTS, OBJECT_TYPES, COLOR_LABELS, OBJECT_LABELS, ROOM_LABELS, objectLabel } from "../../../../functions/src/shared/decorum";
import type { DecorumPublicState, DecorRoom, HouseAction, ObjectType } from "../../../../functions/src/shared/decorum";
export type RoomSheetMode = "paint" | "roommate" | ObjectType;
export function RoomActionSheet({ room, game, uid, initialMode, name, disabled, error, onClose, onConfirm }: {
  room: DecorRoom; game: DecorumPublicState; uid: string; initialMode: RoomSheetMode;
  name: (uid: string) => string; disabled: boolean; error: string | null;
  onClose: () => void; onConfirm: (action: HouseAction) => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [preview, setPreview] = useState<HouseAction | null>(null);
  const occupants = Object.entries(game.house.roommates).filter(([, id]) => id === room.id).map(([id]) => id);
  const canMove = game.enableRoommateTokens && (room.type === "bedroom" || room.type === "bedroom2") && game.house.roommates[uid] !== room.id;
  const object = preview && "objectId" in preview ? DECOR_OBJECTS.find((o) => o.id === preview.objectId) : null;
  const previewRoom: DecorRoom = { ...room, objects: { ...room.objects } };
  if (preview?.type === "decorPaint") previewRoom.wallColor = preview.color;
  if (object) previewRoom.objects[object.type] = object;
  if (preview?.type === "decorRemove") previewRoom.objects[preview.objectType] = null;
  return <GameDialog title={`佈置${ROOM_LABELS[room.type]}`} onClose={onClose} className="decorum-dialog decorum-action-sheet">
    <p className="eyebrow">ONE LITTLE CHANGE</p><h2>讓這個角落更像家。</h2>
    <div className="decor-tabs" aria-label="佈置類型">{[...OBJECT_TYPES, "paint" as const, ...(canMove ? ["roommate" as const] : [])].map((tab) => { const Icon = tab === "paint" ? Paintbrush : tab === "roommate" ? ArrowLeftRight : objectIcons[tab]; return <button key={tab} aria-pressed={mode === tab} onClick={() => { setMode(tab); setPreview(null); }}><Icon size={19} />{tab === "paint" ? "牆面" : tab === "roommate" ? "換房" : OBJECT_LABELS[tab]}</button>; })}</div>
    {mode === "paint" ? <div className="paint-options">{DECOR_COLORS.map((color) => <button key={color} aria-label={`選擇${COLOR_LABELS[color]}`} aria-pressed={preview?.type === "decorPaint" && preview.color === color} disabled={disabled || room.wallColor === color} onClick={() => setPreview({ type: "decorPaint", roomId: room.id, color })}><span style={{ background: paintColors[color] }}>{room.wallColor === color && <Check size={22} />}</span><strong>{COLOR_LABELS[color]}</strong><small>{room.wallColor === color ? "目前牆色" : "選擇牆色"}</small></button>)}</div>
      : mode === "roommate" ? <div className="roommate-choices"><p>每間臥室最多 {room.capacity ?? 1} 人。{occupants.length >= (room.capacity ?? 1) ? "選擇一位室友互換房間。" : "這間臥室還有空位。"}</p>{occupants.length >= (room.capacity ?? 1) ? occupants.map((id) => <button key={id} disabled={disabled} aria-pressed={preview?.type === "decorRoommate" && preview.swapWith === id} onClick={() => setPreview({ type: "decorRoommate", roomId: room.id, swapWith: id })}><ArrowLeftRight size={18} />和 {name(id)} 交換</button>) : <button disabled={disabled} onClick={() => setPreview({ type: "decorRoommate", roomId: room.id })}>搬進{ROOM_LABELS[room.type]}</button>}</div>
      : <><p className="decor-help">{room.objects[mode] ? `目前是${objectLabel(room.objects[mode]!)}。可替換同類物品或移除。` : `這裡還沒有${OBJECT_LABELS[mode]}，挑一件喜歡的。`}</p><div className="furniture-catalog">{DECOR_OBJECTS.filter((o) => o.type === mode).map((o) => <button key={o.id} aria-label={`選擇${objectLabel(o)}`} disabled={disabled || room.objects[mode]?.id === o.id} aria-pressed={!!preview && "objectId" in preview && preview.objectId === o.id} onClick={() => setPreview({ type: room.objects[mode] ? "decorSwap" : "decorAdd", roomId: room.id, objectId: o.id })}><FurnitureArt object={o} /><span>{objectLabel(o)}</span></button>)}</div>{room.objects[mode] && <button className="decor-remove" disabled={disabled} onClick={() => setPreview({ type: "decorRemove", roomId: room.id, objectType: mode })}><Trash2 size={16} />移除{OBJECT_LABELS[mode]}</button>}</>}
    {preview && <div className="decor-preview" role="status">
      {preview.type === "decorRoommate" ? <div className="move-preview"><BedDouble size={32} /><span>你<ArrowRight size={18} />{ROOM_LABELS[room.type]}</span>{preview.swapWith && <small>與 {name(preview.swapWith)} 交換房間</small>}</div>
        : <div className="room-comparison"><div><small>現在</small><RoomScene room={room} /></div><ArrowRight size={20} /><div><small>確認後</small><RoomScene room={previewRoom} /></div></div>}
      <span>{object ? `${preview.type === "decorAdd" ? "加入" : "換成"}${objectLabel(object)}` : preview.type === "decorPaint" ? `${COLOR_LABELS[room.wallColor]} → ${COLOR_LABELS[preview.color]}` : preview.type === "decorRemove" ? `移除${OBJECT_LABELS[preview.objectType]}` : "確認後交換室友位置"}</span>
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primary decor-confirm" disabled={disabled || !preview} onClick={() => preview && onConfirm(preview)}>確認這次佈置</button><p className="decor-help">每回合只做一件事，確認後等待室友回應。</p>
  </GameDialog>;
}
