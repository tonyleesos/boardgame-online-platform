import type { Session } from "../shared/model";
import { ensure } from "../shared/rules";
import {
  PLAYER_COUNT_RULES,
  canSubmitRose,
  isFlower,
  normalizeRose,
  normalizeRosePrivate,
  roseFaction,
  type CrystalId,
  type RoseAction,
  type RoseCard,
  type RoseFaction,
  type RoseGame,
  type RoseIdentity,
  type RosePrivate,
} from "../shared/bladesRose";
type Shuffle = <T>(items: T[]) => T[];
export function startRose(s: Session, id: string, shuffle: Shuffle): Session {
  const room = s.public;
  ensure(room.status === "waiting", "遊戲已開始");
  const players = Object.values(room.players).sort(
    (a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid),
  );
  ensure(players.length >= 5 && players.length <= 10, "需要 5–10 位玩家");
  const rule = PLAYER_COUNT_RULES[players.length];
  ensure(
    rule?.verifiedAgainstOfficialBoard &&
      rule.identities &&
      rule.requiredSafeBuds !== null &&
      rule.bloodKillThreshold !== null,
    "此人數規則尚未完成官方圖板校對，目前請使用 8 人模式",
  );
  ensure(
    players.every((p) => p.ready),
    "請所有玩家準備",
  );
  const roles = shuffle(
    Object.entries(rule.identities).flatMap(([role, n]) =>
      Array.from({ length: n }, () => role as RoseIdentity),
    ),
  );
  ensure(
    roles.length === players.length &&
      rule.identities.WHITE_ROSE === 1 &&
      rule.identities.BISHOP === 1 &&
      rule.identities.DOUBLE_BLADE === 1,
    "人數設定不完整",
  );
  const crystals = shuffle(
    Array.from({ length: 12 }, (_, i) => (i + 1) as CrystalId),
  );
  const order = players.map((p) => p.uid);
  s.rosePrivate = {};
  s.secret ??= { teamVotes: {}, missionVotes: {} };
  room.rose = {
    id,
    revision: 0,
    phase: "NIGHT",
    round: 0,
    order,
    coin: shuffle([...order])[0],
    current: "",
    queue: [],
    players: {},
    targets: [],
    safeRose: false,
    deadRose: false,
    safeBuds: 0,
    deadBuds: 0,
    history: [],
  };
  s.secret.rose = { contributions: {}, ghostReserve: 0, spareBlade: true };
  // §15/16: the physical eye icons identify GREAT_BLADE, not DARK_BLADE.
  const nightRoles: RoseIdentity[] = [
    "WHITE_ROSE",
    "BISHOP",
    "DOUBLE_BLADE",
    "GREAT_BLADE",
  ];
  let serial = 0;
  players.forEach((p, i) => {
    const identity = roles[i];
    s.rosePrivate![p.uid] = {
      revision: 0,
      identity,
      faction: roseFaction(identity),
      hand: ["FOLLOWER", "GHOST", identity].map((type) => ({
        id: `${id}-c${serial++}`,
        type: type as RoseCard["type"],
      })),
      crystal: crystals[i],
      night: nightRoles.includes(identity)
        ? order.filter(
            (uid, j) => uid !== p.uid && nightRoles.includes(roles[j]),
          )
        : [],
      knownRoles: {},
      acknowledged: false,
      constraint: {},
      replacementTargets: [],
    };
    room.rose!.players[p.uid] = {
      handCount: 3,
      crystalUsed: false,
      ready: false,
    };
  });
  room.status = "playing";
  return s;
}
export function roseWinner(
  g: RoseGame,
  privatePlayers: Record<string, RosePrivate>,
): { winner: RoseFaction; reason: string } | undefined {
  const rule = PLAYER_COUNT_RULES[g.order.length];
  if (g.deadRose) return { winner: "BLOOD_BLADE", reason: "白薔薇遭血刃擊殺" };
  if (g.deadBuds >= rule.bloodKillThreshold!)
    return { winner: "BLOOD_BLADE", reason: "擊殺花苞達到門檻" };
  if (g.safeRose && g.safeBuds >= rule.requiredSafeBuds!)
    return { winner: "WHITE_ROSE", reason: "白薔薇與足夠花苞完成獻祭" };
  if (g.order.every((uid) => g.players[uid].crystalUsed)) {
    const unresolved = Object.values(privatePlayers).some(
      (p) => p.faction === "WHITE_ROSE" && p.hand.some((c) => isFlower(c.type)),
    );
    return {
      winner: unresolved ? "BLOOD_BLADE" : "WHITE_ROSE",
      reason: unresolved
        ? "水晶用盡，白薔薇陣營仍有未獻出的花朵"
        : "水晶用盡，白薔薇陣營已獻出所有花朵",
    };
  }
}
function resolveRound(s: Session, shuffle: Shuffle) {
  const g = s.public.rose!,
    secret = s.secret.rose!;
  const entries = g.queue
    .filter((uid) => secret.contributions[uid])
    .map((uid) => ({ uid, card: secret.contributions[uid] }));
  const revealed = g.crystal === 2 ? entries : shuffle(entries);
  const cards = revealed.map((e, i) => ({
    revealId: `r${g.round}-${i}`,
    type: e.card.type,
    ...(g.crystal === 2 ? { sourceUid: e.uid } : {}),
  }));
  const killed = cards.some((c) => roseFaction(c.type) === "BLOOD_BLADE");
  const buds = cards.filter(
    (c) => c.type === "BISHOP" || c.type === "FOLLOWER",
  ).length;
  const rose = cards.some((c) => c.type === "WHITE_ROSE");
  if (killed) {
    g.deadBuds += buds;
    g.deadRose ||= rose;
  } else {
    g.safeBuds += buds;
    g.safeRose ||= rose;
  }
  g.history.push({
    round: g.round,
    crystal: g.crystal!,
    cards,
    killed,
    buds,
    rose,
  });
  g.phase = "ROUND_RESULT";
  g.current = g.coin;
  secret.contributions = {};
  delete secret.linked;
  for (const uid of g.order) {
    const p = s.rosePrivate![uid];
    g.players[uid].handCount = p.hand.length;
    p.constraint = {};
    p.replacementTargets = [];
    delete p.decision;
  }
  const end = roseWinner(g, s.rosePrivate!);
  if (end) {
    Object.assign(g, end);
    g.phase = "GAME_OVER";
    s.public.status = "finished";
    g.roles = Object.fromEntries(
      g.order.map((uid) => [uid, s.rosePrivate![uid].identity]),
    );
  }
}
function startDecisions(s: Session) {
  const g = s.public.rose!;
  g.phase = "DECISIONS";
  g.current = g.queue[0];
}
function completeDecisions(s: Session, shuffle: Shuffle) {
  const g = s.public.rose!,
    secret = s.secret.rose!;
  const next = g.queue.find((uid) => !g.players[uid].ready);
  if (next) {
    g.current = next;
    return;
  }
  if (g.crystal === 10) {
    const p = s.rosePrivate![g.coin];
    p.replacementTargets = g.order.filter(
      (uid) =>
        uid !== g.coin &&
        secret.contributions[uid] &&
        s.rosePrivate![uid].hand.length > 0,
    );
    g.phase = "REPLACE_TARGET";
    g.current = g.coin;
  } else resolveRound(s, shuffle);
}
export function applyRoseAction(
  s: Session,
  uid: string,
  a: RoseAction,
  shuffle: Shuffle,
): Session {
  const g = s.public.rose;
  ensure(
    g && s.public.status === "playing" && g.order.includes(uid),
    "目前無法操作",
  );
  normalizeRose(g);
  const secret = s.secret.rose!;
  secret.contributions ??= {};
  for (const p of Object.values(s.rosePrivate!)) normalizeRosePrivate(p);
  const own = s.rosePrivate![uid];
  const phase = (p: RoseGame["phase"]) =>
    ensure(g.phase === p, "目前階段無法執行此操作");
  const current = () => ensure(g.current === uid, "現在不是你的回合");
  const eligible = () =>
    g.order.filter((id) => s.rosePrivate![id].hand.length > 0);
  switch (a.type) {
    case "roseNight": {
      phase("NIGHT");
      ensure(!own.acknowledged, "你已確認夜晚情報");
      own.acknowledged = true;
      // Exchange privately as part of the common acknowledgement action. Public
      // state never identifies who exchanged, including through hand counts.
      if (own.identity === "DOUBLE_BLADE") {
        const ghost = own.hand.find((c) => c.type === "GHOST");
        ensure(ghost && secret.spareBlade, "換牌資料不完整");
        ghost.type = "DOUBLE_BLADE";
        secret.spareBlade = false;
        secret.ghostReserve++;
      }
      if (g.order.every((id) => s.rosePrivate![id].acknowledged)) {
        g.phase = "COIN";
        g.current = g.coin;
      }
      break;
    }
    case "roseCoin": {
      phase("COIN");
      current();
      ensure(
        g.order.includes(a.target) &&
          a.target !== uid &&
          !g.players[a.target].crystalUsed,
        "請選擇另一位尚未使用白水晶的玩家",
      );
      g.coin = a.target;
      g.current = a.target;
      g.phase = "CRYSTAL";
      g.round++;
      break;
    }
    case "roseCrystal": {
      phase("CRYSTAL");
      current();
      ensure(!g.players[uid].crystalUsed, "白水晶已使用");
      const skill = own.crystal;
      g.crystal = skill;
      g.players[uid].crystalUsed = true;
      g.targets = [];
      secret.contributions = {};
      delete secret.linked;
      for (const id of g.order) {
        g.players[id].ready = false;
        s.rosePrivate![id].constraint = {};
        delete s.rosePrivate![id].decision;
      }
      const index = g.order.indexOf(uid);
      g.queue = [...g.order.slice(index), ...g.order.slice(0, index)];
      const left = g.order[(index + g.order.length - 1) % g.order.length],
        right = g.order[(index + 1) % g.order.length];
      startDecisions(s);
      if (
        [1, 5, 7, 11, 12].includes(skill) &&
        (skill === 7
          ? secret.ghostReserve > 0
          : eligible().length >= (skill === 5 ? 2 : 1))
      ) {
        g.phase = "TARGET";
        g.current = uid;
      }
      if (skill === 3 || skill === 4) {
        const p = s.rosePrivate![skill === 3 ? right : left];
        if (p.hand.length)
          p.constraint.lockedCardId = shuffle([...p.hand])[0].id;
      }
      if (skill === 6) {
        g.queue.push(g.queue.shift()!);
        g.current = g.queue[0];
      }
      if (skill === 8)
        for (const id of [left, right])
          if (s.rosePrivate![id].hand.length)
            s.rosePrivate![id].constraint.mustPlay = true;
      if (skill === 9)
        for (const p of Object.values(s.rosePrivate!))
          if (p.identity === "DARK_BLADE")
            p.knownRoles = Object.fromEntries(
              g.order
                .filter((id) =>
                  ["WHITE_ROSE", "BISHOP"].includes(
                    s.rosePrivate![id].identity,
                  ),
                )
                .map((id) => [id, s.rosePrivate![id].identity]),
            );
      break;
    }
    case "roseTarget": {
      phase("TARGET");
      current();
      const skill = g.crystal!;
      ensure(
        Array.isArray(a.targets) &&
          a.targets.length === (skill === 5 ? 2 : 1) &&
          new Set(a.targets).size === a.targets.length,
        "請選擇正確數量的不同玩家",
      );
      ensure(
        a.targets.every(
          (id) =>
            g.order.includes(id) &&
            (skill === 7 ? id !== uid : eligible().includes(id)),
        ),
        "目前無法指定這位玩家",
      );
      const target = a.targets[0],
        p = s.rosePrivate![target];
      g.targets = [...a.targets];
      if (skill === 1 || skill === 12) p.constraint.mustPlay = true;
      if (skill === 5) {
        const b = a.targets[1];
        secret.linked = { a: target, b };
        if (g.queue.indexOf(b) < g.queue.indexOf(target)) {
          g.queue = g.queue.filter((id) => id !== b);
          g.queue.splice(g.queue.indexOf(target) + 1, 0, b);
        }
      }
      if (skill === 7 && secret.ghostReserve > 0) {
        p.hand.push({ id: `${g.id}-reserve-ghost`, type: "GHOST" });
        secret.ghostReserve--;
        g.players[target].handCount = p.hand.length;
      }
      startDecisions(s);
      if (skill === 11) {
        own.peek = { target, type: shuffle([...p.hand])[0].type };
        g.phase = "PEEK";
        g.current = uid;
      }
      break;
    }
    case "rosePeek":
      phase("PEEK");
      current();
      delete own.peek;
      startDecisions(s);
      break;
    case "roseDecide": {
      phase("DECISIONS");
      current();
      ensure(!g.players[uid].ready, "本輪已經決定");
      ensure(
        a.cardId === undefined || typeof a.cardId === "string",
        "無效的手牌",
      );
      ensure(
        canSubmitRose(own, a.cardId),
        "此牌不在你的手中，或不符合白水晶限制",
      );
      if (a.cardId) {
        const i = own.hand.findIndex((c) => c.id === a.cardId);
        const card = own.hand.splice(i, 1)[0];
        secret.contributions[uid] = card;
        own.decision = card;
      } else own.decision = "PASS";
      // Freeze public hand counts until collective reveal: a decrement would
      // reveal PLAY/PASS despite the anonymous ready indicator.
      g.players[uid].ready = true;
      if (secret.linked?.a === uid)
        s.rosePrivate![secret.linked.b].constraint = a.cardId
          ? { mustPlay: true }
          : { mustPass: true };
      completeDecisions(s, shuffle);
      break;
    }
    case "roseReplaceTarget": {
      phase("REPLACE_TARGET");
      current();
      if (a.target === undefined) resolveRound(s, shuffle);
      else {
        ensure(
          own.replacementTargets.includes(a.target),
          "此玩家沒有可替換的牌",
        );
        g.targets = [a.target];
        g.current = a.target;
        g.phase = "REPLACE_CARD";
        own.replacementTargets = [];
      }
      break;
    }
    case "roseReplaceCard": {
      phase("REPLACE_CARD");
      current();
      const i = own.hand.findIndex((c) => c.id === a.cardId);
      ensure(i >= 0 && secret.contributions[uid], "請選擇另一張手牌");
      const replacement = own.hand.splice(i, 1)[0];
      own.hand.push(secret.contributions[uid]);
      secret.contributions[uid] = replacement;
      resolveRound(s, shuffle);
      break;
    }
    case "roseContinue":
      phase("ROUND_RESULT");
      current();
      g.phase = "COIN";
      g.targets = [];
      delete g.crystal;
      break;
    default:
      throw new Error("未知遊戲操作");
  }
  g.revision++;
  for (const p of Object.values(s.rosePrivate!)) p.revision = g.revision;
  return s;
}
