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
const upstairs = { ids: ["bath", "bed"] };
const downstairs = { ids: ["living", "kitchen"] };
const blueLiving = condition("blue-living", "客廳至少有一件藍色物品；牆面不算。", { kind: "roomHasObject", room: "living", match: { color: "blue" } });
const quietKitchen = condition("quiet-kitchen", "廚房的燈具位置請留白。", { kind: "roomHasNoObject", room: "kitchen", match: { type: "lamp" } });
const greenLiving = condition("green-living", "客廳的牆面要是綠色。", { kind: "roomColor", room: "living", color: "green" });
const yellowBed = condition("yellow-bed", "主臥室的牆面要是黃色。", { kind: "roomColor", room: "bed", color: "yellow" });
const eachObject = condition("each-object", "每個房間至少有一件物品。", { kind: "everyRoom", condition: { kind: "objectCount", comparison: "gte", value: 1 } });
const eachTwo = condition("each-two", "每個房間至少有兩件物品。", { kind: "everyRoom", condition: { kind: "objectCount", comparison: "gte", value: 2 } });
const twoYellow = condition("two-yellow", "全屋剛好兩間房間使用黃色牆面。", { kind: "colorCount", color: "yellow", target: "walls", comparison: "eq", value: 2 });
const noOddLeft = condition("no-odd-left", "房子左側不能有奇特風格的物品。", { kind: "leftSide", condition: { kind: "styleCount", style: "unusual", comparison: "eq", value: 0 } });
const differentWalls = condition("different-walls", "主臥室與客廳的牆面顏色必須不同。", { kind: "wallColors", first: "bed", second: "living", same: false });
const threeRetro = condition("three-retro", "全屋剛好有三件復古風格的物品。", { kind: "styleCount", style: "retro", comparison: "eq", value: 3 });
const fourWalls = condition("four-walls", "四間房間的牆面顏色各不相同。", { kind: "distinctCount", trait: "color", target: "walls", comparison: "eq", value: 4 });
const downstairsSpace = condition("downstairs-space", "客廳與廚房合計剛好留兩個空物品格；牆面不算。", { kind: "emptySlotCount", scope: downstairs, comparison: "eq", value: 2 });
const yellowBedroomObject = condition("my-yellow-object", "我住的臥室至少有一件黃色物品；可以同時擺放其他顏色，牆面不算。", { kind: "roomHasObject", room: "$bedroom", match: { color: "yellow" } });
const blueBedroomObject = condition("my-blue-object", "我住的臥室至少有一件藍色物品；可以同時擺放其他顏色，牆面不算。", { kind: "roomHasObject", room: "$bedroom", match: { color: "blue" } });

// Use IDs so changing lobby order cannot accidentally pair unrelated wishes.
// Complete, legal solutions are kept only in tests/decorum-solutions.ts.
const definitions: Record<string, Record<number, ConditionDefinition[]>> = {
  "demo-two-01": {
    0: [blueLiving, quietKitchen, fourWalls,
      condition("two-retro", "全屋剛好有兩件復古風格的物品。", { kind: "styleCount", style: "retro", comparison: "eq", value: 2 })],
    1: [greenLiving, yellowBed, eachObject,
      condition("five-spaces", "全屋十二個物品格，剛好留下五個空格。", { kind: "emptySlotCount", comparison: "eq", value: 5 })],
  },
  "demo-two-02": {
    0: [threeRetro, quietKitchen, noOddLeft,
      condition("nine-objects", "全屋剛好擺放九件物品。", { kind: "objectCount", comparison: "eq", value: 9 }),
      condition("all-styles", "全屋的物品要涵蓋全部四種風格；牆面沒有風格。", { kind: "distinctCount", trait: "style", target: "objects", comparison: "eq", value: 4 })],
    1: [twoYellow, differentWalls,
      condition("blue-lamp-antique", "至少一間房間同時有藍色燈具與古典擺飾。", { kind: "sameRoom", first: { type: "lamp", color: "blue" }, second: { type: "curio", style: "antique" } }),
      condition("upstairs-no-green", "樓上兩間房間的牆面和物品都不能有綠色。", { kind: "colorCount", scope: upstairs, color: "green", target: "both", comparison: "eq", value: 0 }),
      condition("kitchen-antique", "廚房至少有一件古典風格的物品。", { kind: "roomHasObject", room: "kitchen", match: { style: "antique" } })],
  },
  "demo-three-01": {
    0: [greenLiving, quietKitchen, eachTwo, noOddLeft,
      condition("all-object-colors", "全屋的物品要涵蓋全部四種顏色；牆面不算。", { kind: "distinctCount", trait: "color", target: "objects", comparison: "eq", value: 4 })],
    1: [twoYellow, blueLiving, downstairsSpace,
      condition("upstairs-one-red", "樓上兩間房間合計剛好有一件紅色物品。", { kind: "colorCount", scope: upstairs, color: "red", target: "objects", comparison: "eq", value: 1 }),
      condition("bath-three-styles", "浴室的物品必須有三種不同風格。", { kind: "distinctCount", scope: { ids: ["bath"] }, trait: "style", target: "objects", comparison: "eq", value: 3 })],
    2: [threeRetro,
      condition("two-antiques", "全屋剛好有兩件古典風格的物品。", { kind: "styleCount", style: "antique", comparison: "eq", value: 2 }),
      condition("blue-bed", "主臥室的牆面要是藍色。", { kind: "roomColor", room: "bed", color: "blue" }),
      condition("bath-yellow-lamp", "浴室要有黃色燈具。", { kind: "roomHasObject", room: "bath", match: { type: "lamp", color: "yellow" } }),
      condition("kitchen-modern-art", "廚房要有現代風格的壁飾。", { kind: "roomHasObject", room: "kitchen", match: { type: "wallHanging", style: "modern" } })],
  },
  "demo-four-01": {
    // Both bedroom preferences can coexist in a shared room under every shuffle.
    // Moving remains optional instead of forcing roommates to repaint each other.
    0: [greenLiving, quietKitchen, yellowBedroomObject, fourWalls,
      condition("upstairs-three-styles", "兩間臥室的物品合計剛好有三種不同風格。", { kind: "distinctCount", scope: upstairs, trait: "style", target: "objects", comparison: "eq", value: 3 })],
    1: [blueLiving, eachTwo, blueBedroomObject,
      condition("living-antique", "客廳至少有一件古典風格的物品。", { kind: "roomHasObject", room: "living", match: { style: "antique" } }),
      condition("downstairs-two-blue", "客廳與廚房合計剛好有兩件藍色物品；牆面不算。", { kind: "colorCount", scope: downstairs, color: "blue", target: "objects", comparison: "eq", value: 2 })],
    2: [noOddLeft, yellowBedroomObject, threeRetro,
      condition("kitchen-green-curio", "廚房要有綠色擺飾。", { kind: "roomHasObject", room: "kitchen", match: { type: "curio", color: "green" } }),
      condition("full-bedrooms", "兩間臥室各擺滿三件物品。", { kind: "everyRoom", scope: upstairs, condition: { kind: "objectCount", comparison: "eq", value: 3 } })],
    3: [blueBedroomObject, differentWalls, downstairsSpace,
      condition("bedroom-lights", "兩間臥室都要有燈具，顏色與風格不限。", { kind: "everyRoom", scope: upstairs, condition: { kind: "roomHasObject", room: "$room", match: { type: "lamp" } } }),
      condition("three-antiques", "全屋剛好有三件古典風格的物品。", { kind: "styleCount", style: "antique", comparison: "eq", value: 3 })],
  },
};

export const decorumScenarios: DecorumScenario[] = DECORUM_SCENARIOS.map((info) => {
  const layout = rooms.map((r) => info.enableRoommateTokens && r.id === "bath" ? { ...r, type: "bedroom2" as const, capacity: 2 } : { ...r });
  const playerConditions = definitions[info.id];
  if (!playerConditions || Object.keys(playerConditions).length !== info.playerCount) throw new Error(`Invalid Decorum scenario: ${info.id}`);
  return { ...info, rooms: layout, initialHouse: initial(layout), playerConditions: structuredClone(playerConditions) };
});
