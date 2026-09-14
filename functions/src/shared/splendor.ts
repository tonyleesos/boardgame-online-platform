/** Original demo content. The shared model/selectors contain no hidden setup state. */
export const GEM_COLORS = ["white", "blue", "green", "red", "black"] as const;
export type GemColor = (typeof GEM_COLORS)[number];
export type TokenColor = GemColor | "gold";
export const TOKEN_COLORS: TokenColor[] = [...GEM_COLORS, "gold"];
export const GEM_NAMES: Record<TokenColor, string> = {
  white: "鑽石",
  blue: "藍寶石",
  green: "祖母綠",
  red: "紅寶石",
  black: "黑瑪瑙",
  gold: "黃金",
};
export type GemCost = Record<GemColor, number>;
export type TokenInventory = Record<TokenColor, number>;
export type DevelopmentTier = 1 | 2 | 3;
export type Expansion =
  "base" | "cities" | "tradingPosts" | "orient" | "strongholds";
export const EXPANSION_NAMES: Record<Expansion, string> = {
  base: "基礎遊戲",
  cities: "城市",
  tradingPosts: "貿易站",
  orient: "東方之路",
  strongholds: "要塞",
};
export interface SplendorConfig {
  module: Expansion;
  competitorMode: boolean;
}
export type OrientEffectDefinition =
  | { type: "double" }
  | { type: "copy" }
  | { type: "return"; tier: DevelopmentTier }
  | { type: "reserve" }
  | { type: "noble" };
export interface DevelopmentCard {
  id: string;
  name: string;
  tier: DevelopmentTier;
  bonusColor: GemColor;
  prestige: number;
  cost: GemCost;
  source: "base" | "orient";
  orientEffect?: OrientEffectDefinition;
}
export interface NobleTile {
  id: string;
  name: string;
  prestige: number;
  requirements: Partial<GemCost>;
}
export interface CityTile {
  id: string;
  name: string;
  minimumPrestige: number;
  requirements: Partial<GemCost>;
  differentBonuses: number;
}
export type TradingPostEffect =
  | { type: "goldValue"; value: number }
  | { type: "prestige"; color: GemColor }
  | { type: "tokenLimit"; value: number }
  | { type: "flatPrestige"; value: number };
export interface TradingPost {
  id: string;
  name: string;
  requirements: Partial<GemCost>;
  effect: TradingPostEffect;
  description: string;
}
export interface ReservedCard {
  slot: string;
  cardId?: string;
  tier: DevelopmentTier;
  source: "base" | "orient";
  visibility: "public" | "private";
}
export interface SplendorPlayerState {
  uid: string;
  nickname: string;
  tokens: TokenInventory;
  purchasedCardIds: string[];
  reservedCards: ReservedCard[];
  bonuses: GemCost;
  prestige: number;
  nobles: NobleTile[];
  tradingPosts: string[];
  strongholdsRemaining: number;
  copiedBonuses: Record<string, GemColor>;
  pledgedNobleIds: string[];
  cityIds: string[];
}
export interface SplendorPrivate {
  gameId: string;
  reserved: Record<string, string>;
}
export type SplendorPhase =
  | "PLAYER_ACTION"
  | "RETURN_EXCESS_TOKENS"
  | "CHOOSE_NOBLE"
  | "RESOLVE_EXPANSION"
  | "STRONGHOLD_BONUS_PURCHASE"
  | "GAME_OVER";
export interface StrongholdPlacement {
  ownerUid: string;
  count: number;
}
/** Canonical public outcomes. Never include private reserved IDs or raw client input. */
export interface SplendorActivity {
  revision: number;
  uid: string;
  type: SplendorAction["type"];
  text: string;
  tokens: Partial<TokenInventory>;
  cards: Array<{
    cardId?: string;
    tier: DevelopmentTier;
    source: "base" | "orient";
    from: "market" | "deck" | "reserved" | "purchased";
    to: "reserved" | "purchased" | "returned";
  }>;
  nobleNames: string[];
  strongholdChange?: { cardId: string; ownerUid: string; count: number; removed: boolean };
}
export interface SplendorPublicState {
  id: string;
  revision: number;
  phase: SplendorPhase;
  playerOrder: string[];
  currentPlayerIndex: number;
  round: number;
  config: SplendorConfig;
  bank: TokenInventory;
  players: Record<string, SplendorPlayerState>;
  market: Record<string, Array<string | null>>;
  deckCounts: Record<string, number>;
  nobles: NobleTile[];
  cities: CityTile[];
  strongholds: Record<string, StrongholdPlacement>;
  bonusPurchaseUsed: boolean;
  nobleClaimed: boolean;
  endTriggeredBy?: string;
  finalRoundNumber?: number;
  winners?: string[];
  aborted?: boolean;
  log: Array<{ revision: number; uid: string; text: string }>;
  activities?: SplendorActivity[];
}
export interface SplendorSecret {
  decks: Record<string, string[]>;
}
export type SplendorAction =
  | { type: "splendorTake"; colors: GemColor[] }
  | { type: "splendorDouble"; color: GemColor }
  | { type: "splendorReserve"; cardId: string }
  | { type: "splendorBlind"; tier: DevelopmentTier; source: "base" | "orient" }
  | {
      type: "splendorBuy";
      cardId?: string;
      slot?: string;
      choice?: OrientChoice;
    }
  | { type: "splendorReturn"; tokens: Partial<TokenInventory> }
  | { type: "splendorNoble"; nobleId: string }
  | { type: "splendorStronghold"; cardId?: string; remove?: boolean }
  | { type: "splendorSkip" };
export interface OrientChoice {
  color?: GemColor;
  returnCardId?: string;
  reserveCardId?: string;
  nobleId?: string;
}
export const emptyGems = (): GemCost => ({
  white: 0,
  blue: 0,
  green: 0,
  red: 0,
  black: 0,
});
export const emptyTokens = (): TokenInventory => ({ ...emptyGems(), gold: 0 });
export const tokenTotal = (t: Partial<TokenInventory>) =>
  TOKEN_COLORS.reduce((n, c) => n + (t[c] ?? 0), 0);
const cost = (values: number[], rotate = 0): GemCost =>
  Object.fromEntries(
    GEM_COLORS.map((c, i) => [c, values[(i - rotate + 5) % 5]]),
  ) as GemCost;
const tierCosts = {
  1: [
    [0, 1, 1, 1, 1],
    [0, 2, 0, 2, 0],
    [0, 0, 3, 0, 0],
    [1, 1, 2, 0, 0],
    [0, 0, 0, 4, 0],
    [0, 2, 1, 0, 1],
    [0, 0, 2, 2, 1],
    [0, 1, 0, 1, 2],
  ],
  2: [
    [0, 0, 5, 0, 0],
    [0, 2, 3, 2, 0],
    [0, 3, 0, 2, 2],
    [0, 0, 4, 3, 0],
    [2, 0, 3, 0, 3],
    [0, 1, 4, 2, 1],
  ],
  3: [
    [0, 0, 7, 0, 0],
    [0, 3, 5, 3, 0],
    [0, 0, 6, 0, 3],
    [0, 3, 0, 4, 4],
    [0, 2, 4, 2, 4],
  ],
};
const places = {
  1: [
    "晨光礦谷",
    "溪畔工坊",
    "翡翠林地",
    "赤砂採場",
    "星夜礦井",
    "風車山丘",
    "海角集市",
    "河岸商隊",
  ],
  2: ["琉光商館", "月灣港口", "絲路驛站", "暮色船塢", "拱廊工坊", "山城集市"],
  3: ["星穹宮殿", "雲頂花園", "金環大殿", "碧海城堡", "落日寶庫"],
};
export const DEMO_CARDS: DevelopmentCard[] = (
  [1, 2, 3] as DevelopmentTier[]
).flatMap((tier) =>
  GEM_COLORS.flatMap((bonusColor, rotation) =>
    tierCosts[tier].map((v, i) => ({
      id: `b${tier}-${rotation}-${i}`,
      name: places[tier][i],
      tier,
      bonusColor,
      prestige:
        tier === 1
          ? i === 4
            ? 1
            : 0
          : tier === 2
            ? i === 4
              ? 3
              : (i % 2) + 1
            : 3 + (i % 3),
      cost: cost(v, rotation),
      source: "base" as const,
    })),
  ),
);
export const DEMO_ORIENT_CARDS: DevelopmentCard[] = (
  [1, 2, 3] as DevelopmentTier[]
).flatMap((tier) =>
  GEM_COLORS.flatMap((bonusColor, i) => {
    const effects: OrientEffectDefinition[] =
      tier === 1
        ? [{ type: "double" }, { type: "copy" }]
        : tier === 2
          ? [{ type: "reserve" }, { type: "noble" }]
          : [{ type: "double" }, { type: "return", tier: 1 }];
    return effects.map((orientEffect, j) => ({
      id: `o${tier}-${i}-${j}`,
      name: [
        "琉璃雙塔",
        "流沙鏡殿",
        "香料商隊",
        "王室驛館",
        "東方寶庫",
        "古玉之門",
      ][(tier - 1) * 2 + j],
      tier,
      bonusColor,
      prestige: tier - 1 + (orientEffect.type === "return" ? 3 : 0),
      cost: cost(
        tier === 1
          ? [0, 2, 1, 1, 1]
          : tier === 2
            ? [0, 3, 2, 2, 1]
            : [0, 4, 3, 3, 2],
        i,
      ),
      source: "orient" as const,
      orientEffect,
    }));
  }),
);
export const CARD_BY_ID: Record<string, DevelopmentCard> = Object.fromEntries(
  [...DEMO_CARDS, ...DEMO_ORIENT_CARDS].map((c) => [c.id, c]),
);
export const DEMO_NOBLES: NobleTile[] = GEM_COLORS.flatMap((_, i) => [
  {
    id: `n${i}a`,
    name: ["星辰學者", "翡翠夫人", "赤金公爵", "白塔使者", "夜港領主"][i],
    prestige: 3,
    requirements: cost([0, 3, 3, 3, 0], i),
  },
  {
    id: `n${i}b`,
    name: ["晨曦侯爵", "遠洋商主", "金葉伯爵", "月影藏家", "蒼穹賢者"][i],
    prestige: 3,
    requirements: cost([0, 4, 0, 4, 0], i),
  },
]);
export const DEMO_CITIES: CityTile[] = GEM_COLORS.map((_, i) => ({
  id: `city${i}`,
  name: ["晨曦之城", "翡翠港", "赤砂王都", "月光城", "星河城"][i],
  minimumPrestige: 10 + i,
  requirements: cost([0, 3, 0, 3, 0], i),
  differentBonuses: i % 2 ? 4 : 3,
}));
export const DEMO_TRADING_POSTS: TradingPost[] = [
  {
    id: "post-gem",
    name: "商隊",
    requirements: { red: 3, white: 1 },
    effect: { type: "flatPrestige", value: 1 },
    description: "獲得 1 聲望；拿取仍以最多 3 種異色為限。",
  },
  {
    id: "post-gold",
    name: "金匠",
    requirements: { blue: 3, black: 2 },
    effect: { type: "goldValue", value: 2 },
    description: "每枚黃金抵付 2 枚缺少的寶石。",
  },
  {
    id: "post-limit",
    name: "倉庫",
    requirements: { green: 3 },
    effect: { type: "tokenLimit", value: 12 },
    description: "代幣上限提高至 12。",
  },
  {
    id: "post-score",
    name: "珠寶行",
    requirements: { white: 4, red: 2 },
    effect: { type: "prestige", color: "white" },
    description: "每 2 個鑽石加成獲得 1 聲望。",
  },
  {
    id: "post-crown",
    name: "商會",
    requirements: { black: 4, green: 2 },
    effect: { type: "flatPrestige", value: 3 },
    description: "獲得 3 聲望。",
  },
];
export const splendorToken = (g: SplendorPublicState) =>
  `${g.id}:${g.revision}`;
export const deckKey = (
  tier: DevelopmentTier,
  source: "base" | "orient" = "base",
) => `${source}${tier}`;
export function normalizeSplendor(g: SplendorPublicState): SplendorPublicState {
  g.nobles ??= [];
  g.cities ??= [];
  g.log ??= [];
  g.activities ??= [];
  for (const activity of g.activities) {
    activity.tokens ??= {};
    activity.cards ??= [];
    activity.nobleNames ??= [];
  }
  g.strongholds ??= {};
  g.market ??= {};
  g.deckCounts ??= {};
  for (const key of Object.keys(g.deckCounts))
    g.market[key] = Array.from(
      { length: key.startsWith("orient") ? 2 : 4 },
      (_, i) => g.market[key]?.[i] ?? null,
    );
  for (const p of Object.values(g.players)) {
    p.purchasedCardIds ??= [];
    p.reservedCards ??= [];
    p.nobles ??= [];
    p.tradingPosts ??= [];
    p.copiedBonuses ??= {};
    p.pledgedNobleIds ??= [];
    p.cityIds ??= [];
  }
  return g;
}
export function calculateBonuses(p: SplendorPlayerState): GemCost {
  const b = emptyGems();
  for (const id of p.purchasedCardIds ?? []) {
    const c = CARD_BY_ID[id];
    b[c.bonusColor] += c.orientEffect?.type === "double" ? 2 : 1;
    if (c.orientEffect?.type === "copy" && p.copiedBonuses?.[id])
      b[p.copiedBonuses[id]]++;
  }
  return b;
}
export const meets = (bonuses: GemCost, requirements: Partial<GemCost>) =>
  GEM_COLORS.every((c) => bonuses[c] >= (requirements[c] ?? 0));
export function applyTradingPostModifiers(p: SplendorPlayerState) {
  const maxDifferent = 3;
  let goldValue = 1,
    tokenLimit = 10,
    prestige = 0;
  for (const post of DEMO_TRADING_POSTS.filter((v) =>
    p.tradingPosts?.includes(v.id),
  )) {
    const e = post.effect;
    if (e.type === "goldValue") goldValue = e.value;
    if (e.type === "tokenLimit") tokenLimit = e.value;
    if (e.type === "prestige")
      prestige += Math.floor(calculateBonuses(p)[e.color] / 2);
    if (e.type === "flatPrestige") prestige += e.value;
  }
  return { maxDifferent, goldValue, tokenLimit, prestige };
}
export const calculateEffectiveCost = (
  card: DevelopmentCard,
  p: SplendorPlayerState,
): GemCost => {
  const bonuses = calculateBonuses(p);
  return Object.fromEntries(
    GEM_COLORS.map((c) => [c, Math.max(0, card.cost[c] - bonuses[c])]),
  ) as GemCost;
};
export function calculatePurchasePayment(
  card: DevelopmentCard,
  p: SplendorPlayerState,
) {
  const requiredAfterBonuses = calculateEffectiveCost(card, p),
    normalPayment = emptyGems();
  let missing = 0;
  for (const c of GEM_COLORS) {
    normalPayment[c] = Math.min(requiredAfterBonuses[c], p.tokens[c]);
    missing += requiredAfterBonuses[c] - normalPayment[c];
  }
  const goldPayment = Math.ceil(
    missing / applyTradingPostModifiers(p).goldValue,
  );
  return {
    affordable: goldPayment <= p.tokens.gold,
    requiredAfterBonuses,
    normalPayment,
    goldPayment,
    totalTokensSpent: tokenTotal(normalPayment) + goldPayment,
  };
}
export const canTakeDifferentGems = (
  g: SplendorPublicState,
  p: SplendorPlayerState,
  colors: GemColor[],
) =>
  Array.isArray(colors) &&
  colors.length >= 1 &&
  colors.length <= applyTradingPostModifiers(p).maxDifferent &&
  new Set(colors).size === colors.length &&
  colors.every((c) => GEM_COLORS.includes(c) && g.bank[c] > 0);
export const canTakeDoubleGem = (g: SplendorPublicState, c: GemColor) =>
  GEM_COLORS.includes(c) && g.bank[c] >= 4;
export const canReserveCard = (p: SplendorPlayerState) =>
  (p.reservedCards?.length ?? 0) < 3;
export const mustReturnTokens = (p: SplendorPlayerState) =>
  Math.max(0, tokenTotal(p.tokens) - applyTradingPostModifiers(p).tokenLimit);
export const canInteractWithStrongholdCard = (
  g: SplendorPublicState,
  uid: string,
  id: string,
) => !g.strongholds[id] || g.strongholds[id].ownerUid === uid;
export const getEligibleNobles = (
  p: SplendorPlayerState,
  g: SplendorPublicState,
) =>
  g.nobles.filter(
    (n) =>
      meets(calculateBonuses(p), n.requirements) &&
      !Object.values(g.players).some(
        (other) => other.uid !== p.uid && other.pledgedNobleIds.includes(n.id),
      ),
  );
export const calculatePrestige = (p: SplendorPlayerState) =>
  (p.purchasedCardIds ?? []).reduce((n, id) => n + CARD_BY_ID[id].prestige, 0) +
  (p.nobles ?? []).reduce((n, v) => n + v.prestige, 0) +
  applyTradingPostModifiers(p).prestige;
export const getEligibleCities = (
  p: SplendorPlayerState,
  g: SplendorPublicState,
) =>
  g.cities.filter(
    (c) =>
      calculatePrestige(p) >= c.minimumPrestige &&
      meets(calculateBonuses(p), c.requirements) &&
      Object.values(calculateBonuses(p)).filter((n) => n > 0).length >=
        c.differentBonuses,
  );
export const shouldTriggerFinalRound = (
  p: SplendorPlayerState,
  g: SplendorPublicState,
) =>
  g.config.module === "cities"
    ? getEligibleCities(p, g).length > 0
    : calculatePrestige(p) >= 15;
export function determineSplendorWinners(g: SplendorPublicState): string[] {
  const players = Object.values(g.players).filter(
    (p) => g.config.module !== "cities" || p.cityIds.length,
  );
  if (!players.length || g.aborted) return [];
  const best = Math.max(...players.map(calculatePrestige));
  const tied = players.filter((p) => calculatePrestige(p) === best);
  const fewest = Math.min(...tied.map((p) => p.purchasedCardIds.length));
  return tied
    .filter(
      (p) =>
        g.config.module === "cities" || p.purchasedCardIds.length === fewest,
    )
    .map((p) => p.uid);
}
export const canPurchaseCard = (
  g: SplendorPublicState,
  p: SplendorPlayerState,
  card: DevelopmentCard,
) =>
  calculatePurchasePayment(card, p).affordable &&
  canInteractWithStrongholdCard(g, p.uid, card.id) &&
  (card.orientEffect?.type !== "return" ||
    p.purchasedCardIds.some(
      (id) =>
        card.orientEffect?.type === "return" &&
        CARD_BY_ID[id].tier === card.orientEffect.tier,
    ));
