import { MafiaGame, MafiaSettings } from "../games/mafia/MafiaGame";
import { SplendorGame, SplendorSettings } from "../games/splendor/SplendorGame";
import { SaboteurGame } from "../games/saboteur/SaboteurGame";
import { BladesRoseGame } from "../games/blades-and-rose/BladesRoseGame";
import { PLAYER_COUNT_RULES } from "../../../functions/src/shared/bladesRose";
import {
  CriminalDanceGame,
  DanceSettings,
} from "../games/criminalDance/CriminalDanceGame";
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
import { DecorumGame } from "../games/decorum/DecorumGame";
import { DECORUM_SCENARIOS } from "../../../functions/src/shared/decorum";
import { useBots } from "../hooks/useBots";
import { games } from "../games/catalog";
import type { RoomAction } from "../../../functions/src/shared/model";
import { GameDialog } from "../components/GameDialog";
import "../games/game-table.css";
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
    decorumPrivate,
    splendorPrivate,
    mafiaPrivate,
    saboteurPrivate,
    dancePrivate,
    rosePrivate,
    presence,
    connected,
    loaded,
    privateError,
    retry,
    error: roomError,
  } = useRoom(code, uid);
  const botError = useBots(
    room,
    connected &&
      !privateError &&
      !!room?.players[uid] &&
      !room.players[uid].isBot,
  );
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
  if (!room || !room.players[uid] || room.players[uid].isBot)
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
  const isMafia = room.gameId === "mafia-de-cuba";
  const isSplendor = room.gameId === "splendor";
  const isSaboteur = room.gameId === "saboteur-2";
  const isDance = room.gameId === "criminal-dance";
  const isRose = room.gameId === "blades-and-rose";
  const noBots = definition.supportsBots === false;
  const isDecorum = room.gameId === "decorum";
  const decorScenario =
    DECORUM_SCENARIOS.find((s) => s.id === room.decorumScenarioId) ??
    DECORUM_SCENARIOS.find((s) => s.playerCount === players.length);
  const allReady =
    players.length >= definition.minPlayers &&
    players.every((p) => p.ready) &&
    (!isRose ||
      PLAYER_COUNT_RULES[players.length]?.verifiedAgainstOfficialBoard) &&
    (!isDecorum || decorScenario?.playerCount === players.length);
  return (
    <div
      className={`${room.status === "waiting" ? "room-waiting" : "room-active"}${isSplendor ? " room-splendor" : ""}${isSaboteur ? " room-saboteur" : ""}${isDance ? " room-dance" : ""}${isRose ? " room-rose" : ""}`}
    >
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
                : definition.name}
          </h1>
        </div>
        {room.status !== "waiting" && (
          <button
            className="quiet icon-button room-leave"
            aria-label="離開房間"
            onClick={() => setLeaving(true)}
          >
            <LogOut size={18} />
          </button>
        )}
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
      {privateError && (
        <button onClick={retry} disabled={!connected}>
          重新載入私人資料
        </button>
      )}
      <div className="room-grid">
        <details
          className="panel players-panel"
          open={room.status === "waiting"}
        >
          <summary className="players-summary">
            房間與玩家 · {players.length} 人
          </summary>
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
                      {p.isProxy
                        ? "AI 接手"
                        : p.isBot
                          ? "AI 電腦"
                          : Object.keys(presence[p.uid]?.connections ?? {})
                                .length
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
          {host && room.status === "waiting" && !noBots && (
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
            disabled={
              pending ||
              !connected ||
              ((isSplendor || isMafia || isDance || isSaboteur || isRose) &&
                room.status === "playing")
            }
            onClick={() => act({ type: "recover" })}
          >
            {room.status === "playing"
              ? isSplendor || isMafia || isDance || isSaboteur || isRose
                ? "保留座位，等待重新連線"
                : isDecorum
                  ? "清理離線室友並中止本局"
                  : "離線超過 90 秒的玩家交由 AI 接手"
              : "清理離線超過 90 秒的玩家"}
          </button>
          <p className="fine">
            {isSplendor || isMafia || isDance || isSaboteur || isRose
              ? "暫時離線保留座位。明確離開會中止本局，其他玩家可重新開局。"
              : isDecorum
                ? "離線可重連。室友明確離開或被清理會中止合租，房主由最早入座的室友接任。"
                : "遊戲中離席由 AI 接手本局，保留角色與進度。房主離開時，由最早入座的真人接任。"}
          </p>
          {room.status === "waiting" && (
            <button className="quiet" onClick={() => setLeaving(true)}>
              <LogOut size={15} />
              離開房間
            </button>
          )}
        </details>
        <section>
          {room.status === "waiting" ? (
            <div className="panel waiting">
              <Crown size={56} strokeWidth={1} className="gold" />
              <p className="eyebrow">THE NIGHT IS YOUNG</p>
              <h2>所有人到齊，好戲就開場。</h2>
              <p className="muted">
                {isSplendor
                  ? "邀朋友入座，打造你的珠寶收藏。"
                  : isDecorum
                    ? "把房號分享給朋友，一起佈置理想的家。"
                    : "把房號分享給朋友，準備好迎接你的秘密身份。"}
                <br />
                需要 {definition.minPlayers}–{definition.maxPlayers}{" "}
                位玩家，且所有人都已準備。{!noBots && "AI 會自動準備。"}
              </p>
              {isDance && (
                <DanceSettings
                  room={room}
                  disabled={!host || pending || !connected}
                  onChange={act}
                />
              )}
              {isMafia && (
                <MafiaSettings
                  room={room}
                  disabled={!host || pending || !connected}
                  onChange={(config) => act({ type: "mafiaConfig", config })}
                />
              )}
              {isSplendor && (
                <SplendorSettings
                  config={
                    room.splendorConfig ?? {
                      module: "base",
                      competitorMode: false,
                    }
                  }
                  disabled={!host || pending || !connected}
                  onChange={(config) => act({ type: "splendorConfig", config })}
                />
              )}
              {isDecorum && (
                <div className="decor-scenario-picker">
                  <label htmlFor="decor-scenario">合租劇本（由房主選擇）</label>
                  <select
                    id="decor-scenario"
                    value={decorScenario?.id ?? ""}
                    disabled={!host || pending || !connected}
                    onChange={(e) =>
                      act({ type: "decorScenario", scenarioId: e.target.value })
                    }
                  >
                    {!decorScenario && (
                      <option value="" disabled>
                        等待室友入座後選擇劇本
                      </option>
                    )}
                    {DECORUM_SCENARIOS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.playerCount} 人 · {s.name} · 難度 {s.difficulty}/5
                      </option>
                    ))}
                  </select>
                  <p>
                    {decorScenario?.description ??
                      "提供 2–4 人的原創合作劇本，不使用商業版劇本文字。"}
                  </p>
                  {decorScenario &&
                    decorScenario.playerCount !== players.length && (
                      <p className="error">
                        此劇本需要 {decorScenario.playerCount} 位玩家，目前有{" "}
                        {players.length} 位。
                      </p>
                    )}
                  <p className="fine">更換劇本後，所有室友需要重新準備。</p>
                </div>
              )}
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
              {isRose && (
                <p className="fine">
                  目前開放 8 人模式。5、6、7、9、10
                  人的角色配置與勝利門檻尚待官方圖板校對。
                </p>
              )}
            </div>
          ) : isRose ? (
            privateError ? null : (
              <BladesRoseGame
                room={room}
                uid={uid}
                privateData={rosePrivate}
                connected={connected}
                onRematch={() => act({ type: "rematch" })}
                roomPending={pending}
              />
            )
          ) : isMafia ? (
            privateError || (!mafiaPrivate && room.status === "playing") ? (
              <section className="panel" role="status">
                <h2>正在連接私人資料</h2>
                <p>你的座位已保留，載入完成後即可繼續。</p>
              </section>
            ) : (
              <MafiaGame
                room={room}
                privateData={mafiaPrivate}
                uid={uid}
                connected={connected}
                onRematch={() => act({ type: "rematch" })}
                roomPending={pending}
              />
            )
          ) : isDance ? (
            privateError ? null : (
              <CriminalDanceGame
                room={room}
                uid={uid}
                privateData={dancePrivate}
                connected={connected}
                onRematch={() => act({ type: "rematch" })}
                roomPending={pending}
              />
            )
          ) : isSaboteur ? (
            privateError ? null : (
              <SaboteurGame
                room={room}
                uid={uid}
                privateData={saboteurPrivate}
                connected={connected}
                presence={presence}
                onRematch={() => act({ type: "rematch" })}
                roomPending={pending}
              />
            )
          ) : isSplendor ? (
            <SplendorGame
              room={room}
              privateData={splendorPrivate}
              uid={uid}
              connected={connected}
              presence={presence}
              onRematch={() => act({ type: "rematch" })}
              roomPending={pending}
            />
          ) : isDecorum ? (
            <DecorumGame
              room={room}
              privateData={decorumPrivate}
              uid={uid}
              connected={connected}
              onRematch={() => act({ type: "rematch" })}
              roomPending={pending}
            />
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
            <details className="panel ai-conversation">
              <summary>圓桌發言 · AI</summary>
              <div className="section-heading">
                <h2>圓桌發言</h2>
                <span>AI · {room.botLevel === "casual" ? "輕鬆" : "標準"}</span>
              </div>
              <p className="fine">
                {isMafia
                  ? "AI 只使用自己的角色、目前可見的盒子與公開結果。指控是策略加上隨機猜測，適合熟悉規則。"
                  : isSplendor
                    ? "AI 只使用公開市場與自己的保留卡，不會查看其他玩家暗牌。"
                    : "AI 根據自己的情報與公開紀錄行動。發言可能包含虛張聲勢。"}
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
            </details>
          )}
        </section>
      </div>
      {leaving && (
        <GameDialog title="離開房間" onClose={() => setLeaving(false)}>
          <h2 id="leave-title">離開這張圓桌？</h2>
          <p>
            {room.status === "playing"
              ? isDance || isSaboteur
                ? "明確離開會中止本局，其他玩家可重新開局。暫時離線會保留座位，可回到原房間繼續。"
                : isMafia
                  ? "離開會中止這局教父風雲。暫時離線會保留座位，可回到原房間繼續。"
                  : isSplendor
                    ? "離開會中止這局璀璨寶石。暫時離線可直接關閉頁面，之後回到原房間繼續。"
                    : isDecorum
                      ? "離開會中止這局同房異夢並公開所有心願。若只是暫時離線，可關閉頁面後回到原房間。"
                      : players.filter((p) => !p.isBot).length === 1
                        ? "你是最後一位真人，離開後房間將關閉。"
                        : "AI 將接管你的角色、手牌與後續操作，其他玩家繼續本局。接手後本局無法重新入座；下一局可再加入。"
              : "你的座位會空出，房主身份會自動交接。"}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button onClick={() => setLeaving(false)}>繼續留座</button>
            <button
              className="danger"
              disabled={pending || !connected}
              onClick={() => act({ type: "leave" })}
            >
              {room.status === "playing" &&
              !noBots &&
              !isSplendor &&
              players.filter((p) => !p.isBot).length > 1
                ? "離開並交由 AI 接手"
                : "確認離開"}
            </button>
          </div>
        </GameDialog>
      )}
    </div>
  );
}
