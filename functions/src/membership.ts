import { finishMafia } from "./mafia/engine";
import type { Session } from "./shared/model";
import { ensure } from "./shared/rules";
import { finishDecorum } from "./decorum/engine";
import { botNickname } from "./bot-names";

/** Keep the seat ID stable so secret votes, knowledge and wire slots survive.
 * Callable handlers and database rules deny this former human ID once it is a bot.
 */
export function leaveSeat(session: Session, uid: string): Session | null {
  const room = session.public;
  const player = room.players[uid];
  ensure(player && !player.isBot, "你不在房間內");
  if (
    room.gameId === "blades-and-rose" &&
    room.status === "playing" &&
    room.rose
  ) {
    room.rose.phase = "GAME_OVER";
    room.rose.aborted = true;
    room.rose.reason = "玩家離席，本局結束";
    room.rose.revision++;
    room.status = "finished";
    if (session.secret.rose) session.secret.rose.contributions = {};
    for (const p of Object.values(session.rosePrivate ?? {})) {
      delete p.peek;
      delete p.decision;
      p.replacementTargets = [];
      p.revision = room.rose.revision;
    }
  }
  if (
    room.gameId === "criminal-dance" &&
    room.status === "playing" &&
    room.dance
  ) {
    room.dance.phase = "MATCH_END";
    room.dance.aborted = true;
    room.dance.winners = [];
    room.dance.revision++;
    room.status = "finished";
    delete room.dance.pending;
    if (session.secret?.dance) {
      delete session.secret.dance.snapshot;
      delete session.secret.dance.selections;
    }
    for (const own of Object.values(session.dancePrivate ?? {})) {
      own.revision = room.dance.revision;
      delete own.witness;
      delete own.selection;
    }
  }
  if (
    room.gameId === "saboteur-2" &&
    room.status === "playing" &&
    room.saboteur
  ) {
    room.saboteur.phase = "GAME_OVER";
    room.saboteur.aborted = true;
    room.saboteur.winners = [];
    room.saboteur.revision++;
    room.status = "finished";
  }
  if (
    room.gameId === "mafia-de-cuba" &&
    room.status === "playing" &&
    room.mafia
  ) {
    finishMafia(session, "ABORTED");
    room.mafia.revision++;
  }
  if (room.gameId === "decorum" && room.status === "playing")
    finishDecorum(session, "player-left");
  if (
    room.gameId === "splendor" &&
    room.status === "playing" &&
    room.splendor
  ) {
    room.splendor.aborted = true;
    room.splendor.phase = "GAME_OVER";
    room.splendor.winners = [];
    room.splendor.revision++;
    room.status = "finished";
  }
  if (room.status === "playing") {
    player.nickname = botNickname(room.players, `${room.code}:${uid}`);
    player.isBot = true;
    player.isProxy = true;
    player.ready = true;
    // Wake clients that have already found the previous bot token idle.
    const game = room.game ?? room.timebomb;
    ensure(game, "遊戲資料不完整");
    game.revision++;
    delete room.botActionAt;
    room.activity = [
      ...(room.activity ?? []),
      {
        uid,
        message: "已離席，由 AI 接手本局。",
        sequence: game.revision,
      },
    ].slice(-20);
  } else {
    delete room.players[uid];
    if (session.private) delete session.private[uid];
    if (session.timebombPrivate) delete session.timebombPrivate[uid];
    if (session.mafiaPrivate) delete session.mafiaPrivate[uid];
    if (room.mafiaConfig?.godfatherId === uid)
      delete room.mafiaConfig.godfatherId;
    if (session.splendorPrivate) delete session.splendorPrivate[uid];
    if (session.saboteurPrivate) delete session.saboteurPrivate[uid];
    if (session.dancePrivate) delete session.dancePrivate[uid];
    if (session.rosePrivate) delete session.rosePrivate[uid];
    if (session.decorumPrivate) delete session.decorumPrivate[uid];
  }
  if (session.presence) delete session.presence[uid];
  const humans = Object.values(room.players)
    .filter((p) => !p.isBot)
    .sort((a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid));
  if (!humans.length) return null;
  if (room.hostId === uid) room.hostId = humans[0].uid;
  return session;
}
