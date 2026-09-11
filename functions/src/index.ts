import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomInt, randomUUID, createHash } from "node:crypto";
import { applyGameAction, startGame } from "./engine";
import { startBomb, applyBombAction } from "./timebomb-engine";
import { startDecorum, applyDecorumAction } from "./decorum/engine";
import { DECORUM_SCENARIOS, decorumToken } from "./shared/decorum";
import type { DecorumAction } from "./shared/decorum";
import { leaveSeat } from "./membership";
import { botNickname } from "./bot-names";
import { advanceOneBot, botToken } from "./bots";
import { GAME_LIMITS } from "./shared/model";
import { bombToken } from "./shared/timebomb";
import type { BombAction } from "./shared/timebomb";
import { ensure } from "./shared/rules";
import type {
  GameAction,
  RoomAction,
  Session,
  PlatformGameAction,
} from "./shared/model";

initializeApp(
  process.env.FIREBASE_DATABASE_EMULATOR_HOST
    ? {
        databaseURL: `https://${process.env.GCLOUD_PROJECT}-default-rtdb.firebaseio.com`,
      }
    : process.env.DATABASE_URL
      ? { databaseURL: process.env.DATABASE_URL }
      : undefined,
);
const db = getDatabase();
const options = { region: "asia-east1", maxInstances: 10 };
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codePattern = /^[A-HJ-NP-Z2-9]{6}$/;
type RequestData = {
  code?: string;
  nickname?: string;
  gameId?: string;
  action?: PlatformGameAction | RoomAction;
  phaseToken?: string;
  mode?: "friends" | "practice";
  playerCount?: number;
  bombVariant?: "standard" | "evolution" | "classic";
  botLevel?: "casual" | "standard";
  token?: string;
};
function nickname(value: unknown): string {
  ensure(
    typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= 20,
    "暱稱需要 1–20 個字",
  );
  return value.trim();
}
function code(value: unknown): string {
  ensure(
    typeof value === "string" && codePattern.test(value),
    "請輸入六碼房號",
  );
  return value;
}
function shuffled(seed: string) {
  let invocation = 0;
  return <T>(values: T[]): T[] => {
    const stream = invocation++;
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const n = createHash("sha256")
        .update(`${seed}:${stream}:${i}`)
        .digest()
        .readUInt32BE(0);
      const j = n % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
}
async function mutate(
  roomCode: string,
  change: (session: Session) => Session | null,
) {
  const reference = db.ref(`sessions/${roomCode}`);
  ensure((await reference.get()).exists(), "找不到房間");
  // RTDB may first invoke the callback with an empty local cache. Returning null
  // allows the server's compare-and-swap to retry with the actual current value.
  let found = false;
  let validationError: unknown;
  const result = await reference.transaction((value: Session | null) => {
    found = !!value;
    validationError = undefined;
    if (!value) return null;
    try {
      return change(structuredClone(value));
    } catch (error) {
      // A retry callback runs on an SDK event loop. Abort instead of throwing
      // there, then translate the validation error in the callable handler.
      validationError = error;
      return undefined;
    }
  });
  if (validationError) throw validationError;
  ensure(found, "找不到房間");
  ensure(result.committed, "操作發生衝突，請重試");
}
function isStale(session: Session, uid: string, joinedAt: number, now: number) {
  const value = session.presence?.[uid];
  return (
    !Object.keys(value?.connections ?? {}).length &&
    now - (value?.lastSeen ?? joinedAt) > 90_000
  );
}
function callable(
  handler: (uid: string, data: RequestData) => Promise<unknown>,
) {
  return onCall(options, async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "請先完成匿名登入");
    try {
      ensure(
        request.data &&
          typeof request.data === "object" &&
          !Array.isArray(request.data),
        "無效的操作",
      );
      return await handler(request.auth.uid, request.data as RequestData);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof Error && !("code" in error))
        throw new HttpsError("failed-precondition", error.message);
      console.error("Room operation failed", error);
      throw new HttpsError("internal", "伺服器暫時無法完成操作，請稍後再試");
    }
  });
}
export const createRoom = callable(async (uid, data) => {
  const name = nickname(data.nickname);
  ensure(
    data.gameId && Object.hasOwn(GAME_LIMITS, data.gameId),
    "此遊戲尚未開放",
  );
  ensure(
    data.mode === undefined || ["friends", "practice"].includes(data.mode),
    "無效的房間模式",
  );
  ensure(
    data.bombVariant === undefined ||
      ["classic", "evolution"].includes(data.bombVariant),
    "無效的規則模式",
  );
  ensure(
    data.botLevel === undefined ||
      ["casual", "standard"].includes(data.botLevel),
    "無效的 AI 難度",
  );
  const limits = GAME_LIMITS[data.gameId];
  ensure(data.gameId !== "decorum" || data.mode !== "practice", "同房異夢需要 2–4 位真人合作");
  const variant = data.gameId === "timebomb-classic" ? "classic" : "evolution";
  ensure(
    data.bombVariant === undefined || data.bombVariant === variant,
    "規則必須與選擇的遊戲版本一致",
  );
  const count = data.mode === "practice" ? (data.playerCount ?? limits.min) : 1;
  ensure(
    Number.isInteger(count) &&
      count >= (data.mode === "practice" ? limits.min : 1) &&
      count <= limits.max,
    "人數不正確",
  );
  for (let attempt = 0; attempt < 8; attempt++) {
    const roomCode = Array.from(
      { length: 6 },
      () => alphabet[randomInt(alphabet.length)],
    ).join("");
    const now = Date.now();
    const session: Session = {
      public: {
        code: roomCode,
        gameId: data.gameId,
        mode: data.mode ?? "friends",
        bombVariant: variant,
        botLevel: data.botLevel ?? "standard",
        hostId: uid,
        status: "waiting",
        createdAt: now,
        players: {
          [uid]: { uid, nickname: name, joinedAt: now, ready: false },
        },
      },
      private: {},
      secret: { teamVotes: {}, missionVotes: {} },
    };
    for (let i = 1; i < count; i++) {
      const botId = `bot_${i}`;
      session.public.players[botId] = {
        uid: botId,
        nickname: botNickname(session.public.players, `${roomCode}:${botId}`),
        joinedAt: now + i,
        ready: true,
        isBot: true,
      };
    }
    const result = await db
      .ref(`sessions/${roomCode}`)
      .transaction((current) => (current ? undefined : session));
    if (result.committed) return { code: roomCode };
  }
  throw new HttpsError("resource-exhausted", "暫時無法產生房號，請重試");
});
export const joinRoom = callable(async (uid, data) => {
  const roomCode = code(data.code);
  const name = nickname(data.nickname);
  await mutate(roomCode, (session) => {
    const room = session.public;
    if (room.players[uid]) {
      ensure(!room.players[uid].isBot, "此座位已由 AI 接手，請等待本局結束後再加入");
      return session;
    }
    ensure(room.mode !== "practice", "此房間為單人練習，請建立自己的練習桌");
    ensure(room.status === "waiting", "遊戲已開始，僅原玩家可重新連線");
    ensure(
      Object.keys(room.players).length < GAME_LIMITS[room.gameId].max,
      "房間已滿",
    );
    room.players[uid] = {
      uid,
      nickname: name,
      joinedAt: Date.now(),
      ready: false,
    };
    return session;
  });
  return { code: roomCode };
});
export const roomAction = callable(async (uid, data) => {
  const roomCode = code(data.code);
  const action = data.action;
  ensure(action && typeof action.type === "string", "缺少房間操作");
  const seed = randomUUID();
  const gameId = randomUUID();
  const now = Date.now();
  await mutate(roomCode, (session) => {
    const room = session.public;
    ensure(room.players[uid] && !room.players[uid].isBot, "你不在房間內");
    switch (action.type) {
      case "decorScenario":
        ensure(room.gameId === "decorum" && room.hostId === uid && room.status === "waiting", "只有房主能在等待時選擇劇本");
        ensure(DECORUM_SCENARIOS.some((v) => v.id === action.scenarioId), "找不到這個劇本");
        room.decorumScenarioId = action.scenarioId;
        Object.values(room.players).forEach((p) => { p.ready = false; });
        break;
      case "ready":
        ensure(room.status === "waiting", "遊戲已開始");
        ensure(typeof action.ready === "boolean", "無效的準備狀態");
        room.players[uid].ready = action.ready;
        break;
      case "start":
        ensure(room.hostId === uid, "只有房主可以開始");
        room.activity = [];
        delete room.botActionAt;
        if (room.gameId === "decorum") startDecorum(session, gameId, shuffled(seed));
        else if (room.gameId === "timebomb" || room.gameId === "timebomb-classic")
          startBomb(
            session,
            gameId,
            shuffled(seed),
            room.bombVariant ?? "standard",
          );
        else startGame(session, gameId, shuffled(seed));
        break;
      case "addBot": {
        ensure(room.gameId !== "decorum", "同房異夢僅提供真人合作");
        ensure(
          room.hostId === uid && room.status === "waiting",
          "只有房主能在等待時新增 AI",
        );
        ensure(
          Object.keys(room.players).length < GAME_LIMITS[room.gameId].max,
          "房間已滿",
        );
        const botId = `bot_${gameId}`;
        room.players[botId] = {
          uid: botId,
          nickname: botNickname(room.players, seed),
          isBot: true,
          ready: true,
          joinedAt: now,
        };
        break;
      }
      case "removeBot":
        ensure(
          room.hostId === uid && room.status === "waiting",
          "只有房主能在等待時移除 AI",
        );
        ensure(
          typeof action.botId === "string" && room.players[action.botId]?.isBot,
          "只能移除 AI 玩家",
        );
        delete room.players[action.botId];
        break;
      case "leave": {
        return leaveSeat(session, uid);
      }
      case "rematch":
        ensure(room.hostId === uid, "只有房主可以再開一局");
        ensure(room.status === "finished", "遊戲尚未結束");
        delete room.game;
        delete room.timebomb;
        delete room.decorum;
        delete room.botActionAt;
        room.activity = [];
        room.status = "waiting";
        session.private = {};
        session.timebombPrivate = {};
        session.decorumPrivate = {};
        session.secret = { teamVotes: {}, missionVotes: {} };
        // A proxy occupies the seat only until the current game ends.
        Object.values(room.players).forEach((p) => {
          if (p.isProxy) delete room.players[p.uid];
        });
        Object.values(room.players).forEach((p) => {
          p.ready = !!p.isBot;
        });
        break;
      case "recover": {
        // Presence and membership share this transaction, so a reconnect forces
        // a retry and cannot be removed using an outdated offline snapshot.
        const stale = Object.values(room.players)
          .filter(
            (p) =>
              !p.isBot &&
              p.uid !== uid &&
              isStale(session, p.uid, p.joinedAt, now),
          )
          .map((p) => p.uid);
        ensure(stale.length > 0, "尚無離線超過 90 秒的玩家");
        for (const id of stale) {
          leaveSeat(session, id);
        }
        if (!room.players[room.hostId])
          room.hostId = Object.values(room.players)
            .filter((p) => !p.isBot)
            .sort(
              (a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid),
            )[0].uid;
        break;
      }
      default:
        throw new Error("未知房間操作");
    }
    return session;
  });
  return { ok: true };
});
export const gameAction = callable(async (uid, data) => {
  const roomCode = code(data.code);
  ensure(data.action && typeof data.action.type === "string", "缺少遊戲操作");
  const seed = randomUUID();
  await mutate(roomCode, (session) => {
    ensure(
      session.public.players[uid] && !session.public.players[uid].isBot,
      "你不在房間內",
    );
    if (
      session.public.gameId === "decorum"
    ) {
      const game = session.public.decorum;
      ensure(game, "遊戲尚未開始");
      ensure(data.phaseToken === decorumToken(game), "遊戲階段已變更，請確認畫面後再操作");
      return applyDecorumAction(session, uid, data.action as DecorumAction);
    }
    if (
      session.public.gameId === "timebomb" ||
      session.public.gameId === "timebomb-classic"
    ) {
      const game = session.public.timebomb;
      ensure(game, "遊戲尚未開始");
      ensure(
        data.phaseToken === bombToken(game),
        "遊戲階段已變更，請確認畫面後再操作",
      );
      return applyBombAction(
        session,
        uid,
        data.action as BombAction,
        shuffled(seed),
      );
    }
    const game = session.public.game;
    ensure(game, "遊戲尚未開始");
    ensure(
      data.phaseToken ===
        `${game.id}:${game.round}:${game.phase}:${game.proposalAttempt}`,
      "遊戲階段已變更，請確認畫面後再操作",
    );
    return applyGameAction(session, uid, data.action as GameAction);
  });
  return { ok: true };
});
export const advanceBots = callable(async (uid, data) => {
  const roomCode = code(data.code),
    seed = randomUUID(),
    now = Date.now();
  let moved = false;
  let idle = false;
  await mutate(roomCode, (s) => {
    ensure(
      s.public.players[uid] && !s.public.players[uid].isBot,
      "你不在房間內",
    );
    moved = false;
    idle = false;
    if (
      s.public.status !== "playing" ||
      data.token !== botToken(s.public) ||
      now - (s.public.botActionAt ?? 0) < 650
    )
      return s;
    moved = advanceOneBot(s, shuffled(seed));
    idle = !moved;
    if (moved) s.public.botActionAt = now;
    return s;
  });
  return { moved, idle };
});
