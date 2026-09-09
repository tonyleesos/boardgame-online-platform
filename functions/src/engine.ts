import type { GameAction, PrivateRole, Role, Session } from "./shared/model";
import {
  calculateMissionResult,
  calculateTeamVote,
  ensure,
  getMissionTeamSize,
  rolesFor,
  sideOf,
} from "./shared/rules";

// Randomness is injected once before the transaction; retries reuse the same assignment.
export function startGame(
  session: Session,
  id: string,
  shuffle: <T>(items: T[]) => T[],
) {
  const room = session.public;
  const order = shuffle(Object.keys(room.players));
  const roles = shuffle(rolesFor(order.length));
  ensure(room.status === "waiting", "遊戲已開始");
  ensure(
    order.every((uid) => room.players[uid].ready),
    "請等待所有玩家準備",
  );
  const assignments = Object.fromEntries(
    order.map((uid, i) => [uid, roles[i]]),
  ) as Record<string, Role>;
  session.private = Object.fromEntries(
    order.map((uid) => {
      const role = assignments[uid];
      const side = sideOf(role);
      const knowledgeType =
        role === "percival"
          ? "candidates"
          : role === "merlin" || side === "evil"
            ? "evil"
            : "none";
      const knowledge = order.filter(
        (other) =>
          other !== uid &&
          (knowledgeType === "candidates"
            ? ["merlin", "morgana"].includes(assignments[other])
            : knowledgeType === "evil" &&
              sideOf(assignments[other]) === "evil"),
      );
      return [
        uid,
        { role, side, knowledge, knowledgeType } satisfies PrivateRole,
      ];
    }),
  );
  session.secret = { teamVotes: {}, missionVotes: {} };
  room.status = "playing";
  room.game = {
    id,
    revision: 0,
    phase: "ROLE_REVEAL",
    round: 1,
    leaderId: order[0],
    order,
    selectedPlayerIds: [],
    proposalAttempt: 1,
    missionResults: [],
    submitted: {},
    revealed: {},
  };
}
export function finish(
  session: Session,
  winner: "good" | "evil" | undefined,
  reason: string,
) {
  const game = session.public.game!;
  game.phase = "GAME_OVER";
  if (winner) game.winner = winner;
  game.winReason = reason;
  game.roles = Object.fromEntries(
    Object.entries(session.private).map(([uid, p]) => [uid, p.role]),
  );
  session.public.status = "finished";
  session.secret = { teamVotes: {}, missionVotes: {} };
}
export function applyGameAction(
  session: Session,
  uid: string,
  action: GameAction,
) {
  const game = session.public.game;
  ensure(game && session.public.status === "playing", "遊戲尚未開始或已結束");
  ensure(game.order.includes(uid), "你不在這場遊戲中");
  game.selectedPlayerIds ??= [];
  game.missionResults ??= [];
  game.submitted ??= {};
  game.revealed ??= {};
  session.secret ??= { teamVotes: {}, missionVotes: {} };
  session.secret.teamVotes ??= {};
  session.secret.missionVotes ??= {};
  const phase = (value: string) =>
    ensure(game.phase === value, "遊戲階段已變更，請稍後再試");
  const leader = () => ensure(game.leaderId === uid, "只有隊長可以執行");
  const rotate = () => {
    game.leaderId =
      game.order[(game.order.indexOf(game.leaderId) + 1) % game.order.length];
  };
  switch (action.type) {
    case "reveal":
      phase("ROLE_REVEAL");
      ensure(!game.revealed[uid], "已確認身份");
      game.revealed[uid] = true;
      if (game.order.every((id) => game.revealed[id]))
        game.phase = "TEAM_SELECTION";
      break;
    case "select":
      phase("TEAM_SELECTION");
      leader();
      ensure(
        Array.isArray(action.players) &&
          new Set(action.players).size === action.players.length &&
          action.players.every((id) => game.order.includes(id)),
        "無效的任務成員",
      );
      ensure(
        action.players.length <=
          getMissionTeamSize(game.order.length, game.round),
        "超過任務人數",
      );
      game.selectedPlayerIds = action.players;
      break;
    case "propose":
      phase("TEAM_SELECTION");
      leader();
      ensure(
        game.selectedPlayerIds.length ===
          getMissionTeamSize(game.order.length, game.round),
        "任務人數不正確",
      );
      game.phase = "TEAM_VOTE";
      game.submitted = {};
      session.secret.teamVotes = {};
      break;
    case "teamVote": {
      phase("TEAM_VOTE");
      ensure(["approve", "reject"].includes(action.vote), "無效的投票");
      ensure(!game.submitted[uid], "已提交投票");
      session.secret.teamVotes[uid] = action.vote;
      game.submitted[uid] = true;
      if (game.order.every((id) => game.submitted[id])) {
        const approved = calculateTeamVote(
          Object.values(session.secret.teamVotes),
        );
        game.lastTeamVote = {
          votes: { ...session.secret.teamVotes },
          approved,
          team: [...game.selectedPlayerIds],
        };
        game.submitted = {};
        session.secret.teamVotes = {};
        if (approved) {
          game.phase = "MISSION_VOTE";
          session.secret.missionVotes = {};
        } else if (game.proposalAttempt === 5)
          finish(session, "evil", "連續五次組隊遭到否決");
        else {
          game.proposalAttempt++;
          rotate();
          game.selectedPlayerIds = [];
          game.phase = "TEAM_SELECTION";
        }
      }
      break;
    }
    case "missionVote": {
      phase("MISSION_VOTE");
      ensure(game.selectedPlayerIds.includes(uid), "只有任務成員可以投票");
      ensure(["success", "fail"].includes(action.vote), "無效的任務票");
      ensure(!game.submitted[uid], "已提交任務票");
      ensure(
        action.vote === "success" || session.private[uid].side === "evil",
        "正義陣營只能選擇成功",
      );
      session.secret.missionVotes[uid] = action.vote;
      game.submitted[uid] = true;
      if (game.selectedPlayerIds.every((id) => game.submitted[id])) {
        const votes = Object.values(session.secret.missionVotes);
        game.missionResults.push({
          result: calculateMissionResult(votes, game.order.length, game.round),
          fails: votes.filter((v) => v === "fail").length,
          team: [...game.selectedPlayerIds],
        });
        session.secret.missionVotes = {};
        game.submitted = {};
        game.phase = "MISSION_RESULT";
        game.proposalAttempt = 1;
      }
      break;
    }
    case "continue":
      phase("MISSION_RESULT");
      leader();
      if (game.missionResults.filter((m) => m.result === "fail").length >= 3)
        finish(session, "evil", "三次任務失敗");
      else if (
        game.missionResults.filter((m) => m.result === "success").length >= 3
      )
        game.phase = "ASSASSINATION";
      else {
        rotate();
        game.round++;
        game.selectedPlayerIds = [];
        game.phase = "TEAM_SELECTION";
      }
      break;
    case "assassinate":
      phase("ASSASSINATION");
      ensure(session.private[uid].role === "assassin", "只有刺客可以刺殺");
      ensure(
        game.order.includes(action.target) &&
          session.private[action.target].side === "good",
        "請選擇正義陣營玩家",
      );
      finish(
        session,
        session.private[action.target].role === "merlin" ? "evil" : "good",
        session.private[action.target].role === "merlin"
          ? "刺客成功找到梅林"
          : "三次任務成功，梅林存活",
      );
      break;
    default:
      throw new Error("未知遊戲操作");
  }
  game.revision++;
  return session;
}
