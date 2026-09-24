export type Edge = "N" | "E" | "S" | "W";
export type Team = "BLUE" | "GREEN";
export type DwarfRole =
  | "BLUE_DIGGER"
  | "GREEN_DIGGER"
  | "SABOTEUR"
  | "BOSS"
  | "PROFITEER"
  | "GEOLOGIST";
export const DWARF_ROLE_NAMES: Record<DwarfRole, string> = {
  BLUE_DIGGER: "藍隊挖金矮人",
  GREEN_DIGGER: "綠隊挖金矮人",
  SABOTEUR: "破壞者",
  BOSS: "工頭",
  PROFITEER: "奸商",
  GEOLOGIST: "地質學家",
};
export const DWARF_ROLE_HELP: Record<DwarfRole, string> = {
  BLUE_DIGGER: "讓藍隊通往黃金。綠門會阻擋你；由藍隊完成連線時，藍隊優先獲勝。",
  GREEN_DIGGER:
    "讓綠隊通往黃金。藍門會阻擋你；由綠隊完成連線時，綠隊優先獲勝。",
  SABOTEUR: "阻止礦道連到黃金。所有手牌用完仍未找到黃金，破壞者獲勝。",
  BOSS: "找到黃金就能分紅，不受色門限制；比一般勝者少拿 1 金。",
  PROFITEER: "不論找到黃金或破壞成功，都能加入勝方；比一般勝者少拿 2 金。",
  GEOLOGIST:
    "在礦道上留下水晶。依場上水晶數獲得金塊；兩名未受困地質學家平分，無條件捨去。",
};
export const ROLE_DECK: DwarfRole[] = [
  ...Array<DwarfRole>(4).fill("BLUE_DIGGER"),
  ...Array<DwarfRole>(4).fill("GREEN_DIGGER"),
  ...Array<DwarfRole>(3).fill("SABOTEUR"),
  "BOSS",
  "PROFITEER",
  "GEOLOGIST",
  "GEOLOGIST",
];
export type Tool = "PICKAXE" | "LANTERN" | "CART";
export type Effect = Tool | "TRAPPED" | "THEFT";
export const EFFECT_NAMES: Record<Effect, string> = {
  PICKAXE: "十字鎬損壞",
  LANTERN: "礦燈損壞",
  CART: "礦車損壞",
  TRAPPED: "被困住",
  THEFT: "偷竊待結算",
};
export type ActionKind =
  | "BREAK"
  | "REPAIR"
  | "ROCKFALL"
  | "MAP"
  | "THEFT"
  | "HANDS_OFF"
  | "SWAP_HANDS"
  | "INSPECTION"
  | "CHANGE_HATS"
  | "TRAPPED"
  | "FREEDOM";
export const ACTION_NAMES: Record<ActionKind, string> = {
  BREAK: "破壞工具",
  REPAIR: "修復工具",
  ROCKFALL: "落石",
  MAP: "藏寶圖",
  THEFT: "偷竊",
  HANDS_OFF: "別碰我的金塊",
  SWAP_HANDS: "交換手牌",
  INSPECTION: "偵查身份",
  CHANGE_HATS: "更換身份",
  TRAPPED: "設下陷阱",
  FREEDOM: "重獲自由",
};
export interface PathCard {
  id: string;
  kind: "path";
  name: string;
  channels: Edge[][];
  source: "base" | "expansion";
  crystalCount?: number;
  ladder?: boolean;
  door?: Team;
  special?: "BRIDGE" | "DOUBLE_BEND";
}
export interface ActionCard {
  id: string;
  kind: "action";
  name: string;
  action: ActionKind;
  tools?: Tool[];
}
export type MineCard = PathCard | ActionCard;
const paths: PathCard[] = [];
function path(
  name: string,
  channels: Edge[][],
  copies: number,
  extra: Partial<PathCard> = {},
) {
  for (let i = 0; i < copies; i++)
    paths.push({
      id: `path-${paths.length}`,
      kind: "path",
      name,
      channels,
      source: "base",
      ...extra,
    });
}
// Original functional deck, separate from art. Independent one-port channels are dead ends.
path("東西礦道", [["W", "E"]], 8);
path("南北礦道", [["N", "S"]], 5);
path("轉角礦道", [["W", "N"]], 5);
path("彎曲礦道", [["W", "S"]], 5);
path("三岔礦道", [["W", "E", "N"]], 5);
path("側向岔路", [["N", "S", "W"]], 4);
path("十字礦道", [["N", "E", "S", "W"]], 4);
path("封閉支道", [["W"]], 3);
path("堵塞礦道", [["W"], ["E"]], 3);
path("堵塞轉角", [["N"], ["W"]], 2);
path(
  "跨越橋梁",
  [
    ["N", "S"],
    ["E", "W"],
  ],
  2,
  { source: "expansion", special: "BRIDGE" },
);
path(
  "雙彎道",
  [
    ["N", "E"],
    ["S", "W"],
  ],
  2,
  { source: "expansion", special: "DOUBLE_BEND" },
);
path("升降梯", [["W", "E", "N", "S"]], 4, {
  source: "expansion",
  ladder: true,
});
for (const door of ["BLUE", "GREEN"] as Team[])
  path(`${door === "BLUE" ? "藍" : "綠"}色門`, [["W", "E", "N"]], 3, {
    source: "expansion",
    door,
  });
for (let i = 0; i < 16; i++)
  path(
    "水晶礦道",
    i % 3 === 0
      ? [["W", "E", "N", "S"]]
      : i % 3 === 1
        ? [["W", "E"]]
        : [["W", "N"]],
    1,
    { source: "expansion", crystalCount: i % 4 === 0 ? 2 : 1 },
  );
const actions: ActionCard[] = [];
function action(kind: ActionKind, count: number, tools?: Tool[]) {
  for (let i = 0; i < count; i++)
    actions.push({
      id: `action-${actions.length}`,
      kind: "action",
      name: ACTION_NAMES[kind],
      action: kind,
      ...(tools ? { tools } : {}),
    });
}
for (const t of ["PICKAXE", "LANTERN", "CART"] as Tool[]) {
  action("BREAK", 3, [t]);
  action("REPAIR", 2, [t]);
}
action("REPAIR", 1, ["PICKAXE", "LANTERN"]);
action("REPAIR", 1, ["PICKAXE", "CART"]);
action("REPAIR", 1, ["LANTERN", "CART"]);
action("MAP", 6);
action("ROCKFALL", 3);
for (const [kind, count] of [
  ["THEFT", 4],
  ["HANDS_OFF", 3],
  ["SWAP_HANDS", 2],
  ["INSPECTION", 2],
  ["CHANGE_HATS", 2],
  ["TRAPPED", 3],
  ["FREEDOM", 4],
] as [ActionKind, number][])
  action(kind, count);
export const MINE_CARDS: MineCard[] = [...paths, ...actions];
export const MINE_CARD_BY_ID: Record<string, MineCard> = Object.fromEntries(
  MINE_CARDS.map((c) => [c.id, c]),
);
export interface MineTile {
  x: number;
  y: number;
  cardId: string;
  rotation: 0 | 180;
  type: "path" | "start" | "goal";
  revealed?: "GOLD" | "ROCK";
}
export type MineBoard = Record<string, MineTile>;
export const cellKey = (x: number, y: number) => `${x}_${y}`;
export const GOAL_KEYS = ["8_-2", "8_0", "8_2"];
export const MINE_MOTION_MS = 3200;
export const MINE_BOT_DELAY = 3600;
export interface MinePlayer {
  uid: string;
  nickname: string;
  handCount: number;
  effects: Partial<Record<Effect, { cardId: string; sequence: number }>>;
  hasGold: boolean;
}
export interface MinePrivate {
  gameId: string;
  revision: number;
  round: number;
  role: DwarfRole;
  hand: string[];
  gold: number;
  goals: Record<string, "GOLD" | "ROCK">;
  inspections: Array<{ uid: string; role: DwarfRole; revision: number }>;
  roleVersion: number;
  notice?: { title: string; text: string };
}
export interface MineActivity {
  revision: number;
  uid: string;
  text: string;
  kind: string;
  target?: string;
  cell?: string;
  cardId?: string;
  rotation?: 0 | 180;
  goals?: string[];
}
export interface MineRoundResult {
  reason: "TREASURE_REACHED" | "NO_CARDS_LEFT";
  roles: Record<string, DwarfRole>;
  awards: Record<string, number>;
  blue: boolean;
  green: boolean;
  crystals: number;
  trapped: string[];
}
export interface MineGame {
  id: string;
  revision: number;
  round: number;
  phase:
    | "PLAYER_ACTION"
    | "PRIVATE_RESULT"
    | "THEFT_RESOLUTION"
    | "ROUND_RESULT"
    | "GAME_OVER";
  order: string[];
  current: number;
  board: MineBoard;
  players: Record<string, MinePlayer>;
  drawCount: number;
  discardCount: number;
  turn: number;
  finalPlayer?: string;
  connector?: string;
  result?: MineRoundResult;
  theftQueue: string[];
  activities: MineActivity[];
  totals?: Record<string, number>;
  winners?: string[];
  aborted?: boolean;
}
export interface MineSecret {
  deck: string[];
  removed: string[];
  discard: string[];
  roles: DwarfRole[];
  goals: Record<string, "GOLD" | "ROCK">;
  pendingCard?: string;
}
export type MineAction =
  | {
      type: "minePath";
      cardId: string;
      x: number;
      y: number;
      rotation: 0 | 180;
    }
  | {
      type: "mineAction";
      cardId: string;
      target?: string;
      cell?: string;
      tool?: Tool;
    }
  | { type: "minePass"; cards: string[] }
  | { type: "mineClean"; cards: string[]; effect: Effect }
  | { type: "mineAcknowledge" }
  | { type: "mineSteal"; target: string }
  | { type: "mineNext" };
export const mineToken = (g: MineGame) => `${g.id}:${g.revision}`;
export const mineActor = (g: MineGame) =>
  g.phase === "THEFT_RESOLUTION" ? g.theftQueue[0] : g.order[g.current];
export const pathBlocked = (p: MinePlayer) =>
  (["PICKAXE", "LANTERN", "CART", "TRAPPED"] as Effect[]).some(
    (e) => !!p.effects[e],
  );
export function normalizeMine(g: MineGame) {
  g.activities ??= [];
  g.theftQueue ??= [];
  g.board ??= {};
  g.players ??= {};
  for (const p of Object.values(g.players)) p.effects ??= {};
  if (g.result) {
    g.result.trapped ??= [];
    g.result.awards ??= {};
  }
  return g;
}
export function normalizeMinePrivate(p: MinePrivate) {
  p.hand ??= [];
  p.goals ??= {};
  p.inspections ??= [];
  return p;
}
