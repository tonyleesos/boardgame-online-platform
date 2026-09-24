import { GOAL_KEYS } from "./saboteur";
import type { ActionCard, MineGame } from "./saboteur";
/** Shared public target selector; the trusted engine revalidates before applying. */
export function legalActionTargets(
  g: MineGame,
  uid: string,
  card: ActionCard,
): string[] {
  const ids = g.order;
  switch (card.action) {
    case "BREAK":
      return ids.filter(
        (id) => id !== uid && !g.players[id].effects[card.tools![0]],
      );
    case "REPAIR":
      return ids.filter((id) =>
        card.tools!.some((t) => !!g.players[id].effects[t]),
      );
    case "TRAPPED":
      return ids.filter((id) => id !== uid && !g.players[id].effects.TRAPPED);
    case "FREEDOM":
      return ids.filter((id) => !!g.players[id].effects.TRAPPED);
    case "THEFT":
      return g.players[uid].effects.THEFT ? [] : [uid];
    case "HANDS_OFF":
      return ids.filter((id) => !!g.players[id].effects.THEFT);
    case "CHANGE_HATS":
      return [...ids];
    case "SWAP_HANDS":
    case "INSPECTION":
      return ids.filter((id) => id !== uid);
    case "MAP":
      return GOAL_KEYS.filter((k) => !g.board[k].revealed);
    case "ROCKFALL":
      return Object.keys(g.board).filter((k) => g.board[k].type === "path");
  }
}
