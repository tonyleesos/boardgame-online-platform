import type {
  DwarfRole,
  MineRoundResult,
} from "../../../../functions/src/shared/saboteur";

export const ROUND_REVEAL_MS = 4400;
export function roundPresentation(result: MineRoundResult): {
  title: string;
  detail: string;
  tone: string;
  roles: DwarfRole[];
} {
  if (result.reason === "NO_CARDS_LEFT")
    return {
      title: "破壞者陣營獲勝",
      detail: "手牌已用盡，黃金仍埋在礦坑深處。",
      tone: "saboteur",
      roles: ["SABOTEUR"],
    };
  if (result.blue && result.green)
    return {
      title: "藍隊與綠隊共同獲勝",
      detail: "兩隊的礦道都成功通往黃金！",
      tone: "both",
      roles: ["BLUE_DIGGER", "GREEN_DIGGER"],
    };
  if (result.blue)
    return {
      title: "藍隊挖金矮人獲勝",
      detail: "藍隊成功打通通往黃金的礦道！",
      tone: "blue",
      roles: ["BLUE_DIGGER"],
    };
  if (result.green)
    return {
      title: "綠隊挖金矮人獲勝",
      detail: "綠隊成功打通通往黃金的礦道！",
      tone: "green",
      roles: ["GREEN_DIGGER"],
    };
  const roles = [
    ...new Set(
      Object.entries(result.roles)
        .filter(
          ([id, role]) =>
            !result.trapped.includes(id) &&
            (role === "BOSS" || role === "PROFITEER"),
        )
        .map(([, role]) => role),
    ),
  ];
  return {
    title: roles.length
      ? "黃金出土，特殊身份勝出"
      : "黃金出土，挖金陣營無人獲勝",
    detail: "藍綠兩隊都受色門阻擋；依特殊身份與水晶計算本輪獎勵。",
    tone: "gold",
    roles,
  };
}
