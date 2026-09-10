import type { Session } from "./shared/model";
import { ensure } from "./shared/rules";
import { finishDecorum } from "./decorum/engine";

/** Keep the seat ID stable so secret votes, knowledge and wire slots survive.
 * Callable handlers and database rules deny this former human ID once it is a bot.
 */
export function leaveSeat(session: Session, uid: string): Session | null {
  const room = session.public;
  const player = room.players[uid];
  ensure(player && !player.isBot, "你不在房間內");
  if (room.gameId === "decorum" && room.status === "playing") finishDecorum(session, "player-left");
  if (room.status === "playing") {
    player.isBot = true;
    player.isProxy = true;
    player.ready = true;
    // Wake clients that have already found the previous bot token idle.
    const game = room.game ?? room.timebomb;
    ensure(game, "遊戲資料不完整");
    game.revision++;
    delete room.botActionAt;
    room.activity = [...(room.activity ?? []), {
      uid,
      message: "已離席，由 AI 接手本局。",
      sequence: game.revision,
    }].slice(-20);
  } else {
    delete room.players[uid];
    if (session.private) delete session.private[uid];
    if (session.timebombPrivate) delete session.timebombPrivate[uid];
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
