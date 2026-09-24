import { cellKey, MINE_CARD_BY_ID, pathBlocked } from "./saboteur";
import type {
  Edge,
  MineBoard,
  MinePlayer,
  MineTile,
  PathCard,
  Team,
} from "./saboteur";
export const EDGES: Edge[] = ["N", "E", "S", "W"];
export const STEP: Record<Edge, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};
export const opposite = (e: Edge): Edge => EDGES[(EDGES.indexOf(e) + 2) % 4];
export function tileChannels(tile: MineTile): Edge[][] {
  let channels: Edge[][];
  if (tile.type === "start" || tile.revealed === "GOLD")
    channels = [["N", "E", "S", "W"]];
  else if (tile.type === "goal")
    channels = tile.revealed
      ? tile.cardId === "goal-2"
        ? [["N", "W"]]
        : [["N", "E"]]
      : [];
  else {
    const c = MINE_CARD_BY_ID[tile.cardId];
    channels = c?.kind === "path" ? c.channels : [];
  }
  return tile.rotation === 180
    ? channels.map((ch) => ch.map(opposite))
    : channels;
}
export function reachableChannels(board: MineBoard, team?: Team): Set<string> {
  const reached = new Set<string>(),
    queue: Array<[string, number]> = [];
  const allowed = (tile: MineTile) => {
    const c = MINE_CARD_BY_ID[tile.cardId];
    return !(team && c?.kind === "path" && c.door && c.door !== team);
  };
  function visit(key: string, channel: number) {
    const node = `${key}:${channel}`;
    if (!reached.has(node)) {
      reached.add(node);
      queue.push([key, channel]);
    }
  }
  for (const [key, t] of Object.entries(board)) {
    const c = MINE_CARD_BY_ID[t.cardId];
    if (allowed(t) && (t.type === "start" || (c?.kind === "path" && c.ladder)))
      tileChannels(t).forEach((_, i) => visit(key, i));
  }
  for (let i = 0; i < queue.length; i++) {
    const [key, channel] = queue[i],
      tile = board[key];
    for (const edge of tileChannels(tile)[channel]) {
      const [dx, dy] = STEP[edge],
        nextKey = cellKey(tile.x + dx, tile.y + dy),
        next = board[nextKey];
      if (!next || !allowed(next)) continue;
      tileChannels(next).forEach((ports, j) => {
        if (ports.includes(opposite(edge))) visit(nextKey, j);
      });
    }
  }
  return reached;
}
export function reachableGoal(
  board: MineBoard,
  key: string,
  reachable = reachableChannels(board),
): boolean {
  const tile = board[key];
  return EDGES.some((edge) => {
    const [dx, dy] = STEP[edge],
      nk = cellKey(tile.x + dx, tile.y + dy),
      n = board[nk];
    return (
      n &&
      tileChannels(n).some(
        (ports, i) =>
          ports.includes(opposite(edge)) && reachable.has(`${nk}:${i}`),
      )
    );
  });
}
export function canTeamReachGold(board: MineBoard, team: Team) {
  const reachable = reachableChannels(board, team);
  return Object.entries(board).some(
    ([key, tile]) =>
      tile.revealed === "GOLD" &&
      tileChannels(tile).some((_, i) => reachable.has(`${key}:${i}`)),
  );
}
export function validatePathPlacement(
  board: MineBoard,
  card: PathCard,
  x: number,
  y: number,
  rotation: number,
  player?: MinePlayer,
): string | null {
  if (player && pathBlocked(player))
    return "工具損壞或被困住，無法蓋路；可以出行動牌或棄兩張解除狀態";
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    Math.abs(x) > 256 ||
    Math.abs(y) > 256
  )
    return "無效的礦道座標";
  if (rotation !== 0 && rotation !== 180) return "道路牌只能旋轉 0° 或 180°";
  const key = cellKey(x, y);
  if (board[key]) return "這個位置已有卡牌";
  const tile: MineTile = { x, y, cardId: card.id, rotation, type: "path" },
    ports = tileChannels(tile).flat();
  let adjacent = false;
  for (const e of EDGES) {
    const [dx, dy] = STEP[e],
      n = board[cellKey(x + dx, y + dy)];
    if (!n) continue;
    if (card.ladder && n.type === "goal") return "梯子不能放在目標牌旁邊";
    if (n.type !== "goal" || (!card.ladder && n.revealed)) adjacent = true;
    if (n.type === "goal" && !n.revealed) continue;
    if (ports.includes(e) !== tileChannels(n).flat().includes(opposite(e)))
      return "相鄰邊緣的道路與牆壁必須一致";
  }
  if (!adjacent) return "必須緊鄰已存在的道路或入口";
  const reachable = reachableChannels({ ...board, [key]: tile });
  return card.channels.some((_, i) => reachable.has(`${key}:${i}`))
    ? null
    : "這張道路沒有連回入口";
}
export function frontier(board: MineBoard) {
  const cells = new Map<string, { x: number; y: number }>();
  for (const tile of Object.values(board).filter(
    (t) => t.type !== "goal" || !!t.revealed,
  ))
    for (const e of EDGES) {
      const [dx, dy] = STEP[e],
        x = tile.x + dx,
        y = tile.y + dy,
        key = cellKey(x, y);
      if (!board[key]) cells.set(key, { x, y });
    }
  return [...cells.values()];
}
export const countVisibleCrystals = (board: MineBoard) =>
  Object.values(board).reduce((n, t) => {
    const c = MINE_CARD_BY_ID[t.cardId];
    return n + (c?.kind === "path" ? (c.crystalCount ?? 0) : 0);
  }, 0);
