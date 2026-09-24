import { describe, expect, it } from "vitest";
import { roundPresentation } from "../client/src/games/saboteur/roundPresentation";
import type { MineRoundResult } from "../functions/src/shared/saboteur";
const result = (overrides: Partial<MineRoundResult> = {}): MineRoundResult => ({
  reason: "TREASURE_REACHED",
  blue: false,
  green: false,
  roles: { a: "BOSS", b: "PROFITEER", c: "GEOLOGIST" },
  awards: { a: 3, b: 2, c: 4 },
  crystals: 4,
  trapped: [],
  ...overrides,
});
describe("round victory presentation follows public scoring", () => {
  it.each([
    [true, false, "藍隊挖金矮人獲勝", ["BLUE_DIGGER"]],
    [false, true, "綠隊挖金矮人獲勝", ["GREEN_DIGGER"]],
    [true, true, "藍隊與綠隊共同獲勝", ["BLUE_DIGGER", "GREEN_DIGGER"]],
  ] as const)(
    "announces accessible teams: blue %s green %s",
    (blue, green, title, roles) => {
      expect(roundPresentation(result({ blue, green }))).toMatchObject({
        title,
        roles,
      });
    },
  );
  it("announces sabotage when no cards remain", () => {
    expect(
      roundPresentation(result({ reason: "NO_CARDS_LEFT" })),
    ).toMatchObject({ title: "破壞者陣營獲勝", roles: ["SABOTEUR"] });
  });
  it("does not name sabotage as winner when gold is reached but both colored teams are blocked", () => {
    expect(roundPresentation(result())).toMatchObject({
      title: "黃金出土，特殊身份勝出",
      roles: ["BOSS", "PROFITEER"],
    });
    expect(roundPresentation(result({ trapped: ["a", "b"] }))).toMatchObject({
      title: "黃金出土，挖金陣營無人獲勝",
      roles: [],
    });
  });
});
