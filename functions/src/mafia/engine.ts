import type { Session } from "../shared/model";
import { ensure } from "../shared/rules";
import {
  DEFAULT_MAFIA_CONFIG,
  mafiaSetup,
  normalizeMafia,
  rightNeighbor,
} from "../shared/mafia";
import type {
  MafiaAction,
  MafiaConfig,
  MafiaRole,
  MafiaPublicState,
} from "../shared/mafia";

export function validateMafiaConfig(c: MafiaConfig) {
  ensure(
    c &&
      typeof c.cleanerEnabled === "boolean" &&
      ["HOST_SELECTS", "RANDOM"].includes(c.godfatherSelection) &&
      c.expansion === "NONE" &&
      (c.godfatherId === undefined || typeof c.godfatherId === "string"),
    "無效的遊戲設定",
  );
  return {
    cleanerEnabled: c.cleanerEnabled,
    godfatherSelection: c.godfatherSelection,
    expansion: "NONE" as const,
    ...(c.godfatherId ? { godfatherId: c.godfatherId } : {}),
  };
}
export function startMafia(
  s: Session,
  id: string,
  shuffle: <T>(a: T[]) => T[],
) {
  const room = s.public;
  ensure(room.status === "waiting", "遊戲已開始");
  const players = Object.values(room.players).sort(
    (a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid),
  );
  ensure(
    players.length >= 6 &&
      players.length <= 12 &&
      players.every((p) => p.ready),
    "需要 6–12 位已準備的玩家",
  );
  const config = validateMafiaConfig(room.mafiaConfig ?? DEFAULT_MAFIA_CONFIG);
  const order = players.map((p) => p.uid);
  const godfatherId =
    config.godfatherSelection === "RANDOM"
      ? shuffle(order)[0]
      : (config.godfatherId ?? room.hostId);
  ensure(order.includes(godfatherId), "請重新選擇教父");
  const index = order.indexOf(godfatherId),
    passOrder = [...order.slice(index + 1), ...order.slice(0, index)];
  const setup = mafiaSetup(order.length, config.cleanerEnabled);
  room.mafia = {
    id,
    revision: 0,
    phase: "GODFATHER_PREPARE_BOX",
    config,
    order,
    passOrder,
    godfatherId,
    holderId: godfatherId,
    jokers: setup.jokers,
    recovered: 0,
    history: [],
    winners: [],
    seats: Object.fromEntries(
      players.map((p) => [
        p.uid,
        {
          uid: p.uid,
          nickname: p.nickname,
          alive: true,
          revealed: p.uid === godfatherId,
          ...(p.uid === godfatherId ? { role: "GODFATHER" as const } : {}),
        },
      ]),
    ),
  };
  s.secret ??= { teamVotes: {}, missionVotes: {} };
  s.secret.mafia = {
    box: { diamonds: 15, tokens: setup.tokens },
    hiddenDiamonds: 0,
    initialDiamonds: 15,
    roles: { [godfatherId]: { role: "GODFATHER", diamonds: 0 } },
  };
  s.mafiaPrivate = Object.fromEntries(
    order.map((uid) => [
      uid,
      {
        gameId: id,
        diamonds: 0,
        ...(uid === godfatherId ? { role: "GODFATHER" as const } : {}),
      },
    ]),
  );
  room.status = "playing";
}
const agent = (role: MafiaRole) => role === "AGENT_FBI" || role === "AGENT_CIA";
export function mafiaWinners(
  s: Session,
  reason: MafiaPublicState["winReason"],
  solo?: string,
) {
  const g = s.public.mafia!,
    roles = s.secret.mafia!.roles;
  if (solo) return [solo];
  let winners: string[] = [];
  if (reason === "DIAMONDS_RECOVERED")
    winners = g.order.filter(
      (uid) =>
        g.seats[uid].alive &&
        ["GODFATHER", "LOYAL_HENCHMAN", "CLEANER"].includes(roles[uid]?.role),
    );
  else if (reason === "GODFATHER_ELIMINATED") {
    const thieves = g.order.filter(
      (uid) => g.seats[uid].alive && roles[uid]?.role === "THIEF",
    );
    const most = Math.max(...thieves.map((uid) => roles[uid].diamonds), -1);
    winners = g.order.filter(
      (uid) =>
        g.seats[uid].alive &&
        (roles[uid]?.role === "STREET_URCHIN" ||
          (roles[uid]?.role === "THIEF" && roles[uid].diamonds === most)),
    );
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const uid of g.order)
      if (
        g.seats[uid].alive &&
        roles[uid]?.role === "DRIVER" &&
        !winners.includes(uid) &&
        winners.includes(rightNeighbor(g.order, uid))
      ) {
        winners.push(uid);
        changed = true;
      }
  }
  return winners;
}
function clearViews(s: Session) {
  for (const p of Object.values(s.mafiaPrivate ?? {})) delete p.currentBoxView;
}
export function finishMafia(
  s: Session,
  reason: NonNullable<MafiaPublicState["winReason"]>,
  solo?: string,
) {
  const g = s.public.mafia!,
    secret = s.secret.mafia!;
  g.phase = "GAME_OVER";
  g.winReason = reason;
  g.winners = reason === "ABORTED" ? [] : mafiaWinners(s, reason, solo);
  clearViews(s);
  delete g.pending;
  if (reason !== "ABORTED")
    g.final = {
      hiddenDiamonds: secret.hiddenDiamonds,
      box: structuredClone(secret.box),
      roles: structuredClone(secret.roles),
      ...(secret.discarded ? { discarded: secret.discarded } : {}),
    };
  s.public.status = "finished";
}
function checkRecovered(s: Session) {
  const g = s.public.mafia!,
    secret = s.secret.mafia!;
  if (g.recovered === secret.initialDiamonds - secret.box.diamonds) {
    finishMafia(s, "DIAMONDS_RECOVERED");
    return true;
  }
  return false;
}
function resolveAccusation(s: Session) {
  const g = s.public.mafia!,
    sec = s.secret.mafia!,
    target = g.pending!.target,
    held = sec.roles[target],
    seat = g.seats[target];
  seat.revealed = true;
  seat.role = held.role;
  seat.diamonds = held.diamonds;
  let outcome: "THIEF" | "JOKER" | "AGENT" | "GODFATHER_OUT" | "SHOT";
  const cleaner = g.order.find(
    (uid) => sec.roles[uid]?.role === "CLEANER" && g.seats[uid].alive,
  );
  g.phase = "INVESTIGATION";
  delete g.pending;
  if (cleaner && sec.cleanerChoice === "SHOOT") {
    outcome = "SHOT";
    seat.alive = false;
    if (agent(held.role)) finishMafia(s, "CLEANER_SHOT_AGENT", cleaner);
    else {
      g.seats[cleaner].alive = false;
      g.seats[cleaner].revealed = true;
      g.seats[cleaner].role = "CLEANER";
      if (held.role === "THIEF") {
        g.recovered += held.diamonds;
        checkRecovered(s);
      }
    }
  } else if (agent(held.role)) {
    outcome = "AGENT";
    finishMafia(s, "AGENT_ACCUSED", target);
  } else if (held.role === "THIEF") {
    outcome = "THIEF";
    seat.alive = false;
    g.recovered += held.diamonds;
    checkRecovered(s);
  } else if (g.jokers > 0) {
    outcome = "JOKER";
    g.jokers--;
  } else {
    outcome = "GODFATHER_OUT";
    g.seats[g.godfatherId].alive = false;
    finishMafia(s, "GODFATHER_ELIMINATED");
  }
  g.history.push({
    target,
    role: held.role,
    diamonds: held.diamonds,
    outcome,
    revision: g.revision + 1,
  });
  delete sec.cleanerChoice;
  for (const p of Object.values(s.mafiaPrivate!)) delete p.cleanerChoice;
  const father = s.mafiaPrivate![g.godfatherId];
  father.missing = sec.initialDiamonds - sec.box.diamonds - g.recovered;
}
export function applyMafiaAction(
  s: Session,
  uid: string,
  a: MafiaAction,
  now = Date.now(),
): Session {
  const g = s.public.mafia,
    sec = s.secret.mafia;
  ensure(
    s.public.gameId === "mafia-de-cuba" &&
      s.public.status === "playing" &&
      g &&
      sec &&
      s.public.players[uid],
    "遊戲尚未開始或你不在房間",
  );
  normalizeMafia(g);
  sec.box.tokens ??= [];
  const own = s.mafiaPrivate![uid];
  switch (a.type) {
    case "mafiaPrepare": {
      ensure(
        g.phase === "GODFATHER_PREPARE_BOX" && uid === g.godfatherId,
        "只有教父可準備雪茄盒",
      );
      ensure(
        Number.isInteger(a.hidden) && a.hidden >= 0 && a.hidden <= 5,
        "只能藏起 0–5 顆鑽石",
      );
      sec.hiddenDiamonds = a.hidden;
      sec.initialDiamonds = 15 - a.hidden;
      sec.box.diamonds = sec.initialDiamonds;
      own.hiddenDiamonds = a.hidden;
      g.phase = "BOX_PASS";
      g.holderId = g.passOrder[0];
      clearViews(s);
      s.mafiaPrivate![g.holderId].currentBoxView = structuredClone(sec.box);
      break;
    }
    case "mafiaTake": {
      ensure(g.phase === "BOX_PASS" && uid === g.holderId, "現在不是你的回合");
      const position = g.passOrder.indexOf(uid);
      if (a.discardTokenId !== undefined) {
        ensure(
          position === 0 &&
            typeof a.discardTokenId === "string" &&
            sec.box.tokens.some((t) => t.id === a.discardTokenId),
          "只有第一位玩家可秘密移除一枚角色",
        );
        sec.discarded = sec.box.tokens.find((t) => t.id === a.discardTokenId)!;
        sec.box.tokens = sec.box.tokens.filter(
          (t) => t.id !== a.discardTokenId,
        );
      }
      const empty = sec.box.diamonds === 0 && sec.box.tokens.length === 0;
      ensure(
        (a.diamonds === undefined ||
          (Number.isInteger(a.diamonds) && a.diamonds > 0)) &&
          (a.tokenId === undefined || typeof a.tokenId === "string") &&
          (a.nothing === undefined || a.nothing === true),
        "無效的拿取方式",
      );
      const choices =
        Number(a.diamonds !== undefined) +
        Number(a.tokenId !== undefined) +
        Number(a.nothing === true);
      ensure(choices === 1, "請選擇鑽石、一枚角色或空手離開");
      let role: MafiaRole,
        diamonds = 0;
      if (a.nothing) {
        ensure(
          empty || position === g.passOrder.length - 1,
          "只有最後一位或空盒可空手離開",
        );
        role = "STREET_URCHIN";
      } else if (a.diamonds !== undefined) {
        ensure(a.diamonds <= sec.box.diamonds, "鑽石數量不足");
        diamonds = a.diamonds;
        sec.box.diamonds -= diamonds;
        role = "THIEF";
      } else {
        const token = sec.box.tokens.find((t) => t.id === a.tokenId);
        ensure(token, "角色已不在盒內");
        role = token.role;
        sec.box.tokens = sec.box.tokens.filter((t) => t.id !== a.tokenId);
      }
      sec.roles[uid] = { role, diamonds };
      own.role = role;
      own.diamonds = diamonds;
      clearViews(s);
      if (position === g.passOrder.length - 1) {
        g.holderId = g.godfatherId;
        g.phase = "INVESTIGATION";
        const father = s.mafiaPrivate![g.godfatherId];
        father.currentBoxView = structuredClone(sec.box);
        father.missing = sec.initialDiamonds - sec.box.diamonds;
        checkRecovered(s);
      } else {
        g.holderId = g.passOrder[position + 1];
        s.mafiaPrivate![g.holderId].currentBoxView = structuredClone(sec.box);
      }
      break;
    }
    case "mafiaAccuse":
      ensure(
        g.phase === "INVESTIGATION" && uid === g.godfatherId,
        "只有教父可指控",
      );
      ensure(
        typeof a.target === "string" &&
          a.target !== uid &&
          g.seats[a.target]?.alive &&
          !g.seats[a.target].revealed,
        "請選擇尚未揭曉的玩家",
      );
      g.pending = {
        target: a.target,
        deadline: now + (g.config.cleanerEnabled ? 8000 : 1500),
      };
      g.phase = "ACCUSATION_PENDING";
      break;
    case "mafiaCleaner":
      ensure(
        g.phase === "ACCUSATION_PENDING" &&
          g.config.cleanerEnabled &&
          now < g.pending!.deadline &&
          own.role === "CLEANER" &&
          g.seats[uid].alive &&
          !sec.cleanerChoice &&
          ["SHOOT", "PASS"].includes(a.choice),
        "現在無法攔截",
      );
      sec.cleanerChoice = a.choice;
      own.cleanerChoice = a.choice;
      // No public revision, event or deadline change: ownership/choice stays private.
      return s;
    case "mafiaResolve":
      ensure(
        g.phase === "ACCUSATION_PENDING" && now >= g.pending!.deadline,
        "請等待指控揭曉",
      );
      resolveAccusation(s);
      break;
    default:
      throw new Error("未知操作");
  }
  g.revision++;
  return s;
}
