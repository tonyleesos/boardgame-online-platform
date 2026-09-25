export type RoseIdentity =
  | "WHITE_ROSE"
  | "BISHOP"
  | "FOLLOWER"
  | "DOUBLE_BLADE"
  | "GREAT_BLADE"
  | "DARK_BLADE";
export type RoseCardType = RoseIdentity | "GHOST";
export type RoseFaction = "WHITE_ROSE" | "BLOOD_BLADE";
export type CrystalId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type RosePhase =
  | "NIGHT"
  | "COIN"
  | "CRYSTAL"
  | "TARGET"
  | "PEEK"
  | "DECISIONS"
  | "REPLACE_TARGET"
  | "REPLACE_CARD"
  | "ROUND_RESULT"
  | "GAME_OVER";
export interface RoseCard {
  id: string;
  type: RoseCardType;
}
export interface RoseConstraint {
  mustPlay?: boolean;
  mustPass?: boolean;
  lockedCardId?: string;
}
export interface RosePrivate {
  revision: number;
  identity: RoseIdentity;
  faction: RoseFaction;
  hand: RoseCard[];
  crystal: CrystalId;
  night: string[];
  acknowledged: boolean;
  knownRoles: Record<string, RoseIdentity>;
  constraint: RoseConstraint;
  peek?: { target: string; type: RoseCardType };
  decision?: RoseCard | "PASS";
  replacementTargets: string[];
}
export interface RoseReveal {
  revealId: string;
  type: RoseCardType;
  sourceUid?: string;
}
export interface RoseResult {
  round: number;
  crystal: CrystalId;
  cards: RoseReveal[];
  killed: boolean;
  buds: number;
  rose: boolean;
}
export interface RoseGame {
  id: string;
  revision: number;
  phase: RosePhase;
  round: number;
  order: string[];
  coin: string;
  current: string;
  queue: string[];
  players: Record<
    string,
    { handCount: number; crystalUsed: boolean; ready: boolean }
  >;
  crystal?: CrystalId;
  targets: string[];
  safeRose: boolean;
  deadRose: boolean;
  safeBuds: number;
  deadBuds: number;
  history: RoseResult[];
  winner?: RoseFaction;
  reason?: string;
  roles?: Record<string, RoseIdentity>;
  aborted?: boolean;
}
export interface RoseSecret {
  contributions: Record<string, RoseCard>;
  linked?: { a: string; b: string };
  ghostReserve: number;
  spareBlade: boolean;
  receipts?: Record<string, { uid: string; token: string }>;
}
export type RoseAction =
  | { type: "roseNight" }
  | { type: "roseCoin"; target: string }
  | { type: "roseCrystal" }
  | { type: "roseTarget"; targets: string[] }
  | { type: "rosePeek" }
  | { type: "roseDecide"; cardId?: string }
  | { type: "roseReplaceTarget"; target?: string }
  | { type: "roseReplaceCard"; cardId: string }
  | { type: "roseContinue" };
export interface PlayerCountRule {
  playerCount: number;
  identities: Record<RoseIdentity, number> | null;
  requiredSafeBuds: number | null;
  bloodKillThreshold: number | null;
  verifiedAgainstOfficialBoard: boolean;
  verificationNote: string;
}
// Values supplied by the implementation specification, section 25. Other boards
// must be transcribed from a legible primary source; do not extrapolate them.
export const PLAYER_COUNT_RULES: Record<number, PlayerCountRule> =
  Object.fromEntries(
    [5, 6, 7, 8, 9, 10].map((playerCount) => [
      playerCount,
      playerCount === 8
        ? {
            playerCount,
            identities: {
              WHITE_ROSE: 1,
              BISHOP: 1,
              FOLLOWER: 3,
              DOUBLE_BLADE: 1,
              GREAT_BLADE: 1,
              DARK_BLADE: 1,
            },
            requiredSafeBuds: 5,
            bloodKillThreshold: 6,
            verifiedAgainstOfficialBoard: true,
            verificationNote:
              "採用規格 §25 已核對的八人配置；本次未重新取得實體圖板。",
          }
        : {
            playerCount,
            identities: null,
            requiredSafeBuds: null,
            bloodKillThreshold: null,
            verifiedAgainstOfficialBoard: false,
            verificationNote: "待官方圖板校對角色數量及雙方門檻。",
          },
    ]),
  );
export const ROSE_CARDS: Record<
  RoseCardType,
  { name: string; english: string; text: string; glyph: string }
> = {
  WHITE_ROSE: {
    name: "白薔薇",
    english: "WHITE ROSE",
    text: "與任何血刃同時揭示，血刃陣營立即獲勝。",
    glyph: "❀",
  },
  BISHOP: {
    name: "司教",
    english: "BISHOP",
    text: "花苞。無血刃時獻祭，有血刃時遭擊殺。",
    glyph: "♧",
  },
  FOLLOWER: {
    name: "信者",
    english: "FOLLOWER",
    text: "花苞。無血刃時獻祭，有血刃時遭擊殺。",
    glyph: "♧",
  },
  GHOST: {
    name: "幽魂",
    english: "GHOST",
    text: "不計入獻祭或擊殺。",
    glyph: "◌",
  },
  DOUBLE_BLADE: {
    name: "雙刃",
    english: "DOUBLE BLADE",
    text: "擊殺本輪所有花朵。起手有兩張雙刃。",
    glyph: "⚔",
  },
  GREAT_BLADE: {
    name: "巨刃",
    english: "GREAT BLADE",
    text: "擊殺本輪所有花朵。參與夜晚相認。",
    glyph: "†",
  },
  DARK_BLADE: {
    name: "暗刃",
    english: "DARK BLADE",
    text: "擊殺本輪所有花朵。不參與夜晚相認。",
    glyph: "†",
  },
};
export const CRYSTALS: Record<CrystalId, { title: string; text: string }> = {
  1: { title: "獻祭之命", text: "指定一名有手牌的玩家，本輪必須出牌。" },
  2: { title: "真相之眼", text: "本輪不洗牌，揭示每張牌的出牌者。" },
  3: {
    title: "右席命運",
    text: "右鄰隨機一張手牌成為本輪唯一可出的牌，仍可跳過。",
  },
  4: {
    title: "左席命運",
    text: "左鄰隨機一張手牌成為本輪唯一可出的牌，仍可跳過。",
  },
  5: {
    title: "命運繫結",
    text: "依序指定 A、B 兩名有手牌的玩家；B 必須跟隨 A 出牌或跳過。",
  },
  6: { title: "靜候終聲", text: "本輪你最後決定是否出牌。" },
  7: {
    title: "幽魂贈禮",
    text: "將備用幽魂交給另一名玩家；備用牌用盡時無效果。",
  },
  8: { title: "雙側誓約", text: "左右鄰座若有手牌，本輪必須出牌。" },
  9: { title: "暗刃的密語", text: "暗刃私下得知白薔薇與司教的身分。" },
  10: {
    title: "命運改寫",
    text: "所有人決定後，可指定另一位已出牌且仍有手牌的玩家換牌。",
  },
  11: {
    title: "窺見祕密",
    text: "指定一名有手牌的玩家，私下查看其隨機一張手牌。",
  },
  12: { title: "終末之命", text: "指定一名有手牌的玩家，本輪必須出牌。" },
};
export const roseFaction = (type: RoseCardType): RoseFaction =>
  ["DOUBLE_BLADE", "GREAT_BLADE", "DARK_BLADE"].includes(type)
    ? "BLOOD_BLADE"
    : "WHITE_ROSE";
export const isFlower = (type: RoseCardType) =>
  ["WHITE_ROSE", "BISHOP", "FOLLOWER"].includes(type);
export const roseToken = (g: RoseGame) =>
  `${g.id}:${g.round}:${g.phase}:${g.revision}`;
export function normalizeRose(g: RoseGame): RoseGame {
  g.queue ??= [];
  g.targets ??= [];
  g.history ??= [];
  g.players ??= {};
  for (const r of g.history) r.cards ??= [];
  return g;
}
export function normalizeRosePrivate(p: RosePrivate): RosePrivate {
  p.hand ??= [];
  p.night ??= [];
  p.knownRoles ??= {};
  p.constraint ??= {};
  p.replacementTargets ??= [];
  return p;
}
export function canSubmitRose(p: RosePrivate, cardId?: string): boolean {
  if (!cardId) return !p.constraint.mustPlay;
  return (
    !p.constraint.mustPass &&
    p.hand.some((c) => c.id === cardId) &&
    (!p.constraint.lockedCardId || p.constraint.lockedCardId === cardId)
  );
}
