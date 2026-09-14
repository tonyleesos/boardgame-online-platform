import { httpsCallable } from "firebase/functions";
import { firebase } from "./config";
import type {
  LeaderboardResponse,
  LeaderboardSort,
} from "../../../functions/src/shared/leaderboard";
import { createAsyncCache } from "../../../functions/src/shared/async-cache";
const leaderboardCache = createAsyncCache<LeaderboardResponse>();
let leaderboardUid: string | undefined;
export function getLeaderboard(sort: LeaderboardSort) {
  const uid = firebase?.auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error("請先登入會員帳號"));
  if (leaderboardUid !== uid) {
    leaderboardCache.clear();
    leaderboardUid = uid;
  }
  return leaderboardCache.get(`${uid}:${sort}`, () =>
    call<LeaderboardResponse>("getLeaderboard", { sort }),
  );
}
export function refreshLeaderboard(sort: LeaderboardSort) {
  leaderboardCache.delete(`${firebase?.auth.currentUser?.uid}:${sort}`);
}
export function clearLeaderboardCache() {
  leaderboardCache.clear();
}
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
    "auth/admin-restricted-operation": "目前無法建立帳號，請稍後再試。",
    "auth/operation-not-allowed": "帳號登入服務尚未開放，請聯絡管理員。",
    "auth/invalid-email": "請輸入有效的電子郵件地址。",
    "auth/invalid-credential": "電子郵件或密碼不正確，請重新輸入。",
    "auth/invalid-login-credentials": "電子郵件或密碼不正確，請重新輸入。",
    "auth/user-not-found": "電子郵件或密碼不正確，請重新輸入。",
    "auth/wrong-password": "電子郵件或密碼不正確，請重新輸入。",
    "auth/email-already-in-use": "此電子郵件已註冊，請登入或重設密碼。",
    "auth/weak-password": "密碼強度不足，請使用至少 8 個字元。",
    "auth/password-does-not-meet-requirements":
      "密碼不符合安全要求，請使用更強的密碼。",
    "auth/user-disabled": "此帳號已停用，請聯絡管理員。",
    "auth/too-many-requests": "嘗試次數過多，請稍後再試。",
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
export const decorumAction = (
  code: string,
  game: DecorumPublicState,
  action: DecorumAction,
) => call("gameAction", { code, action, phaseToken: decorumToken(game) });
import { decorumToken } from "../../../functions/src/shared/decorum";
import type {
  DecorumPublicState,
  DecorumAction,
} from "../../../functions/src/shared/decorum";
import type {
  BombGame,
  BombAction,
} from "../../../functions/src/shared/timebomb";
import { bombToken } from "../../../functions/src/shared/timebomb";

import { splendorToken } from "../../../functions/src/shared/splendor";
import type {
  SplendorAction,
  SplendorPublicState,
} from "../../../functions/src/shared/splendor";
export const splendorAction = (
  code: string,
  game: SplendorPublicState,
  action: SplendorAction,
) => call("gameAction", { code, action, phaseToken: splendorToken(game) });

import {
  mafiaToken,
  type MafiaAction,
  type MafiaPublicState,
} from "../../../functions/src/shared/mafia";
export const mafiaAction = (
  code: string,
  game: MafiaPublicState,
  action: MafiaAction,
) => call("gameAction", { code, action, phaseToken: mafiaToken(game) });
