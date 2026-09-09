export const BOMB_COLORS = [
  "green",
  "orange",
  "pink",
  "yellow",
  "blue",
  "red",
] as const;
export type BombColor = (typeof BOMB_COLORS)[number];
export type Wire = BombColor | "success" | "safe" | "bomb";
export type BombRole = "sherlock" | "moriarty";
// standard is retained for existing Evolution rooms created before the split.
export type BombVariant = "standard" | "evolution" | "classic";
export const COLOR_NAMES: Record<BombColor, string> = {
  green: "綠色",
  orange: "橘色",
  pink: "粉紅",
  yellow: "黃色",
  blue: "藍色",
  red: "紅色",
};
export const BOMB_EFFECTS: Record<BombColor, string> = {
  green: "第三張即引爆；拆除後不會因張數引爆。",
  orange: "第四輪開始時，每張橘彈減少一次可剪線次數，已拆除仍生效。",
  pink: "連續兩張粉紅立即引爆，即使已拆除也無效。",
  yellow: "不能被解除引線拆除。",
  blue: "移除一種顏色的拆除保護；若已達爆炸張數，立即引爆。",
  red: "下次剪線對象隨機指定，可能是自己；跨輪仍有效。",
};
export interface BombPrivate {
  role: BombRole;
  round: number;
  inventory: Partial<Record<Wire, number>>;
}
export interface CutRecord {
  round: number;
  actor: string;
  target: string;
  slot: number;
  wire: Wire;
  note?: string;
}
export interface BombGame {
  id: string;
  revision: number;
  phase:
    | "ROLE_REVEAL"
    | "CLAIMS"
    | "CUT"
    | "DEFUSE"
    | "REARM"
    | "CUT_RESULT"
    | "GAME_OVER";
  variant: BombVariant;
  round: number;
  order: string[];
  scissorsId: string;
  colors: BombColor[];
  hands: Record<string, number[]>;
  confirmed: Record<string, boolean>;
  claims: Record<string, number>;
  cuts: number;
  cutLimit: number;
  successes: number;
  bombs: Partial<Record<BombColor, number>>;
  defused: Partial<Record<BombColor, boolean>>;
  history: CutRecord[];
  forcedTarget?: string;
  effectActor?: string;
  winner?: "good" | "evil";
  winReason?: string;
  roles?: Record<string, BombRole>;
}
export type BombAction =
  | { type: "bombReveal" }
  | { type: "claim"; successes: number }
  | { type: "cut"; target: string; slot: number }
  | { type: "defuse"; color: BombColor }
  | { type: "rearm"; color: BombColor }
  | { type: "bombContinue" };
export const bombToken = (g: BombGame) =>
  `${g.id}:${g.round}:${g.phase}:${g.cuts}`;
export const bombThreshold = (g: BombGame, c: BombColor) =>
  g.variant === "evolution" && c === "green" ? 3 : 4;
export const defusableColors = (g: BombGame) =>
  g.colors.filter(
    (c) => c !== "yellow" && (g.bombs[c] ?? 0) > 0 && !g.defused[c],
  );
export const rearmableColors = (g: BombGame) =>
  g.colors.filter((c) => g.defused[c]);
