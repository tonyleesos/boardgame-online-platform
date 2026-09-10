// SERVER ONLY. These are original project scenarios, not commercial card text.
import { DECORUM_SCENARIOS, DECOR_OBJECTS } from "../shared/decorum";
import type { ConditionDefinition, ConditionExpression, DecorumScenario, HouseState, RoomDefinition } from "../shared/decorum";

const rooms: RoomDefinition[] = [
  { id: "bath", type: "bathroom", row: 0, column: 0 },
  { id: "bed", type: "bedroom", row: 0, column: 1, capacity: 2 },
  { id: "living", type: "livingRoom", row: 1, column: 0 },
  { id: "kitchen", type: "kitchen", row: 1, column: 1 },
];
function initial(definitions: RoomDefinition[]): HouseState {
  return { roommates: {}, rooms: definitions.map((r) => ({ ...r, wallColor: "red",
    objects: { lamp: r.id === "bath" ? null : structuredClone(DECOR_OBJECTS.find((o) => o.id === (r.id === "bed" ? "lamp-yellow-retro" : "lamp-red-antique"))!),
      curio: r.id === "bath" ? structuredClone(DECOR_OBJECTS.find((o) => o.id === "curio-green-modern")!) : null, wallHanging: null },
  })) };
}
const condition = (id: string, description: string, evaluator: ConditionExpression): ConditionDefinition => ({ id, description, evaluator });
const blueLiving = condition("blue-living", "客廳裡，至少一件物品要帶著藍色。", { kind: "roomHasObject", room: "living", match: { color: "blue" } });
const quietKitchen = condition("quiet-kitchen", "廚房的燈具位置請留白。", { kind: "roomHasNoObject", room: "kitchen", match: { type: "lamp" } });
const greenLiving = condition("green-living", "我想在綠色牆面的客廳休息。", { kind: "roomColor", room: "living", color: "green" });
const yellowBed = condition("yellow-bed", "主臥室的牆面要像黃色的晨光。", { kind: "roomColor", room: "bed", color: "yellow" });
const eachObject = condition("each-object", "每一個房間都該有至少一件物品。", { kind: "everyRoom", condition: { kind: "objectCount", comparison: "gte", value: 1 } });
const twoYellow = condition("two-yellow", "至少兩個房間，請選用黃色牆面。", { kind: "colorCount", color: "yellow", target: "walls", comparison: "gte", value: 2 });
const noOddLeft = condition("no-odd-left", "房子左半邊，別放奇特風格的物品。", { kind: "leftSide", condition: { kind: "not", condition: { kind: "styleCount", style: "unusual", comparison: "gte", value: 1 } } });
const differentWalls = condition("different-walls", "主臥室與客廳，牆面不要用同一種顏色。", { kind: "wallColors", first: "bed", second: "living", same: false });
const definitions: Array<Record<number, ConditionDefinition[]>> = [
  { 0: [blueLiving, quietKitchen, condition("sunny-room", "屋子裡，至少有一間黃色牆面的房間。", { kind: "someRoom", condition: { kind: "roomColor", room: "$room", color: "yellow" } })],
    1: [greenLiving, yellowBed, eachObject] },
  { 0: [condition("three-retro", "我的復古收藏，剛好三件就好。", { kind: "styleCount", style: "retro", comparison: "eq", value: 3 }), quietKitchen, noOddLeft],
    1: [twoYellow, condition("blue-lamp-curio", "藍色燈具與一件擺飾，要出現在同一個房間。", { kind: "sameRoom", first: { type: "lamp", color: "blue" }, second: { type: "curio" } }), differentWalls] },
  { 0: [greenLiving, quietKitchen, eachObject], 1: [twoYellow, blueLiving, noOddLeft],
    2: [condition("antique-touch", "至少留下一件古典物品，當作歲月的痕跡。", { kind: "objectCount", match: { style: "antique" }, comparison: "gte", value: 1 }), yellowBed, differentWalls] },
  { 0: [greenLiving, quietKitchen, condition("my-yellow-bedroom", "我住的臥室，牆面要是黃色。", { kind: "roomColor", room: "$bedroom", color: "yellow" })],
    1: [blueLiving, eachObject, condition("my-blue-bedroom", "我住的臥室，牆面要是藍色。", { kind: "roomColor", room: "$bedroom", color: "blue" })],
    2: [noOddLeft, condition("my-yellow-bedroom", "我的臥室要有黃色牆面，才睡得安心。", { kind: "roomColor", room: "$bedroom", color: "yellow" }), condition("kitchen-curio", "廚房至少有一件黃色或綠色的擺飾。", { kind: "or", conditions: [ { kind: "roomHasObject", room: "kitchen", match: { type: "curio", color: "yellow" } }, { kind: "roomHasObject", room: "kitchen", match: { type: "curio", color: "green" } } ] })],
    3: [condition("my-blue-bedroom", "我的臥室請保留藍色牆面。", { kind: "roomColor", room: "$bedroom", color: "blue" }), condition("bedroom-lights", "兩間臥室都要有燈，風格不限。", { kind: "and", conditions: [ { kind: "roomHasObject", room: "bed", match: { type: "lamp" } }, { kind: "roomHasObject", room: "bath", match: { type: "lamp" } } ] }), differentWalls] },
];

export const decorumScenarios: DecorumScenario[] = DECORUM_SCENARIOS.map((info, i) => {
  const layout = rooms.map((r) => info.enableRoommateTokens && r.id === "bath" ? { ...r, type: "bedroom2" as const, capacity: 2 } : { ...r });
  return { ...info, rooms: layout, initialHouse: initial(layout), playerConditions: structuredClone(definitions[i]) };
});
