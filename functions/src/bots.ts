import { chooseMafiaAction } from "./mafia/bot";
import { applyMafiaAction } from "./mafia/engine";
import type { MafiaAction } from "./shared/mafia";
import type {
  Game,
  GameAction,
  PrivateRole,
  Room,
  Session,
} from "./shared/model";
import type { BombAction, BombGame, BombPrivate } from "./shared/timebomb";
import {
  bombThreshold,
  defusableColors,
  rearmableColors,
} from "./shared/timebomb";
import { getMissionTeamSize } from "./shared/rules";
import { applyGameAction } from "./engine";
import { applyBombAction, normalizeBomb } from "./timebomb-engine";
import type { Shuffle } from "./timebomb-engine";
import { chooseSplendorAction } from "./splendor/bot";
import { applySplendorAction } from "./splendor/engine";
import { normalizeSplendor } from "./shared/splendor";
import type { SplendorAction } from "./shared/splendor";
import { chooseMineAction } from "./saboteur/bot";
import { chooseDanceAction } from "./criminalDance/bot";
import { applyDanceAction } from "./criminalDance/engine";
import {
  danceToken,
  normalizeDance,
  normalizeDancePrivate,
  type DanceAction,
} from "./shared/criminalDance";
import { applyMineAction } from "./saboteur/engine";
import {
  mineToken,
  normalizeMine,
  normalizeMinePrivate,
  type MineAction,
} from "./shared/saboteur";

// Policies receive only public game state and this bot's private observation.
// No Session, complete role map, ordered cards, or secret ballots enter a policy.
export function chooseAvalonAction(
  uid: string,
  g: Game,
  own: PrivateRole,
  shuffle: Shuffle,
  casual = false,
): GameAction | null {
  const submitted = g.submitted ?? {},
    revealed = g.revealed ?? {};
  const suspicion = (id: string) => {
    if (id === uid) return -4;
    if (own.knowledgeType === "evil" && own.knowledge.includes(id)) return 8;
    return (g.missionResults ?? []).reduce(
      (score, m) =>
        score +
        (m.team.includes(id)
          ? m.result === "fail"
            ? (2 * m.fails) / m.team.length
            : -0.3
          : 0),
      0,
    );
  };
  const ranked = shuffle([...g.order]).sort((a, b) =>
    casual ? 0 : suspicion(a) - suspicion(b),
  );
  switch (g.phase) {
    case "ROLE_REVEAL":
      return revealed[uid] ? null : { type: "reveal" };
    case "TEAM_SELECTION": {
      if (g.leaderId !== uid) return null;
      const n = getMissionTeamSize(g.order.length, g.round);
      if (g.selectedPlayerIds?.length === n) return { type: "propose" };
      let team = ranked.slice(0, n);
      if (own.side === "evil") {
        const evil = [uid, ...own.knowledge];
        team = [
          shuffle(evil)[0],
          ...ranked.filter((id) => !evil.includes(id)).slice(0, n - 1),
        ];
      }
      return { type: "select", players: team };
    }
    case "TEAM_VOTE": {
      if (submitted[uid]) return null;
      let approve: boolean;
      if (casual) approve = shuffle([true, true, false])[0];
      else if (own.side === "evil")
        approve = g.selectedPlayerIds.some(
          (id) => id === uid || own.knowledge.includes(id),
        );
      else
        approve =
          !g.selectedPlayerIds.some((id) => suspicion(id) >= 2) ||
          g.proposalAttempt === 5;
      return { type: "teamVote", vote: approve ? "approve" : "reject" };
    }
    case "MISSION_VOTE": {
      if (!g.selectedPlayerIds.includes(uid) || submitted[uid]) return null;
      if (own.side === "good") return { type: "missionVote", vote: "success" };
      // Evil players know their teammates, but never inspect their submitted ballots.
      const allied = g.selectedPlayerIds
        .filter((id) => id === uid || own.knowledge.includes(id))
        .sort();
      const needTwo = g.order.length >= 7 && g.round === 4;
      const sabotage = casual
        ? shuffle([true, false])[0]
        : needTwo || allied[0] === uid;
      return { type: "missionVote", vote: sabotage ? "fail" : "success" };
    }
    case "MISSION_RESULT":
      return g.leaderId === uid ? { type: "continue" } : null;
    case "ASSASSINATION": {
      if (own.role !== "assassin") return null;
      const candidates = shuffle(
        g.order.filter((id) => id !== uid && !own.knowledge.includes(id)),
      );
      // Public voting history is a weak clue; ties are intentionally uncertain.
      if (!casual && g.lastTeamVote)
        candidates.sort(
          (a, b) =>
            Number(g.lastTeamVote!.votes[a] === "reject") -
            Number(g.lastTeamVote!.votes[b] === "reject"),
        );
      return { type: "assassinate", target: candidates[0] };
    }
    default:
      return null;
  }
}
export function chooseBombAction(
  uid: string,
  g: BombGame,
  own: BombPrivate,
  shuffle: Shuffle,
  casual = false,
): BombAction | null {
  switch (g.phase) {
    case "ROLE_REVEAL":
      return g.confirmed?.[uid] ? null : { type: "bombReveal" };
    case "CLAIMS": {
      if (g.claims?.[uid] !== undefined) return null;
      const actual = own.inventory?.success ?? 0;
      // Moriarty may lure cutters with a plausible lie, based only on their own hand.
      const claimed =
        own.role === "sherlock"
          ? actual
          : Math.min(6 - g.round, Math.max(1, actual + shuffle([0, 1, 1])[0]));
      return { type: "claim", successes: claimed };
    }
    case "CUT": {
      if (g.scissorsId !== uid) return null;
      const targets = g.forcedTarget
        ? [g.forcedTarget]
        : g.order.filter((id) => id !== uid && g.hands[id]?.length);
      const ranked = shuffle(targets);
      const estimate = (id: string) => {
        const revealed = g.history.filter(
          (h) => h.round === g.round && h.target === id && h.wire === "success",
        ).length;
        return (
          Math.max(0, (g.claims?.[id] ?? 0) - revealed) /
          Math.max(1, g.hands[id]?.length ?? 0)
        );
      };
      if (!casual)
        ranked.sort((a, b) =>
          own.role === "sherlock"
            ? estimate(b) - estimate(a)
            : estimate(a) - estimate(b),
        );
      const target = ranked[0];
      if (!target || !g.hands[target]?.length) return null;
      // A slot is sampled uniformly. Its hidden value is never available here.
      return { type: "cut", target, slot: shuffle([...g.hands[target]])[0] };
    }
    case "DEFUSE":
    case "REARM": {
      if (g.effectActor !== uid) return null;
      const colors = shuffle(
        g.phase === "DEFUSE" ? defusableColors(g) : rearmableColors(g),
      );
      const protect = (own.role === "sherlock") === (g.phase === "DEFUSE");
      if (!casual)
        colors.sort((a, b) => {
          const risk = (c: typeof a) => (g.bombs[c] ?? 0) / bombThreshold(g, c);
          return protect ? risk(b) - risk(a) : risk(a) - risk(b);
        });
      return {
        type: g.phase === "DEFUSE" ? "defuse" : "rearm",
        color: colors[0],
      };
    }
    default:
      return null;
  }
}
function speech(
  a:
    | GameAction
    | BombAction
    | SplendorAction
    | MafiaAction
    | MineAction
    | DanceAction,
) {
  switch (a.type) {
    case "dancePlay":
      return "我已打出一張牌。";
    case "danceTarget":
      return "我已選好目標。";
    case "danceSelect":
      return "我已鎖定秘密選牌。";
    case "danceAcknowledge":
      return "我已確認結果。";
    case "minePath":
      return "礦道已放置，看看接下來能通往哪裡。";
    case "mineAction":
      return "我已打出行動牌。";
    case "mineClean":
      return "解除一個狀態，準備繼續挖礦。";
    case "minePass":
      return "交換手牌，準備下一步。";
    case "mineAcknowledge":
      return "我已記住這份情報。";
    case "mineSteal":
      return "拿走一枚金塊。";
    case "mafiaPrepare":
      return "雪茄盒準備好了，請依序傳遞。";
    case "mafiaTake":
      return "我已完成選擇，雪茄盒交給下一位。";
    case "mafiaAccuse":
      return "我想請這位朋友掏出口袋，確認我的猜測。";
    case "splendorTake":
      return `收集 ${a.colors.length} 種寶石，準備下一筆交易。`;
    case "splendorDouble":
      return "拿取兩枚同色寶石。";
    case "splendorBuy":
      return "完成交易，擴充我的珠寶收藏。";
    case "splendorReserve":
    case "splendorBlind":
      return "先保留一張卡，留給下一次交易。";
    case "splendorReturn":
      return "退回多餘代幣，保留下一步需要的寶石。";
    case "splendorNoble":
      return "邀請貴族來訪。";
    case "splendorStronghold":
      return a.cardId ? "調整市場上的要塞。" : "這次略過要塞操作。";
    case "splendorSkip":
      return "這次略過額外購買。";
    case "claim":
      return `我這輪有 ${a.successes} 張解除引線。`;
    case "select":
      return "我想先讓這幾位出任務，看看結果。";
    case "propose":
      return "這是我的提案，大家投票吧。";
    case "teamVote":
      return "我已做出選擇，等大家一起揭曉。";
    case "missionVote":
      return "我的任務票已提交。";
    case "cut":
      return "我會參考大家的宣言，試剪這條引線。";
    case "defuse":
      return "先替這種炸彈加上拆除保護。";
    case "rearm":
      return "藍色裝置改變了炸彈的保護狀態。";
    case "assassinate":
      return "我根據剛才的表決，做最後一次推測。";
    case "continue":
      return "繼續下一階段吧。";
    default:
      return "我已確認自己的身份。";
  }
}
export const botToken = (r: Room) =>
  r.dance
    ? danceToken(r.dance)
    : r.saboteur
      ? mineToken(r.saboteur)
      : r.game
        ? `${r.game.id}:${r.game.revision}`
        : r.mafia
          ? `${r.mafia.id}:${r.mafia.revision}`
          : r.timebomb
            ? `${r.timebomb.id}:${r.timebomb.revision}`
            : r.splendor
              ? `${r.splendor.id}:${r.splendor.revision}`
              : "";
export function advanceOneBot(s: Session, shuffle: Shuffle): boolean {
  if (s.public.status !== "playing") return false;
  const ids = Object.values(s.public.players)
    .filter((p) => p.isBot)
    .map((p) => p.uid);
  for (const uid of ids) {
    const casual = s.public.botLevel === "casual";
    let action:
      | GameAction
      | BombAction
      | SplendorAction
      | MafiaAction
      | MineAction
      | DanceAction
      | null = null;
    if (s.public.dance) {
      action = chooseDanceAction(
        uid,
        structuredClone(normalizeDance(s.public.dance)),
        structuredClone(normalizeDancePrivate(s.dancePrivate![uid])),
        shuffle,
        casual,
      );
      if (action) Object.assign(s, applyDanceAction(s, uid, action, shuffle));
    } else if (s.public.saboteur) {
      action = chooseMineAction(
        uid,
        structuredClone(normalizeMine(s.public.saboteur)),
        structuredClone(normalizeMinePrivate(s.saboteurPrivate![uid])),
        shuffle,
        casual,
      );
      if (action) Object.assign(s, applyMineAction(s, uid, action, shuffle));
    } else if (s.public.mafia) {
      action = chooseMafiaAction(
        uid,
        structuredClone(s.public.mafia),
        structuredClone(s.mafiaPrivate![uid]),
        shuffle,
        casual,
      );
      if (action) applyMafiaAction(s, uid, action);
      // A cleaner decision is private: no public activity, timestamp, revision
      // or moved response may reveal whether an AI cleaner was present.
      if (action?.type === "mafiaCleaner") return false;
    } else if (s.public.game) {
      action = chooseAvalonAction(
        uid,
        structuredClone(s.public.game),
        structuredClone(s.private[uid]),
        shuffle,
        casual,
      );
      if (action) applyGameAction(s, uid, action);
    } else if (s.public.timebomb) {
      action = chooseBombAction(
        uid,
        structuredClone(normalizeBomb(s)),
        structuredClone(s.timebombPrivate![uid]),
        shuffle,
        casual,
      );
      if (action) applyBombAction(s, uid, action, shuffle);
    } else if (s.public.splendor) {
      action = chooseSplendorAction(
        uid,
        structuredClone(normalizeSplendor(s.public.splendor)),
        structuredClone(s.splendorPrivate![uid]),
        shuffle,
        casual,
      );
      if (action) Object.assign(s, applySplendorAction(s, uid, action));
    }
    if (action) {
      s.public.activity = [
        ...(s.public.activity ?? []),
        {
          uid,
          message: speech(action),
          sequence:
            s.public.dance?.revision ??
            s.public.saboteur?.revision ??
            s.public.game?.revision ??
            s.public.timebomb?.revision ??
            s.public.mafia?.revision ??
            s.public.splendor!.revision,
        },
      ].slice(-20);
      return true;
    }
  }
  return false;
}
