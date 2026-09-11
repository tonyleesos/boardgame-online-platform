import { httpsCallable } from "firebase/functions";
import { firebase } from "./config";
import type {
  Game,
  GameAction,
  RoomAction,
} from "../../../functions/src/shared/model";
export function errorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const messages: Record<string, string> = {
    "auth/admin-restricted-operation": "請在 Firebase Console 啟用匿名登入。",
    "auth/operation-not-allowed": "請在 Firebase Console 啟用匿名登入。",
    "auth/network-request-failed":
      "無法連線，請檢查網路或 Emulator 是否已啟動。",
    "auth/invalid-api-key": "Firebase API key 無效，請檢查本機設定。",
    "functions/unavailable":
      "無法連線至遊戲伺服器，請檢查網路及 Functions 部署狀態。",
    "functions/internal": "遊戲伺服器暫時無法使用，請確認 Functions 已部署。",
    PERMISSION_DENIED: "無法讀取房間：你可能已離開或房間已關閉。",
  };
  return (
    messages[code] ??
    (error instanceof Error ? error.message : "操作失敗，請稍後再試")
  );
}
async function call<T>(name: string, data: unknown): Promise<T> {
  if (!firebase) throw new Error("Firebase 尚未設定");
  const result = await httpsCallable<unknown, T>(
    firebase.functions,
    name,
  )(data);
  return result.data;
}
export const createRoom = (
  nickname: string,
  gameId: string,
  options: {
    mode?: "practice" | "friends";
    playerCount?: number;
    bombVariant?: "classic" | "evolution";
    botLevel?: "casual" | "standard";
  } = {},
) => call<{ code: string }>("createRoom", { nickname, gameId, ...options });
export const joinRoom = (nickname: string, code: string) =>
  call<{ code: string }>("joinRoom", { nickname, code });
export const roomAction = (code: string, action: RoomAction) =>
  call("roomAction", { code, action });
export const gameAction = (code: string, game: Game, action: GameAction) =>
  call("gameAction", {
    code,
    action,
    phaseToken: `${game.id}:${game.round}:${game.phase}:${game.proposalAttempt}`,
  });
export const bombAction = (code: string, game: BombGame, action: BombAction) =>
  call("gameAction", { code, action, phaseToken: bombToken(game) });
export const advanceBots = (code: string, token: string) =>
  call<{ moved: boolean; idle: boolean }>("advanceBots", { code, token });
export const decorumAction = (code: string, game: DecorumPublicState, action: DecorumAction) =>
  call("gameAction", { code, action, phaseToken: decorumToken(game) });
import { decorumToken } from "../../../functions/src/shared/decorum";
import type { DecorumPublicState, DecorumAction } from "../../../functions/src/shared/decorum";
import type {
  BombGame,
  BombAction,
} from "../../../functions/src/shared/timebomb";
import { bombToken } from "../../../functions/src/shared/timebomb";

import { splendorToken } from '../../../functions/src/shared/splendor';
import type { SplendorAction, SplendorPublicState } from '../../../functions/src/shared/splendor';
export const splendorAction = (code: string, game: SplendorPublicState, action: SplendorAction) => call('gameAction', {code, action, phaseToken: splendorToken(game)});
