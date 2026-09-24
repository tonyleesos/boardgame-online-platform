import type { Session } from "../shared/model";
import {
  policeChiefSucceeded,
  terminalSnapshot,
} from "./expansions/policeChief";
import { ensure } from "../shared/rules";
import type { Shuffle } from "../timebomb-engine";
import {
  BASE_DANCE_COUNTS,
  DANCE_CARDS,
  DANCE_CARD_BY_ID,
  DANCE_DEFINITIONS,
  canPlayDanceCard,
  danceTargets,
  defaultDanceConfig,
  normalizeDance,
  normalizeDancePrivate,
} from "../shared/criminalDance";
import type {
  DanceAction,
  DanceCardType,
  DanceConfig,
  DanceEnd,
  DanceEvent,
  DanceGame,
  DancePrivate,
  DanceTerminalSnapshot,
} from "../shared/criminalDance";
export function validateDanceConfig(value: unknown): DanceConfig {
  ensure(value && typeof value === "object", "設定不完整");
  const c = value as DanceConfig;
  ensure(
    (c.targetScore === 5 || c.targetScore === 10) &&
      typeof c.boy === "boolean" &&
      (c.policeChiefEnabled === undefined ||
        typeof c.policeChiefEnabled === "boolean"),
    "請選擇 5／10 分與少年設定",
  );
  return {
    targetScore: c.targetScore,
    boy: c.boy,
    policeChiefEnabled: c.policeChiefEnabled ?? false,
  };
}
export function requiredDanceCards(
  count: number,
): Partial<Record<DanceCardType, number>> {
  ensure(Number.isInteger(count) && count >= 3 && count <= 8, "需要 3–8 人");
  return {
    FIRST_DISCOVERER: 1,
    CRIMINAL: 1,
    DETECTIVE: count >= 6 ? 2 : 1,
    ALIBI: count >= 7 ? 3 : count >= 5 ? 2 : 1,
    ...(count >= 4 ? { ACCOMPLICE: count >= 6 ? 2 : 1 } : {}),
  };
}
export function buildRoundDeck(
  count: number,
  shuffle: Shuffle,
  boy = false,
  policeChief = false,
) {
  const required = requiredDanceCards(count);
  const pool = DANCE_CARDS.filter((c) =>
    Object.hasOwn(BASE_DANCE_COUNTS, c.type),
  ).map((c) => c.id);
  if (boy) pool[pool.indexOf("WITNESS-0")] = "BOY-0";
  if (policeChief) pool[pool.indexOf("DOG-0")] = "POLICE_CHIEF-0";
  const mandatory = Object.entries(required).flatMap(([type, n]) =>
    Array.from({ length: n! }, (_, i) => `${type}-${i}`),
  );
  const rest = shuffle(pool.filter((id) => !mandatory.includes(id))),
    chosen = [...mandatory, ...rest.slice(0, count * 4 - mandatory.length)];
  return {
    cards: shuffle(chosen),
    excluded: rest.slice(count * 4 - mandatory.length),
  };
}
export function findCriminalHolder(
  privatePlayers: Record<string, DancePrivate>,
) {
  return Object.keys(privatePlayers).find((id) =>
    privatePlayers[id].hand.includes("CRIMINAL-0"),
  );
}
function parts(s: Session) {
  ensure(s.public.dance && s.dancePrivate, "遊戲尚未開始");
  // All 32 cards are dealt with eight players. RTDB then omits the empty
  // excluded array and its entire empty secret branch.
  s.secret ??= { teamVotes: {}, missionVotes: {} };
  s.secret.dance ??= { excluded: [] };
  const g = normalizeDance(s.public.dance),
    p = s.dancePrivate,
    secret = s.secret.dance;
  for (const own of Object.values(p)) normalizeDancePrivate(own);
  secret.excluded ??= [];
  return { g, p, secret };
}
function sync(s: Session) {
  const { g, p } = parts(s);
  delete g.policeChiefHolderUid;
  if (g.config.policeChiefEnabled) {
    const holder = g.order.find((id) => p[id].hand.includes("POLICE_CHIEF-0"));
    if (holder) g.policeChiefHolderUid = holder;
  }
  for (const id of g.order) {
    g.players[id].handCount = p[id].hand.length;
    p[id].revision = g.revision;
  }
}
function setupRound(s: Session, shuffle: Shuffle) {
  const g = s.public.dance!,
    { cards, excluded } = buildRoundDeck(
      g.order.length,
      shuffle,
      g.config.boy,
      g.config.policeChiefEnabled,
    );
  s.secret ??= { teamVotes: {}, missionVotes: {} };
  s.secret.dance = { excluded };
  s.dancePrivate = {};
  g.roundId = `${g.id}:${g.round}`;
  g.phase = "PLAYER_TURN";
  g.firstPlay = true;
  g.played = [];
  delete g.pending;
  delete g.result;
  delete g.notice;
  delete g.policeChiefHolderUid;
  delete g.policeChiefOwnerUid;
  delete g.policeChiefTargetUid;
  for (const uid of g.order) {
    s.dancePrivate[uid] = {
      gameId: g.id,
      roundId: g.roundId,
      revision: g.revision,
      hand: cards.splice(0, 4),
    };
    g.players[uid].accomplice = false;
  }
  g.current = g.order.find((uid) =>
    s.dancePrivate![uid].hand.includes("FIRST_DISCOVERER-0"),
  )!;
  const criminal = findCriminalHolder(s.dancePrivate)!;
  for (const own of Object.values(s.dancePrivate))
    if (own.hand.includes("BOY-0")) own.boyInitial = criminal;
  sync(s);
}
export function startDance(s: Session, id: string, shuffle: Shuffle) {
  const room = s.public,
    order = Object.values(room.players)
      .sort((a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid))
      .map((p) => p.uid);
  ensure(
    room.status === "waiting" && room.gameId === "criminal-dance",
    "無法開始此遊戲",
  );
  requiredDanceCards(order.length);
  ensure(
    order.every((uid) => room.players[uid].ready),
    "請等待所有玩家準備",
  );
  const config = validateDanceConfig(
    room.danceConfig ?? defaultDanceConfig(order.length),
  );
  room.dance = {
    id,
    revision: 0,
    round: 1,
    roundId: `${id}:1`,
    phase: "PLAYER_TURN",
    order,
    current: order[0],
    firstPlay: true,
    config,
    played: [],
    events: [],
    players: Object.fromEntries(
      order.map((uid) => [
        uid,
        {
          uid,
          nickname: room.players[uid].nickname,
          handCount: 4,
          score: 0,
          accomplice: false,
        },
      ]),
    ),
  };
  room.status = "playing";
  setupRound(s, shuffle);
}
export function calculateDanceScores(
  g: DanceGame,
  reason: DanceEnd,
  actor: string,
  criminal: string,
) {
  return Object.fromEntries(
    g.order.map((id) => [
      id,
      reason === "NO_PLAYABLE_CARDS"
        ? 0
        : reason === "CRIMINAL_ESCAPED"
          ? id === criminal || g.players[id].accomplice
            ? 2
            : 0
          : id === criminal || g.players[id].accomplice
            ? 0
            : id === actor
              ? reason === "DOG_CAUGHT"
                ? 3
                : 2
              : 1,
    ]),
  );
}
function finish(
  s: Session,
  reason: DanceEnd,
  actor: string,
  criminal: string,
  terminal?: DanceTerminalSnapshot,
) {
  const { g, p, secret } = parts(s);
  secret.terminal = terminal ?? terminalSnapshot(p, reason, actor, criminal);
  const police = policeChiefSucceeded(g, secret.terminal);
  if (police) actor = g.policeChiefOwnerUid!;
  const awards = calculateDanceScores(
    g,
    police ? "DOG_CAUGHT" : reason,
    actor,
    secret.terminal.finalCriminalUid,
  );
  for (const id of g.order) g.players[id].score += awards[id];
  g.result = {
    reason,
    actor,
    criminal,
    awards,
    criminalSide: g.order.filter(
      (id) => id === criminal || g.players[id].accomplice,
    ),
    resolution: police
      ? "POLICE_CHIEF"
      : reason === "CRIMINAL_ESCAPED"
        ? "CRIMINAL"
        : reason === "DOG_CAUGHT"
          ? "DOG"
          : reason === "DETECTIVE_CAUGHT"
            ? "DETECTIVE"
            : "NONE",
  };
  delete g.pending;
  delete secret.snapshot;
  delete secret.selections;
  for (const own of Object.values(p)) {
    delete own.selection;
    delete own.witness;
  }
  const highest = Math.max(...g.order.map((id) => g.players[id].score));
  if (highest >= g.config.targetScore) {
    g.phase = "MATCH_END";
    g.winners = g.order.filter((id) => g.players[id].score === highest);
    s.public.status = "finished";
  } else g.phase = "ROUND_END";
}
function advance(s: Session) {
  const { g, p, secret } = parts(s),
    i = g.order.indexOf(g.current);
  const next = [...g.order.slice(i + 1), ...g.order.slice(0, i + 1)].find(
    (id) => p[id].hand.length,
  );
  delete g.pending;
  delete g.notice;
  delete secret.snapshot;
  delete secret.selections;
  for (const own of Object.values(p)) {
    delete own.selection;
    delete own.witness;
  }
  if (!next) {
    finish(s, "NO_PLAYABLE_CARDS", g.current, "");
    return;
  }
  g.current = next;
  g.phase = "PLAYER_TURN";
}
function receipt(s: Session, text: string) {
  const { g } = parts(s);
  g.notice = text;
  g.phase = "EFFECT_RESULT";
}
function clearClues(s: Session) {
  for (const own of Object.values(parts(s).p)) delete own.botClue;
}
function collect(
  s: Session,
  type: "TRADE" | "INFORMATION_EXCHANGE",
  eligible: string[],
  target?: string,
) {
  const { g, p, secret } = parts(s);
  g.pending = {
    actor: g.current,
    type,
    eligible,
    locked: [],
    ...(target ? { target } : {}),
  };
  secret.snapshot = Object.fromEntries(
    eligible.map((id) => [id, [...p[id].hand]]),
  );
  secret.selections = {};
  g.phase = type === "TRADE" ? "TRADE_SELECTION" : "EXCHANGE_SELECTION";
}
/** Choices come exclusively from a single pre-effect snapshot; no received card can move twice. */
function transfer(
  s: Session,
  moves: Array<{ from: string; to: string; cardId: string }>,
) {
  const { p } = parts(s);
  for (const m of moves) {
    ensure(p[m.from].hand.includes(m.cardId), "原手牌已改變");
    p[m.from].hand = p[m.from].hand.filter((id) => id !== m.cardId);
  }
  for (const m of moves) p[m.to].hand.push(m.cardId);
  clearClues(s);
}
export function applyDanceAction(
  original: Session,
  uid: string,
  a: DanceAction,
  shuffle: Shuffle,
): Session {
  const s = structuredClone(original),
    { g, p, secret } = parts(s);
  ensure(
    s.public.status === "playing" &&
      s.public.gameId === "criminal-dance" &&
      g.order.includes(uid),
    "你不在進行中的對局",
  );
  ensure(a && typeof a.type === "string", "缺少操作");
  const event: DanceEvent = {
    revision: g.revision + 1,
    actor: uid,
    kind: a.type,
    text: "",
  };
  if (a.type === "danceNext") {
    ensure(
      g.phase === "ROUND_END" && s.public.hostId === uid,
      "只有房主能開始下一輪",
    );
    g.round++;
    g.revision++;
    setupRound(s, shuffle);
    event.text = `第 ${g.round} 輪開始，重新發牌`;
  } else {
    if (a.type === "danceSelect") {
      ensure(
        (g.phase === "TRADE_SELECTION" || g.phase === "EXCHANGE_SELECTION") &&
          g.pending?.eligible.includes(uid),
        "你不需要選牌",
      );
      ensure(g.pending, "缺少交換狀態");
      ensure(!g.pending.locked.includes(uid), "已鎖定選擇，請等待其他玩家");
      ensure(
        typeof a.cardId === "string" &&
          secret.snapshot?.[uid]?.includes(a.cardId) &&
          p[uid].hand.includes(a.cardId),
        "只能選擇本次效果開始前的手牌",
      );
      secret.selections ??= {};
      secret.selections[uid] = a.cardId;
      p[uid].selection = a.cardId;
      g.pending.locked.push(uid);
      event.kind = "LOCK";
      event.text = "已秘密選好一張牌";
      if (g.pending.eligible.every((id) => g.pending!.locked.includes(id))) {
        const pending = g.pending;
        const moves = pending.eligible.map((from) => ({
          from,
          to:
            pending.type === "TRADE"
              ? from === pending.actor
                ? pending.target!
                : pending.actor
              : g.order[(g.order.indexOf(from) + 1) % g.order.length],
          cardId: secret.selections![from],
        }));
        transfer(s, moves);
        for (const own of Object.values(p)) delete own.selection;
        delete secret.selections;
        delete secret.snapshot;
        delete g.pending;
        event.kind = "TRANSFER";
        event.transfers = moves.map(({ from, to }) => ({ from, to }));
        event.text =
          pending.type === "TRADE"
            ? "雙方已同時交換手牌"
            : "所有人已同時把牌交給左側下一位";
        receipt(s, event.text);
      }
    } else {
      ensure(g.current === uid, "目前不是你的回合");
      if (a.type === "danceAcknowledge") {
        ensure(
          g.phase === "WITNESS_REVEAL" || g.phase === "EFFECT_RESULT",
          "目前沒有等待確認的結果",
        );
        if (
          g.phase === "WITNESS_REVEAL" &&
          s.public.players[uid].isBot &&
          p[uid].witness?.cards.includes("CRIMINAL-0")
        )
          p[uid].botClue = p[uid].witness!.target;
        event.kind = "ACK";
        event.text =
          g.phase === "WITNESS_REVEAL"
            ? "已關閉私人情報"
            : "確認結果，繼續下一位";
        advance(s);
      } else if (a.type === "danceTarget") {
        ensure(g.phase === "SELECT_TARGET" && g.pending, "目前不需要選擇目標");
        const type = g.pending.type;
        ensure(danceTargets(g, uid, type).includes(a.target), "請選合法玩家");
        event.target = a.target;
        event.kind = type;
        if (type === "POLICE_CHIEF") {
          g.policeChiefOwnerUid = uid;
          g.policeChiefTargetUid = a.target;
          const placed = g.played.find((c) => c.cardId === "POLICE_CHIEF-0");
          if (placed) placed.uid = a.target;
          event.cardId = "POLICE_CHIEF-0";
          event.text = `警部鎖定 ${g.players[a.target].nickname}，回合結束時才判定`;
          receipt(s, event.text);
        } else if (type === "DETECTIVE") {
          const caught =
            p[a.target].hand.includes("CRIMINAL-0") &&
            !p[a.target].hand.some(
              (id) => DANCE_CARD_BY_ID[id].type === "ALIBI",
            );
          event.text = caught ? "偵探找到犯人！" : "不是犯人。";
          if (caught) finish(s, "DETECTIVE_CAUGHT", uid, a.target);
          else receipt(s, event.text);
        } else if (type === "WITNESS") {
          p[uid].witness = { target: a.target, cards: [...p[a.target].hand] };
          g.phase = "WITNESS_REVEAL";
          g.pending.target = a.target;
          event.text = `私下查看 ${g.players[a.target].nickname} 的手牌`;
        } else if (type === "DOG") {
          const random = shuffle(p[a.target].hand)[0];
          const terminal =
            random === "CRIMINAL-0"
              ? terminalSnapshot(p, "DOG_CAUGHT", uid, a.target)
              : undefined;
          p[a.target].hand = p[a.target].hand.filter((id) => id !== random);
          g.played.push({ uid: a.target, cardId: random });
          event.cardId = random;
          if (random === "CRIMINAL-0") {
            event.text = "神犬找到犯人！";
            finish(s, "DOG_CAUGHT", uid, a.target, terminal);
          } else {
            g.played = g.played.filter((c) => c.cardId !== "DOG-0");
            p[a.target].hand.push("DOG-0");
            event.text = `神犬翻出「${DANCE_DEFINITIONS[DANCE_CARD_BY_ID[random].type].name}」，接著交給 ${g.players[a.target].nickname}`;
            receipt(s, event.text);
          }
          clearClues(s);
        } else if (type === "TRADE") {
          collect(s, "TRADE", [uid, a.target], a.target);
          event.text = `與 ${g.players[a.target].nickname} 開始秘密交易`;
        } else ensure(false, "無效的指認效果");
      } else if (a.type === "dancePlay") {
        const error = canPlayDanceCard(g, p[uid], uid, a.cardId);
        ensure(!error, error ?? "無法出牌");
        const card = DANCE_CARD_BY_ID[a.cardId],
          before = p[uid].hand.length;
        const terminal =
          card.type === "CRIMINAL"
            ? terminalSnapshot(p, "CRIMINAL_ESCAPED", uid, uid)
            : undefined;
        p[uid].hand = p[uid].hand.filter((id) => id !== a.cardId);
        g.played.push({ uid, cardId: a.cardId });
        g.firstPlay = false;
        event.kind = "PLAY";
        event.cardId = a.cardId;
        event.text = `打出「${DANCE_DEFINITIONS[card.type].name}」`;
        sync(s);
        if (card.type === "CRIMINAL") {
          event.kind = "ESCAPE";
          event.text = "犯人成功逃脫！";
          finish(s, "CRIMINAL_ESCAPED", uid, uid, terminal);
        } else if (card.type === "ACCOMPLICE") {
          g.players[uid].accomplice = true;
          event.text = "亮出共犯，本輪加入犯人陣營";
          advance(s);
        } else if (card.type === "INFORMATION_EXCHANGE") {
          const eligible = g.order.filter((id) => p[id].hand.length);
          if (eligible.length) collect(s, card.type, eligible);
          else advance(s);
        } else if (card.type === "RUMOR") {
          const moves = g.order
            .filter((id) => p[id].hand.length)
            .map((from) => ({
              from,
              to: g.order[(g.order.indexOf(from) + 1) % g.order.length],
              cardId: shuffle(p[from].hand)[0],
            }));
          transfer(s, moves);
          event.kind = "TRANSFER";
          event.transfers = moves.map(({ from, to }) => ({ from, to }));
          event.text = "謠言四起，每人同時取得右側上一位的一張牌";
          receipt(s, event.text);
        } else if (
          (card.type === "DETECTIVE" && before <= 3) ||
          card.type === "WITNESS" ||
          card.type === "DOG" ||
          card.type === "POLICE_CHIEF" ||
          card.type === "TRADE"
        ) {
          if (
            (card.type === "TRADE" && !p[uid].hand.length) ||
            !danceTargets(g, uid, card.type).length
          ) {
            event.text += "，沒有可執行的目標";
            receipt(s, event.text);
          } else {
            g.pending = {
              actor: uid,
              type: card.type,
              eligible: [],
              locked: [],
            };
            g.phase = "SELECT_TARGET";
          }
        } else {
          if (card.type === "DETECTIVE")
            event.text += "，出牌前有 4 張以上，指認不生效";
          advance(s);
        }
      } else ensure(false, "未知操作");
    }
    g.revision++;
  }
  if (
    g.result?.resolution === "POLICE_CHIEF" &&
    (g.phase === "ROUND_END" || g.phase === "MATCH_END")
  ) {
    event.kind = "POLICE_CHIEF_CAUGHT";
    event.actor = g.result.actor;
    event.target = g.result.criminal;
    event.cardId = "POLICE_CHIEF-0";
    event.text = "警部在終局成功攔截犯人！";
  }
  g.events = [...g.events, event].slice(-60);
  sync(s);
  return s;
}
