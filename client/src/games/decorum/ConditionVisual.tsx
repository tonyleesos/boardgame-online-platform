import { Ban, House, Paintbrush, Boxes, ArrowLeft, ArrowRight, BedDouble } from "lucide-react";
import type { ReactNode } from "react";
import type { ConditionDefinition, ConditionExpression, HouseState, ObjectFilter, RoomScope } from "../../../../functions/src/shared/decorum";
import { COLOR_LABELS, OBJECT_LABELS, ROOM_LABELS, STYLE_LABELS } from "../../../../functions/src/shared/decorum";
import { objectIcons, paintColors, roomIcons, styleIcons } from "./constants";

function Chip({ children }: { children: ReactNode }) { return <span className="wish-chip">{children}</span>; }
function Filter({ match }: { match: ObjectFilter }) {
  const ObjectIcon = match.type ? objectIcons[match.type] : Boxes;
  const StyleIcon = match.style ? styleIcons[match.style] : null;
  return <><Chip><ObjectIcon size={18} />{match.type ? OBJECT_LABELS[match.type] : "物品"}</Chip>
    {match.color && <Chip><i className="wish-color" style={{ background: paintColors[match.color] }} />{COLOR_LABELS[match.color]}</Chip>}
    {match.style && StyleIcon && <Chip><StyleIcon size={17} />{STYLE_LABELS[match.style]}</Chip>}</>;
}
function Expression({ expr, house, ownerId, scoped = false }: { expr: ConditionExpression; house: HouseState; ownerId: string; scoped?: boolean }) {
  const room = (id: string) => {
    if (id === "$room") return <Chip><House size={17} />該房間</Chip>;
    const value = house.rooms.find((r) => r.id === (id === "$bedroom" ? house.roommates[ownerId] : id));
    const Icon = value ? roomIcons[value.type] : BedDouble;
    return <Chip><Icon size={18} />{id === "$bedroom" ? `所住臥室${value ? `・${ROOM_LABELS[value.type]}` : ""}` : value ? ROOM_LABELS[value.type] : id}</Chip>;
  };
  const scope = (value?: RoomScope) => value ? <>{value.ids?.map((id) => <span key={id}>{room(id)}</span>)}{value.side && <Chip>{value.side === "left" ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}{value.side === "left" ? "左側" : "右側"}</Chip>}{value.type && <Chip>{ROOM_LABELS[value.type]}</Chip>}</> : scoped ? null : <Chip><House size={17} />全屋</Chip>;
  const count = (comparison: "eq" | "gte" | "lte", value: number) => <b className="wish-count">{{ eq: "＝", gte: "≥", lte: "≤" }[comparison]} {value}</b>;
  const nested = (condition: ConditionExpression) => <Expression expr={condition} house={house} ownerId={ownerId} scoped={scoped || ["everyRoom", "someRoom", "leftSide", "rightSide"].includes(expr.kind)} />;
  switch (expr.kind) {
    case "roomHasObject": case "roomHasNoObject": return <>{room(expr.room)}{expr.kind === "roomHasNoObject" ? <Chip><Ban size={18} />不要</Chip> : <b className="wish-operator">有</b>}<Filter match={expr.match} /></>;
    case "roomColor": return <>{room(expr.room)}<Chip><Paintbrush size={17} />牆面</Chip><Chip><i className="wish-color" style={{ background: paintColors[expr.color] }} />{COLOR_LABELS[expr.color]}</Chip></>;
    case "objectCount": return <>{scope(expr.scope)}<Filter match={expr.match ?? {}} />{count(expr.comparison, expr.value)}</>;
    case "styleCount": return <>{scope(expr.scope)}<Filter match={{ style: expr.style }} />{count(expr.comparison, expr.value)}</>;
    case "colorCount": return <>{scope(expr.scope)}<Chip><i className="wish-color" style={{ background: paintColors[expr.color] }} />{COLOR_LABELS[expr.color]}</Chip><Chip>{expr.target === "walls" ? <Paintbrush size={17} /> : <Boxes size={17} />}{expr.target === "walls" ? "牆面" : expr.target === "objects" ? "物品" : "牆面＋物品"}</Chip>{count(expr.comparison, expr.value)}</>;
    case "wallColors": return <>{room(expr.first)}<Chip><Paintbrush size={17} />牆色</Chip><b className="wish-count">{expr.same ? "＝" : "≠"}</b>{room(expr.second)}<Chip><Paintbrush size={17} />牆色</Chip></>;
    case "everyRoom": case "someRoom": return <><Chip><House size={18} />{expr.kind === "everyRoom" ? "每個房間" : "至少一間"}</Chip>{expr.scope && scope(expr.scope)}<span className="wish-group">{nested(expr.condition)}</span></>;
    case "leftSide": case "rightSide": return <><Chip>{expr.kind === "leftSide" ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}{expr.kind === "leftSide" ? "房屋左側" : "房屋右側"}</Chip><span className="wish-group">{nested(expr.condition)}</span></>;
    case "not": return <><Chip><Ban size={18} />不可</Chip><span className="wish-group">{nested(expr.condition)}</span></>;
    case "sameRoom": case "differentRoom": return <><span className="wish-group"><Filter match={expr.first} /></span><Chip><House size={18} />{expr.kind === "sameRoom" ? "同一間" : "不同間"}</Chip><span className="wish-group"><Filter match={expr.second} /></span></>;
    case "and": case "or": return <>{expr.conditions.map((c, i) => <span className="wish-clause" key={i}>{i > 0 && <b className="wish-operator">{expr.kind === "and" ? "而且" : "或"}</b>}<span className="wish-group">{nested(c)}</span></span>)}</>;
  }
}

/** Receives only conditions the caller is already authorized to see. */
export function ConditionVisual({ condition, house, ownerId }: { condition: ConditionDefinition; house: HouseState; ownerId: string }) {
  return <span className="condition-visual" role="img" aria-label={condition.description}><span aria-hidden="true"><Expression expr={condition.evaluator} house={house} ownerId={ownerId} /></span></span>;
}
