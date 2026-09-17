export type MafiaRole =
  | "GODFATHER"
  | "THIEF"
  | "LOYAL_HENCHMAN"
  | "AGENT_FBI"
  | "AGENT_CIA"
  | "DRIVER"
  | "STREET_URCHIN"
  | "CLEANER";
export type MafiaTokenRole = Exclude<
  MafiaRole,
  "GODFATHER" | "THIEF" | "STREET_URCHIN"
>;
export interface MafiaToken {
  id: string;
  role: MafiaTokenRole;
}
export interface MafiaBox {
  diamonds: number;
  tokens: MafiaToken[];
}
export interface MafiaConfig {
  cleanerEnabled: boolean;
  godfatherSelection: "HOST_SELECTS" | "RANDOM";
  godfatherId?: string;
  expansion: "NONE";
}
export const DEFAULT_MAFIA_CONFIG: MafiaConfig = {
  cleanerEnabled: false,
  godfatherSelection: "HOST_SELECTS",
  expansion: "NONE",
};
export const MAFIA_ROLES: Record<MafiaRole, string> = {
  GODFATHER: "教父",
  THIEF: "竊賊",
  LOYAL_HENCHMAN: "忠誠手下",
  AGENT_FBI: "FBI 探員",
  AGENT_CIA: "CIA 探員",
  DRIVER: "司機",
  STREET_URCHIN: "街頭小子",
  CLEANER: "清道夫",
};
export const MAFIA_HELP: Record<MafiaRole, string> = {
  GODFATHER:
    "先秘密保留 0–5 顆鑽石；這些不算失竊。盒子回來後詢問玩家，正式指控竊賊以追回全部失竊鑽石。抓錯普通角色自動付 1 瓶美酒，無酒可付就失敗；抓到探員即結束，美酒無法補救。",
  THIEF:
    "拿至少 1 顆鑽石就成為竊賊。教父抓錯且無酒可付時，未被抓且鑽石最多的竊賊獲勝，同分並列。被正式指控須交還全部鑽石並出局，不得再發言。探員或殺手取得主要勝利時，竊賊不會獲勝。",
  LOYAL_HENCHMAN:
    "心腹（忠誠手下）：協助教父核對傳盒證詞。教父追回全部失竊鑽石時，所有心腹一起獲勝。被抓錯且教父有酒可付時，公開身分但不出局，仍可討論。",
  AGENT_FBI:
    "讓教父正式指控你，便立即取得主要勝利，美酒無法抵銷。另一名探員不會跟著獲勝，但司機可能連帶獲勝。小心殺手在身分揭曉前開槍。",
  AGENT_CIA:
    "讓教父正式指控你，便立即取得主要勝利，美酒無法抵銷。另一名探員不會跟著獲勝，但司機可能連帶獲勝。小心殺手在身分揭曉前開槍。",
  DRIVER:
    "只看原始座位右手邊玩家的最終勝負：對方獲勝，你也獲勝，包括探員或殺手勝利。右邊也是司機時可連鎖；出局不改變座位關係。",
  STREET_URCHIN:
    "街頭混混（街頭小子）：收到空盒，或最後一位主動不拿物品時產生。只要有竊賊成為勝者，你也獲勝；教父、探員或殺手勝利時不會跟著獲勝。",
  CLEANER:
    "殺手（清道夫）：教父確認正式指控後，在 8 秒內秘密選擇開槍或放行，逾時視為放行。射中探員立即取得主要勝利；射錯則你與目標一起出局，教父不扣酒，目標若是竊賊仍交還鑽石。",
};
export interface MafiaSeat {
  uid: string;
  nickname: string;
  alive: boolean;
  revealed: boolean;
  role?: MafiaRole;
  diamonds?: number;
}
export interface MafiaReveal {
  target: string;
  role: MafiaRole;
  diamonds: number;
  outcome: "THIEF" | "JOKER" | "AGENT" | "GODFATHER_OUT" | "SHOT";
  revision: number;
}
export interface MafiaPublicState {
  id: string;
  revision: number;
  phase:
    | "GODFATHER_PREPARE_BOX"
    | "BOX_PASS"
    | "INVESTIGATION"
    | "ACCUSATION_PENDING"
    | "GAME_OVER";
  config: MafiaConfig;
  order: string[];
  passOrder: string[];
  seats: Record<string, MafiaSeat>;
  godfatherId: string;
  holderId: string;
  jokers: number;
  recovered: number;
  history: MafiaReveal[];
  messages?: Array<{ uid: string; text: string; at: number }>;
  pending?: { target: string; deadline: number };
  winners: string[];
  winReason?:
    | "DIAMONDS_RECOVERED"
    | "GODFATHER_ELIMINATED"
    | "AGENT_ACCUSED"
    | "CLEANER_SHOT_AGENT"
    | "ABORTED";
  final?: {
    hiddenDiamonds: number;
    discarded?: MafiaToken;
    box: MafiaBox;
    roles: Record<string, { role: MafiaRole; diamonds: number }>;
  };
}
export interface MafiaPrivate {
  gameId: string;
  role?: MafiaRole;
  diamonds: number;
  currentBoxView?: MafiaBox;
  receivedBox?: MafiaBox;
  passedBox?: MafiaBox;
  hiddenBag?: { completed: true; token?: MafiaToken };
  hiddenDiamonds?: number;
  missing?: number;
  cleanerChoice?: "SHOOT" | "PASS";
}
export interface MafiaSecret {
  box: MafiaBox;
  hiddenDiamonds: number;
  initialDiamonds: number;
  discarded?: MafiaToken;
  roles: Record<string, { role: MafiaRole; diamonds: number }>;
  cleanerChoice?: "SHOOT" | "PASS";
}
export type MafiaAction =
  | { type: "mafiaPrepare"; hidden: number }
  | {
      type: "mafiaTake";
      diamonds?: number;
      tokenId?: string;
      discardTokenId?: string;
      nothing?: boolean;
    }
  | { type: "mafiaAccuse"; target: string }
  | { type: "mafiaSay"; text: string }
  | { type: "mafiaCleaner"; choice: "SHOOT" | "PASS" }
  | { type: "mafiaResolve" };
export const mafiaToken = (g: MafiaPublicState) => `${g.id}:${g.revision}`;
export const rightNeighbor = (order: string[], uid: string) =>
  order[(order.indexOf(uid) - 1 + order.length) % order.length];
export function normalizeMafia(g: MafiaPublicState) {
  g.history ??= [];
  g.winners ??= [];
  if (g.final) g.final.box.tokens ??= [];
}
export function mafiaSetup(count: number, cleaner = false) {
  const table: Record<number, number[]> = {
    6: [1, 1, 1, 0],
    7: [2, 1, 1, 0],
    8: [3, 1, 1, 1],
    9: [4, 1, 1, 1],
    10: [4, 2, 1, 1],
    11: [4, 2, 2, 2],
    12: [5, 2, 2, 2],
  };
  if (!table[count]) throw new Error("需要 6–12 位玩家");
  const [henchmen, agents, drivers, jokers] = table[count];
  const roles: MafiaTokenRole[] = [
    ...Array<MafiaTokenRole>(henchmen - (cleaner ? 1 : 0)).fill(
      "LOYAL_HENCHMAN",
    ),
    "AGENT_FBI",
    ...(agents === 2 ? ["AGENT_CIA" as const] : []),
    ...Array<MafiaTokenRole>(drivers).fill("DRIVER"),
    ...(cleaner ? ["CLEANER" as const] : []),
  ];
  return {
    diamonds: 15,
    jokers,
    tokens: roles.map((role, i) => ({ id: `token-${i}`, role })),
  };
}
