export type DanceCardType =
  | "FIRST_DISCOVERER"
  | "CRIMINAL"
  | "ALIBI"
  | "ACCOMPLICE"
  | "DETECTIVE"
  | "WITNESS"
  | "ORDINARY_PERSON"
  | "DOG"
  | "POLICE_CHIEF"
  | "INFORMATION_EXCHANGE"
  | "RUMOR"
  | "TRADE"
  | "BOY";
export const DANCE_DEFINITIONS: Record<
  DanceCardType,
  { name: string; rule: string; color: string }
> = {
  FIRST_DISCOVERER: {
    name: "第一發現者",
    rule: "開局由你先行，而且必須先打出這張牌。不好了，發生命案了！",
    color: "#bd5546",
  },
  CRIMINAL: {
    name: "犯人",
    rule: "只有這是最後一張手牌時才能打出。成功逃脫，你與已亮牌的共犯得分。",
    color: "#456582",
  },
  ALIBI: {
    name: "不在場證明",
    rule: "與犯人一起持有時，可抵擋偵探與警部的判定；不能抵擋神犬。打出後沒有作用。",
    color: "#896f9f",
  },
  ACCOMPLICE: {
    name: "共犯",
    rule: "打出後，本輪成為共犯。犯人逃脫時，你也獲得 2 分；持有時尚未生效。",
    color: "#aa8b32",
  },
  DETECTIVE: {
    name: "偵探",
    rule: "出牌前手牌不超過 3 張時，可指認另一人。抓到沒有不在場證明的犯人便破案。",
    color: "#397d80",
  },
  WITNESS: {
    name: "目擊者",
    rule: "私下查看另一人的全部手牌。確認後情報關閉，不會保留歷史牌面。",
    color: "#ad6b7c",
  },
  ORDINARY_PERSON: {
    name: "普通人",
    rule: "平靜地走過現場。沒有特殊效果，出牌後換下一位行動。",
    color: "#7b837f",
  },
  DOG: {
    name: "神犬",
    rule: "選一位仍有牌的玩家，隨機翻開其一張牌。翻到犯人即破案，否則棄掉該牌，神犬交給對方。",
    color: "#638648",
  },
  POLICE_CHIEF: {
    name: "警部",
    rule: "出牌前最多 3 張手牌才能使用。公開指定另一人，回合結束時若對方是犯人且沒有不在場證明，警部破案得 3 分。",
    color: "#475d9a",
  },
  INFORMATION_EXCHANGE: {
    name: "情報交換",
    rule: "每人從原有手牌秘密選一張，同時交給左側下一位。沒牌也能收牌。",
    color: "#7b8444",
  },
  RUMOR: {
    name: "謠言",
    rule: "每人隨機取得右側上一位的一張牌，同時完成。收到的牌不會在本次再被傳走。",
    color: "#be7a43",
  },
  TRADE: {
    name: "交易",
    rule: "與另一位有牌的玩家各自秘密選一張手牌，兩人選好後同時交換。",
    color: "#8c6952",
  },
  BOY: {
    name: "少年",
    rule: "最初拿到此牌的人知道開局時誰持有犯人。此情報不隨犯人移動更新，打出沒有效果。",
    color: "#ad943d",
  },
};
export const BASE_DANCE_COUNTS: Partial<Record<DanceCardType, number>> = {
  FIRST_DISCOVERER: 1,
  CRIMINAL: 1,
  DETECTIVE: 4,
  ALIBI: 5,
  ACCOMPLICE: 2,
  WITNESS: 3,
  ORDINARY_PERSON: 2,
  DOG: 1,
  INFORMATION_EXCHANGE: 4,
  RUMOR: 5,
  TRADE: 4,
};
export interface DanceCard {
  id: string;
  type: DanceCardType;
}
export const DANCE_CARDS: DanceCard[] = Object.entries({
  ...BASE_DANCE_COUNTS,
  BOY: 1,
  POLICE_CHIEF: 1,
}).flatMap(([type, n]) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${type}-${i}`,
    type: type as DanceCardType,
  })),
);
export const DANCE_CARD_BY_ID: Record<string, DanceCard> = Object.fromEntries(
  DANCE_CARDS.map((c) => [c.id, c]),
);
export interface DanceConfig {
  targetScore: 5 | 10;
  boy: boolean;
  policeChiefEnabled?: boolean;
}
export type DancePhase =
  | "PLAYER_TURN"
  | "SELECT_TARGET"
  | "WITNESS_REVEAL"
  | "EXCHANGE_SELECTION"
  | "TRADE_SELECTION"
  | "EFFECT_RESULT"
  | "ROUND_END"
  | "MATCH_END";
export type DanceEnd =
  "DETECTIVE_CAUGHT" | "DOG_CAUGHT" | "CRIMINAL_ESCAPED" | "NO_PLAYABLE_CARDS";
export interface DancePlayer {
  uid: string;
  nickname: string;
  handCount: number;
  score: number;
  accomplice: boolean;
}
export interface DancePending {
  actor: string;
  type: DanceCardType;
  target?: string;
  eligible: string[];
  locked: string[];
}
export interface DanceEvent {
  revision: number;
  actor: string;
  kind: string;
  text: string;
  cardId?: string;
  target?: string;
  transfers?: Array<{ from: string; to: string }>;
}
export interface DanceResult {
  reason: DanceEnd;
  actor: string;
  criminal: string;
  awards: Record<string, number>;
  criminalSide: string[];
  resolution?: "DETECTIVE" | "DOG" | "CRIMINAL" | "POLICE_CHIEF" | "NONE";
}
export interface DanceTerminalSnapshot {
  finalCriminalUid: string;
  finalCriminalHadAlibi: boolean;
  endReason: DanceEnd;
  detectiveUid?: string;
  dogUid?: string;
}
export interface DanceGame {
  id: string;
  revision: number;
  round: number;
  roundId: string;
  phase: DancePhase;
  order: string[];
  current: string;
  firstPlay: boolean;
  players: Record<string, DancePlayer>;
  config: DanceConfig;
  played: Array<{ uid: string; cardId: string }>;
  events: DanceEvent[];
  pending?: DancePending;
  notice?: string;
  result?: DanceResult;
  winners?: string[];
  aborted?: boolean;
  policeChiefHolderUid?: string;
  policeChiefOwnerUid?: string;
  policeChiefTargetUid?: string;
}
export interface DancePrivate {
  gameId: string;
  roundId: string;
  revision: number;
  hand: string[];
  selection?: string;
  witness?: { target: string; cards: string[] };
  boyInitial?: string;
  botClue?: string;
}
export interface DanceSecret {
  excluded: string[];
  snapshot?: Record<string, string[]>;
  selections?: Record<string, string>;
  terminal?: DanceTerminalSnapshot;
}
export type DanceAction =
  | { type: "dancePlay"; cardId: string }
  | { type: "danceTarget"; target: string }
  | { type: "danceSelect"; cardId: string }
  | { type: "danceAcknowledge" }
  | { type: "danceNext" };
export const DANCE_MOTION_MS = 3200,
  DANCE_BOT_DELAY = 3600;
export const danceToken = (g: DanceGame) =>
  `${g.id}:${g.roundId}:${g.revision}`;
export const defaultDanceConfig = (count: number): DanceConfig => ({
  targetScore: count >= 6 ? 10 : 5,
  boy: false,
  policeChiefEnabled: false,
});
export function normalizeDance(g: DanceGame) {
  g.played ??= [];
  g.events ??= [];
  if (g.pending) {
    g.pending.eligible ??= [];
    g.pending.locked ??= [];
  }
  if (g.result) g.result.criminalSide ??= [];
  return g;
}
export function normalizeDancePrivate(p: DancePrivate) {
  p.hand ??= [];
  if (p.witness) p.witness.cards ??= [];
  return p;
}
export function canPlayDanceCard(
  g: DanceGame,
  p: DancePrivate,
  uid: string,
  id: string,
): string | null {
  if (g.phase !== "PLAYER_TURN" || g.current !== uid)
    return "目前不是你的出牌回合";
  if (!p.hand.includes(id) || !Object.hasOwn(DANCE_CARD_BY_ID, id))
    return "這張牌不在你的手中";
  const c = DANCE_CARD_BY_ID[id];
  if (g.firstPlay && c.type !== "FIRST_DISCOVERER")
    return "開局必須先打出第一發現者";
  if (c.type === "CRIMINAL" && p.hand.length !== 1)
    return "犯人只能作為最後一張手牌打出";
  if (
    c.type === "POLICE_CHIEF" &&
    (!g.config.policeChiefEnabled || p.hand.length > 3)
  )
    return "警部須已啟用，且出牌前手牌不超過 3 張";
  return null;
}
export function danceTargets(g: DanceGame, actor: string, type: DanceCardType) {
  return g.order.filter((id) =>
    type === "DOG"
      ? g.players[id].handCount > 0
      : id !== actor &&
        (type === "DETECTIVE" ||
          type === "POLICE_CHIEF" ||
          g.players[id].handCount > 0),
  );
}
export const danceNeedsSelection = (g: DanceGame, uid: string) =>
  !!g.pending?.eligible.includes(uid) &&
  !g.pending.locked.includes(uid) &&
  (g.phase === "EXCHANGE_SELECTION" || g.phase === "TRADE_SELECTION");
