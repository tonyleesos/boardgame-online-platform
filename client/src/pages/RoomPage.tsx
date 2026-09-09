import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Copy, Crown, LogOut, Wifi, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePlayer } from "../app/context";
import { useRoom } from "../hooks/useRoom";
import { useAction } from "../hooks/useAction";
import { roomAction } from "../firebase/api";
import { AvalonGame } from "../games/avalon/AvalonGame";
import { TimeBombGame } from "../games/timebomb/TimeBombGame";
import { useBots } from "../hooks/useBots";
import { games } from "../games/catalog";
import type { RoomAction } from "../../../functions/src/shared/model";
export function RoomPage() {
  const { code = "" } = useParams();
  const { uid } = usePlayer();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code))
    return (
      <section className="panel">
        <h1>房號格式不正確</h1>
        <Link to="/join">重新輸入房號</Link>
      </section>
    );
  return <RoomContent key={code} code={code} uid={uid} />;
}
function RoomContent({ code, uid }: { code: string; uid: string }) {
  const {
    room,
    role,
    bombRole,
    presence,
    connected,
    loaded,
    error: roomError,
  } = useRoom(code, uid);
  const botError = useBots(room, connected);
  const { pending, error, run } = useAction();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const act = (action: RoomAction) =>
    void run(async () => {
      await roomAction(code, action);
      if (action.type === "leave") {
        localStorage.removeItem("lastRoom");
        navigate("/games");
      }
    });
  if (!loaded) return <p role="status">正在讀取房間…</p>;
  if (!room || !room.players[uid])
    return (
      <section className="panel">
        <h1>無法進入房間</h1>
        <p role="alert" className="error">
          {roomError || "房間已關閉，或你尚未加入。"}
        </p>
        <Link className="button" to="/join">
          加入房間
        </Link>
      </section>
    );
  const players = Object.values(room.players).sort(
    (a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid),
  );
  const host = room.hostId === uid;
  const definition = games.find((g) => g.id === room.gameId)!;
  const allReady =
    players.length >= definition.minPlayers && players.every((p) => p.ready);
  return (
    <>
      <div className="room-top">
        <div>
          <p className="eyebrow">
            {definition.subtitle} ·{" "}
            {room.mode === "practice" ? "AI 練習桌" : "私人圓桌"}
          </p>
          <h1>
            {room.status === "waiting"
              ? "等待朋友入座"
              : room.status === "finished"
                ? "故事暫告一段落"
                : "圓桌上的暗流"}
          </h1>
        </div>
        <div className="room-code">
          <small>房間代碼</small>
          <button
            aria-label="複製房間代碼"
            onClick={() =>
              void run(async () => {
                await navigator.clipboard.writeText(code);
                setCopied(true);
              })
            }
          >
            {code}
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>
      <p className={`connection ${connected ? "" : "offline"}`} role="status">
        {connected ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
        {connected ? "即時連線中" : "連線中斷，正在重新連線…"}
      </p>
      {(roomError || error || botError) && (
        <p className="error" role="alert">
          {roomError || error || botError}
        </p>
      )}
      <div className="room-grid">
        <aside className="panel players-panel">
          <div className="section-heading">
            <h2>圓桌夥伴</h2>
            <span>
              {players.length} / {definition.maxPlayers}
            </span>
          </div>
          <ul className="player-list">
            <AnimatePresence>
              {players.map((p, i) => (
                <motion.li
                  key={p.uid}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <span className={`avatar color-${i % 4}`}>
                    {p.nickname.slice(0, 1)}
                  </span>
                  <div className="player-name">
                    <strong>
                      {p.nickname}
                      {p.uid === uid && <small>（你）</small>}
                    </strong>
                    <small>
                      {p.isBot
                        ? "AI 電腦"
                        : Object.keys(presence[p.uid]?.connections ?? {}).length
                          ? "在線"
                          : "離線"}
                      {p.uid === room.hostId && (
                        <>
                          {" "}
                          · 房主 <Crown size={12} />
                        </>
                      )}
                    </small>
                  </div>
                  {room.status === "waiting" && (
                    <span className={p.ready ? "ready" : "muted"}>
                      {p.ready ? <Check size={18} /> : "未準備"}
                    </span>
                  )}
                  {p.isBot && host && room.status === "waiting" && (
                    <button
                      className="remove-bot"
                      aria-label={`移除 ${p.nickname}`}
                      disabled={pending}
                      onClick={() => act({ type: "removeBot", botId: p.uid })}
                    >
                      ×
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {host && room.status === "waiting" && (
            <button
              className="button add-bot"
              disabled={
                pending || !connected || players.length >= definition.maxPlayers
              }
              onClick={() => act({ type: "addBot" })}
            >
              ＋ 新增 AI 電腦玩家
            </button>
          )}
          <button
            className="quiet"
            disabled={pending || !connected}
            onClick={() => act({ type: "recover" })}
          >
            清理離線超過 90 秒的玩家
          </button>
          <p className="fine">
            清理遊戲中的離線玩家會中止本局。房主離開時，由最早入座的玩家接任。
          </p>
          <button className="quiet" onClick={() => setLeaving(true)}>
            <LogOut size={15} />
            離開房間
          </button>
        </aside>
        <section>
          {room.status === "waiting" ? (
            <div className="panel waiting">
              <Crown size={56} strokeWidth={1} className="gold" />
              <p className="eyebrow">THE NIGHT IS YOUNG</p>
              <h2>所有人到齊，好戲就開場。</h2>
              <p className="muted">
                把房號分享給朋友，準備好迎接你的秘密身份。
                <br />
                需要 {definition.minPlayers}–{definition.maxPlayers}{" "}
                位玩家，且所有人都已準備。AI 會自動準備。
              </p>
              <div className="actions">
                <button
                  className={room.players[uid].ready ? "" : "primary"}
                  disabled={pending || !connected}
                  onClick={() =>
                    act({ type: "ready", ready: !room.players[uid].ready })
                  }
                >
                  {room.players[uid].ready ? "取消準備" : "我準備好了"}
                </button>
                {host && (
                  <button
                    className="primary"
                    disabled={pending || !connected || !allReady}
                    onClick={() => act({ type: "start" })}
                  >
                    開始遊戲
                  </button>
                )}
              </div>
              <p className="fine">
                {players.filter((p) => p.ready).length} 位已準備
                {!host && " · 等待房主開始遊戲"}
              </p>
            </div>
          ) : room.gameId === "timebomb" ||
            room.gameId === "timebomb-classic" ? (
            <TimeBombGame
              room={room}
              role={bombRole}
              uid={uid}
              connected={connected}
              onRematch={() => act({ type: "rematch" })}
              roomPending={pending}
            />
          ) : (
            <AvalonGame
              room={room}
              role={role}
              uid={uid}
              connected={connected}
              onRematch={() => act({ type: "rematch" })}
              roomPending={pending}
            />
          )}
          {players.some((p) => p.isBot) && (
            <section className="panel ai-conversation">
              <div className="section-heading">
                <h2>圓桌發言</h2>
                <span>AI · {room.botLevel === "casual" ? "輕鬆" : "標準"}</span>
              </div>
              <p className="fine">
                AI 根據自己的情報與公開紀錄行動。發言可能包含虛張聲勢。
              </p>
              <div className="ai-messages" aria-live="polite">
                {(room.activity ?? []).slice(-6).map((entry, i) => (
                  <p key={`${entry.sequence}:${i}`}>
                    <strong>{room.players[entry.uid]?.nickname ?? "AI"}</strong>
                    <span>{entry.message}</span>
                  </p>
                ))}
                {!room.activity?.length && (
                  <p className="muted">開始遊戲後，AI 會加入討論並自動行動。</p>
                )}
              </div>
            </section>
          )}
        </section>
      </div>
      <AnimatePresence>
        {leaving && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <section
              className="panel modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-title"
            >
              <h2 id="leave-title">離開這張圓桌？</h2>
              <p>
                {room.status === "playing"
                  ? "離開會中止本局，其他玩家可以重新開局。"
                  : "你的座位會空出，房主身份會自動交接。"}
              </p>
              <div className="actions">
                <button onClick={() => setLeaving(false)}>繼續留座</button>
                <button
                  className="danger"
                  disabled={pending || !connected}
                  onClick={() => act({ type: "leave" })}
                >
                  確認離開
                </button>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
