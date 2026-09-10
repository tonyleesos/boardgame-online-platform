import type { ConditionDefinition, ConditionExpression, HouseState, EvaluationContext, ObjectFilter, DecorObject, RoomScope, Comparison } from "./decorum";

const matches = (object: DecorObject, filter: ObjectFilter) =>
  (!filter.type || object.type === filter.type) && (!filter.color || object.color === filter.color) && (!filter.style || object.style === filter.style);
const compare = (n: number, op: Comparison, value: number) => op === "eq" ? n === value : op === "gte" ? n >= value : n <= value;
export function evaluateCondition(condition: ConditionDefinition | ConditionExpression, house: HouseState, context: EvaluationContext = {}): boolean {
  const e = "evaluator" in condition ? condition.evaluator : condition;
  const rooms = (scope?: RoomScope) => house.rooms.filter((r) =>
    (!context.scopeIds || context.scopeIds.includes(r.id)) &&
    (!scope?.ids || scope.ids.includes(r.id)) && (!scope?.type || r.type === scope.type) &&
    (!scope?.side || (scope.side === "left" ? r.column === 0 : r.column > 0)));
  const objects = (scope?: RoomScope) => rooms(scope).flatMap((r) => Object.values(r.objects ?? {}).filter((o): o is DecorObject => !!o));
  const room = (id: string) => house.rooms.find((r) => r.id === (id === "$room" ? context.roomId : id === "$bedroom" ? house.roommates?.[context.ownerId ?? ""] : id));
  const evaluate = (child: ConditionExpression, ctx = context) => evaluateCondition(child, house, ctx);
  switch (e.kind) {
    case "roomHasObject": case "roomHasNoObject": {
      const target = room(e.room);
      if (!target) return false;
      const has = Object.values(target.objects ?? {}).some((o) => o && matches(o, e.match));
      return e.kind === "roomHasObject" ? has : !has;
    }
    case "objectCount": return compare(objects(e.scope).filter((o) => matches(o, e.match ?? {})).length, e.comparison, e.value);
    case "styleCount": return compare(objects(e.scope).filter((o) => o.style === e.style).length, e.comparison, e.value);
    case "colorCount": return compare(
      (e.target !== "objects" ? rooms(e.scope).filter((r) => r.wallColor === e.color).length : 0) +
      (e.target !== "walls" ? objects(e.scope).filter((o) => o.color === e.color).length : 0), e.comparison, e.value);
    case "roomColor": return room(e.room)?.wallColor === e.color;
    case "wallColors": return !!room(e.first) && !!room(e.second) && (room(e.first)!.wallColor === room(e.second)!.wallColor) === e.same;
    case "everyRoom": return rooms(e.scope).every((r) => evaluate(e.condition, { ...context, roomId: r.id, scopeIds: [r.id] }));
    case "someRoom": return rooms(e.scope).some((r) => evaluate(e.condition, { ...context, roomId: r.id, scopeIds: [r.id] }));
    case "leftSide": case "rightSide": return evaluate(e.condition, { ...context, scopeIds: rooms({ side: e.kind === "leftSide" ? "left" : "right" }).map((r) => r.id) });
    case "sameRoom": return rooms().some((r) => {
      const os = Object.values(r.objects ?? {}).filter((o): o is DecorObject => !!o);
      return os.some((o) => matches(o, e.first)) && os.some((o) => matches(o, e.second));
    });
    case "differentRoom": return rooms().some((a) => rooms().some((b) => a.id !== b.id &&
      Object.values(a.objects ?? {}).some((o) => o && matches(o, e.first)) && Object.values(b.objects ?? {}).some((o) => o && matches(o, e.second))));
    case "and": return e.conditions.every((c) => evaluate(c));
    case "or": return e.conditions.some((c) => evaluate(c));
    case "not": return !evaluate(e.condition);
  }
}
export function evaluatePlayerConditions(conditions: ConditionDefinition[], house: HouseState, context: EvaluationContext = {}) {
  const results = conditions.map((c) => ({ conditionId: c.id, fulfilled: evaluateCondition(c, house, context) }));
  return { fulfilled: results.every((r) => r.fulfilled), results };
}
