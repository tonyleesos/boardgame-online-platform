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
  GODFATHER: "找回所有被偷的鑽石。小心探員！",
  THIEF: "存活到教父出局；持有最多鑽石的竊賊獲勝。",
  LOYAL_HENCHMAN: "協助教父找回鑽石，存活並一起獲勝。",
  AGENT_FBI: "讓教父正式指控你，即可獨自獲勝。",
  AGENT_CIA: "讓教父正式指控你，即可獨自獲勝。",
  DRIVER: "原始座位右手邊的玩家獲勝，你也獲勝；獨勝除外。",
  STREET_URCHIN: "存活並等待竊賊陣營獲勝。",
  CLEANER: "協助教父；指控揭曉前擊中探員可獨勝，打錯則一起出局。",
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
  | { type: "mafiaCleaner"; choice: "SHOOT" | "PASS" }
  | { type: "mafiaResolve" };
export const mafiaToken = (g: MafiaPublicState) => `${g.id}:${g.revision}`;
export const rightNeighbor = (order: string[], uid: string) =>
  order[(order.indexOf(uid) + 1) % order.length];
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
