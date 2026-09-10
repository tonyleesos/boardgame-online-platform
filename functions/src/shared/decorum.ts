export const DECOR_COLORS = ["red", "yellow", "blue", "green"] as const;
export const DECOR_STYLES = ["modern", "antique", "retro", "unusual"] as const;
export const OBJECT_TYPES = ["lamp", "curio", "wallHanging"] as const;
export type DecorColor = typeof DECOR_COLORS[number];
export type DecorStyle = typeof DECOR_STYLES[number];
export type ObjectType = typeof OBJECT_TYPES[number];
export type RoomType = "livingRoom" | "kitchen" | "bedroom" | "bedroom2" | "bathroom";
export const COLOR_LABELS = { red: "珊瑚紅", yellow: "奶油黃", blue: "湖水藍", green: "鼠尾草綠" };
export const STYLE_LABELS = { modern: "現代", antique: "古典", retro: "復古", unusual: "奇特" };
export const OBJECT_LABELS = { lamp: "燈具", curio: "擺飾", wallHanging: "壁飾" };
export const ROOM_LABELS = { livingRoom: "客廳", kitchen: "廚房", bedroom: "臥室", bedroom2: "次臥", bathroom: "浴室" };
export const REACTION_LABELS = { positive: "喜歡", neutral: "沒意見", negative: "不喜歡" };
export type ReactionType = keyof typeof REACTION_LABELS;
export interface DecorObject { id: string; type: ObjectType; color: DecorColor; style: DecorStyle }
export interface RoomDefinition { id: string; type: RoomType; row: number; column: number; capacity?: number }
export interface DecorRoom extends RoomDefinition {
  wallColor: DecorColor;
  objects: Record<ObjectType, DecorObject | null>;
}
export interface HouseState { rooms: DecorRoom[]; roommates: Record<string, string> }
export interface ObjectFilter { type?: ObjectType; color?: DecorColor; style?: DecorStyle }
export interface RoomScope { ids?: string[]; side?: "left" | "right"; type?: RoomType }
export type RoomRef = string; // Explicit ID, $room in quantifiers, or $bedroom for the owner.
export type Comparison = "eq" | "gte" | "lte";
export type ConditionExpression =
  | { kind: "roomHasObject" | "roomHasNoObject"; room: RoomRef; match: ObjectFilter }
  | { kind: "objectCount"; scope?: RoomScope; match?: ObjectFilter; comparison: Comparison; value: number }
  | { kind: "colorCount"; scope?: RoomScope; color: DecorColor; target: "walls" | "objects" | "both"; comparison: Comparison; value: number }
  | { kind: "styleCount"; scope?: RoomScope; style: DecorStyle; comparison: Comparison; value: number }
  | { kind: "roomColor"; room: RoomRef; color: DecorColor }
  | { kind: "wallColors"; first: RoomRef; second: RoomRef; same: boolean }
  | { kind: "everyRoom" | "someRoom"; scope?: RoomScope; condition: ConditionExpression }
  | { kind: "leftSide" | "rightSide" | "not"; condition: ConditionExpression }
  | { kind: "sameRoom" | "differentRoom"; first: ObjectFilter; second: ObjectFilter }
  | { kind: "and" | "or"; conditions: ConditionExpression[] };
export interface ConditionDefinition { id: string; description: string; evaluator: ConditionExpression }
export interface EvaluationContext { ownerId?: string; roomId?: string; scopeIds?: string[] }
export interface SharedCondition { ownerId: string; condition: ConditionDefinition }
export interface DecorumPrivate {
  gameId: string;
  conditions: ConditionDefinition[];
  sharedConditionsReceived: SharedCondition[];
  sharedConditionIds: string[];
}
export type DecorumPhase = "SETUP" | "PLAYER_ACTION" | "FULFILLMENT_CHECK" | "REACTION" | "ROUND_END" | "HEART_TO_HEART" | "HOUSE_MEETING" | "GAME_OVER";
export type HouseAction =
  | { type: "decorAdd" | "decorSwap"; roomId: string; objectId: string }
  | { type: "decorRemove"; roomId: string; objectType: ObjectType }
  | { type: "decorPaint"; roomId: string; color: DecorColor }
  | { type: "decorPass" }
  | { type: "decorRoommate"; roomId: string; swapWith?: string };
export type DecorumAction = HouseAction
  | { type: "decorReady" }
  | { type: "decorReact"; reaction: ReactionType }
  | { type: "decorShare"; conditionId: string; recipientId: string; status: ReactionType };
export interface DecorumPublicState {
  id: string; revision: number; phase: DecorumPhase; scenarioId: string;
  playerOrder: string[]; currentPlayerIndex: number; round: number; turn: number;
  maxRounds: number; heartsRemaining: number; house: HouseState; enableRoommateTokens: boolean;
  playerFulfilled: Record<string, boolean>; confirmed: Record<string, boolean>;
  latestAction?: { actorId: string; action: HouseAction };
  reactions: Record<string, ReactionType>; lastReactions: Record<string, ReactionType>;
  meetingSubmitted: Record<string, boolean>; meetingStatuses: Record<string, ReactionType>;
  winner?: "players" | "none"; endReason?: "all-fulfilled" | "round-limit" | "player-left";
  revealedConditions?: Record<string, ConditionDefinition[]>;
  fulfilledConditionCount?: number; totalConditionCount?: number; score?: number;
}
export interface DecorumScenarioInfo {
  id: string; name: string; playerCount: 2 | 3 | 4; difficulty: 1 | 2 | 3 | 4 | 5;
  description: string; maxRounds: number; enableRoommateTokens?: boolean;
}
export interface DecorumScenario extends DecorumScenarioInfo {
  rooms: RoomDefinition[]; initialHouse: HouseState;
  playerConditions: Record<number, ConditionDefinition[]>;
}

// Metadata only: never import server scenarios or solutions into the client.
export const DECORUM_SCENARIOS: DecorumScenarioInfo[] = [
  { id: "demo-two-01", name: "第一次合租", playerCount: 2, difficulty: 1, maxRounds: 30, description: "一盞燈、一面牆，慢慢找到兩個人都喜歡的日常。" },
  { id: "demo-two-02", name: "週末收藏室", playerCount: 2, difficulty: 2, maxRounds: 30, description: "把旅行帶回家的小物，放在恰到好處的位置。" },
  { id: "demo-three-01", name: "三人的午後", playerCount: 3, difficulty: 3, maxRounds: 30, description: "三種生活節奏，試著在同一個屋簷下找到平衡。" },
  { id: "demo-four-01", name: "四季合租公寓", playerCount: 4, difficulty: 3, maxRounds: 30, enableRoommateTokens: true, description: "兩間臥室、四位室友。換個位置，也許就能換個心情。" },
];

// An explicit, limited catalog: no Cartesian product or client-created objects.
export const DECOR_OBJECTS: DecorObject[] = [
  { id: "lamp-blue-modern", type: "lamp", color: "blue", style: "modern" },
  { id: "lamp-yellow-retro", type: "lamp", color: "yellow", style: "retro" },
  { id: "lamp-red-antique", type: "lamp", color: "red", style: "antique" },
  { id: "lamp-green-unusual", type: "lamp", color: "green", style: "unusual" },
  { id: "curio-blue-retro", type: "curio", color: "blue", style: "retro" },
  { id: "curio-yellow-antique", type: "curio", color: "yellow", style: "antique" },
  { id: "curio-red-unusual", type: "curio", color: "red", style: "unusual" },
  { id: "curio-green-modern", type: "curio", color: "green", style: "modern" },
  { id: "art-blue-antique", type: "wallHanging", color: "blue", style: "antique" },
  { id: "art-yellow-unusual", type: "wallHanging", color: "yellow", style: "unusual" },
  { id: "art-red-modern", type: "wallHanging", color: "red", style: "modern" },
  { id: "art-green-retro", type: "wallHanging", color: "green", style: "retro" },
];
export const decorumToken = (g: DecorumPublicState) => `${g.id}:${g.round}:${g.phase}:${g.currentPlayerIndex}:${g.turn}`;
export const objectLabel = (o: DecorObject) => `${COLOR_LABELS[o.color]}・${STYLE_LABELS[o.style]}${OBJECT_LABELS[o.type]}`;
export function normalizeDecorum(g: DecorumPublicState) {
  g.house.roommates ??= {};
  for (const room of g.house.rooms) {
    room.objects ??= { lamp: null, curio: null, wallHanging: null };
    for (const type of OBJECT_TYPES) room.objects[type] ??= null;
  }
  g.confirmed ??= {}; g.playerFulfilled ??= {}; g.reactions ??= {}; g.lastReactions ??= {};
  g.meetingSubmitted ??= {}; g.meetingStatuses ??= {};
  return g;
}
