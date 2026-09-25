import { useEffect, useState, type CSSProperties } from "react";
import {
  BookOpen,
  History,
  Trophy,
  Users,
  Eye,
  Handshake,
  Footprints,
  ShieldCheck,
  Search,
  RotateCw,
} from "lucide-react";
import type { Room, RoomAction } from "../../../../functions/src/shared/model";
import {
  DANCE_CARD_BY_ID,
  DANCE_DEFINITIONS,
  DANCE_MOTION_MS,
  canPlayDanceCard,
  danceTargets,
  danceNeedsSelection,
  defaultDanceConfig,
  type DanceAction,
  type DancePrivate,
  type DanceGame,
  type DanceConfig,
} from "../../../../functions/src/shared/criminalDance";
import { GameDialog } from "../../components/GameDialog";
import { useAction } from "../../hooks/useAction";
import { danceAction } from "../../firebase/api";
import { DanceCard, DanceDrawing } from "./DanceCard";
import { DancePlayback } from "./DancePlayback";
import "./criminalDance.css";
export function DanceSettings({
  room,
  disabled,
  onChange,
}: {
  room: Room;
  disabled: boolean;
  onChange: (a: RoomAction) => void;
}) {
  const config =
    room.danceConfig ?? defaultDanceConfig(Object.keys(room.players).length);
  const change = (value: Partial<DanceConfig>) =>
    onChange({ type: "danceConfig", config: { ...config, ...value } });
  return (
    <div className="cd-settings">
      <label>
        勝利目標
        <select
          aria-label="犯人在跳舞勝利目標"
          value={config.targetScore}
          disabled={disabled}
          onChange={(e) =>
            change({ targetScore: Number(e.target.value) as 5 | 10 })
          }
        >
          <option value={5}>短篇 · 5 分</option>
          <option value={10}>長篇 · 10 分</option>
        </select>
      </label>
      <label className="cd-check">
        <input
          type="checkbox"
          checked={config.boy}
          disabled={disabled}
          onChange={(e) => change({ boy: e.target.checked })}
        />
        加入少年（替換一張目擊者）
      </label>
      <label className="cd-check">
        <input
          type="checkbox"
          checked={config.policeChiefEnabled ?? false}
          disabled={disabled}
          onChange={(e) => change({ policeChiefEnabled: e.target.checked })}
        />
        加入警部（替換神犬）
      </label>
      <p className="fine">
        每人 4 張牌。目標分數可由房主調整；更改設定後需重新準備。
      </p>
    </div>
  );
}
export function CriminalDanceGame(props: {
  room: Room;
  uid: string;
  privateData: DancePrivate | null;
  connected: boolean;
  onRematch: () => void;
  roomPending: boolean;
}) {
  const [animating, setAnimating] = useState(false);
  const g = props.room.dance,
    own = props.privateData;
  if (!g) return null;
  return (
    <>
      {own?.gameId === g.id && own.roundId === g.roundId ? (
        <Table
          key={g.roundId}
          {...props}
          game={g}
          own={own}
          animating={animating}
        />
      ) : (
        <p role="status">正在讀取你的私人手牌…</p>
      )}
      <DancePlayback key={g.id} game={g} onBusy={setAnimating} />
    </>
  );
}
function Result({
  g,
  host,
  ready,
  onNext,
  onRematch,
  error,
}: {
  g: DanceGame;
  host: boolean;
  ready: boolean;
  onNext: () => void;
  onRematch: () => void;
  error: string;
}) {
  const [settled, setSettled] = useState(false),
    [details, setDetails] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), DANCE_MOTION_MS);
    return () => clearTimeout(t);
  }, []);
  const police = g.result?.resolution === "POLICE_CHIEF";
  const escape = g.result?.reason === "CRIMINAL_ESCAPED" && !police;
  return (
    <GameDialog
      title={g.aborted ? "對局中止" : `第 ${g.round} 輪結果`}
      onClose={() => {}}
      dismissible={false}
      className="cd-dialog cd-result"
    >
      <div className="cd-result-art">
        <DanceDrawing
          type={
            g.aborted
              ? "ORDINARY_PERSON"
              : police
                ? "POLICE_CHIEF"
                : escape
                  ? "CRIMINAL"
                  : g.result?.reason === "DOG_CAUGHT"
                    ? "DOG"
                    : "DETECTIVE"
          }
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <h2>
        {g.aborted
          ? "玩家離席，本局中止"
          : g.result?.reason === "NO_PLAYABLE_CARDS"
            ? "本輪無法繼續"
            : police
              ? "警部成功攔截犯人！"
              : escape
                ? "犯人逃脫，犯人陣營獲勝！"
                : "成功破案！"}
      </h2>
      {g.result?.criminal && (
        <p>
          本輪最後持有犯人：<b>{g.players[g.result.criminal].nickname}</b>
        </p>
      )}
      {police && g.result && (
        <p>
          {g.players[g.result.actor].nickname}{" "}
          的警部判定成功，本輪依警部規則計分。
        </p>
      )}
      {police && g.result?.reason === "CRIMINAL_ESCAPED" && (
        <p>犯人企圖逃脫，但被先前放置的警部攔下。</p>
      )}
      {!details && !g.aborted ? (
        <button
          className="cd-primary"
          disabled={!settled}
          onClick={() => setDetails(true)}
        >
          {settled ? "查看本輪得分" : "正在揭曉結果…"}
        </button>
      ) : (
        <>
          {g.phase === "MATCH_END" && !g.aborted && (
            <h3>
              {(g.winners ?? []).map((id) => g.players[id].nickname).join("、")}{" "}
              贏得整場勝利
            </h3>
          )}
          <table className="cd-score-table">
            <thead>
              <tr>
                <th>玩家</th>
                <th>本輪</th>
                <th>總分</th>
              </tr>
            </thead>
            <tbody>
              {g.order.map((id) => (
                <tr key={id}>
                  <th>
                    {g.players[id].nickname}
                    {g.players[id].accomplice && <small>共犯</small>}
                  </th>
                  <td>+{g.result?.awards[id] ?? 0}</td>
                  <td>{g.players[id].score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {host ? (
            <button
              className="cd-primary"
              disabled={!ready}
              onClick={g.phase === "ROUND_END" ? onNext : onRematch}
            >
              {g.phase === "ROUND_END" ? "開始下一輪" : "再開一局"}
            </button>
          ) : (
            <p>等待房主繼續</p>
          )}
        </>
      )}
    </GameDialog>
  );
}
function Table({
  room,
  uid,
  own,
  game: g,
  connected,
  onRematch,
  roomPending,
  animating,
}: {
  room: Room;
  uid: string;
  own: DancePrivate;
  game: DanceGame;
  connected: boolean;
  onRematch: () => void;
  roomPending: boolean;
  animating: boolean;
}) {
  const { pending, error, run } = useAction();
  const [panel, setPanel] = useState<
      "help" | "history" | "scores" | "boy" | null
    >(null),
    [selected, setSelected] = useState<string | null>(null),
    [target, setTarget] = useState(""),
    [peek, setPeek] = useState(false),
    [playerView, setPlayerView] = useState<string | null>(null);
  const [viewPhase, setViewPhase] = useState(g.phase);
  if (viewPhase !== g.phase) {
    setViewPhase(g.phase);
    setSelected(null);
    setPanel(null);
    setTarget("");
    setPeek(false);
    setPlayerView(null);
  }
  const ready =
      connected && !pending && !animating && own.revision === g.revision,
    turn = g.current === uid,
    choosing = danceNeedsSelection(g, uid),
    selectionPhase =
      g.phase === "TRADE_SELECTION" || g.phase === "EXCHANGE_SELECTION";
  const ended = g.phase === "ROUND_END" || g.phase === "MATCH_END";
  const actor = g.players[g.current],
    last = g.played.at(-1),
    card =
      selected && own.hand.includes(selected)
        ? DANCE_CARD_BY_ID[selected]
        : null;
  const send = (a: DanceAction) =>
    void run(async () => {
      await danceAction(room.code, g, a);
      setSelected(null);
      setTarget("");
      setPeek(false);
    });
  const title =
    g.phase === "PLAYER_TURN"
      ? turn
        ? g.firstPlay
          ? "先打出第一發現者，揭開案件"
          : "輪到你了，選一張牌打出"
        : `${actor.nickname} 的出牌回合`
      : g.phase === "SELECT_TARGET"
        ? `${actor.nickname} 正在選擇目標`
        : g.phase === "WITNESS_REVEAL"
          ? `${actor.nickname} 正在查看私人情報`
          : selectionPhase
            ? choosing
              ? "請秘密選一張手牌"
              : own.selection
                ? "已鎖定，等待其他人選牌"
                : "等待秘密選牌完成"
            : g.phase === "EFFECT_RESULT"
              ? `${actor.nickname} 確認效果`
              : "本輪結束";
  const selectedError = card ? canPlayDanceCard(g, own, uid, card.id) : null;
  const mySeat = g.order.indexOf(uid);
  return (
    <div className="cd-game">
      <header className="cd-heading">
        <h2>
          <Footprints size={21} />
          犯人在跳舞
        </h2>
        <span>
          第 {g.round} 輪 · {g.config.targetScore} 分勝出
        </span>
        <button aria-label="犯人在跳舞規則" onClick={() => setPanel("help")}>
          <BookOpen size={19} />
        </button>
      </header>
      <div className={`cd-turn ${turn ? "cd-my-turn" : ""}`} role="status">
        <span>{title}</span>
        {!connected && <b>離線，正在重連</b>}
      </div>
      <div className="cd-arena">
        <div
          className="cd-players"
          role="group"
          aria-label="環形座位，自己在下方，順時針往左鄰出牌"
        >
          {g.order.map((id, i) => {
            const p = g.players[id];
            const offset = (i - mySeat + g.order.length) % g.order.length;
            const angle = Math.PI / 2 + (offset * 2 * Math.PI) / g.order.length;
            const neighbor =
              offset === 0
                ? "你的座位"
                : offset === 1
                  ? "左鄰 · 下一位"
                  : offset === g.order.length - 1
                    ? "右鄰 · 上一位"
                    : `座位 ${i + 1}`;
            return (
              <button
                key={id}
                data-dance-player={id}
                data-seat-offset={offset}
                style={
                  {
                    "--seat-x": Math.cos(angle),
                    "--seat-y": Math.sin(angle),
                  } as CSSProperties
                }
                className={`cd-player ${g.current === id ? "active" : ""} ${id === uid ? "cd-self" : ""}`}
                onClick={() => setPlayerView(id)}
                aria-label={`${p.nickname}，${neighbor}，${p.handCount} 張手牌，${p.score} 分${p.accomplice ? "，已成為共犯" : ""}`}
              >
                <span>
                  <i>{i + 1}</i>
                  <b>
                    {p.nickname}
                    {id === uid ? " · 你" : ""}
                  </b>
                </span>
                <span>
                  <span className="cd-back-stack" aria-hidden="true">
                    {Array.from({ length: p.handCount }, (_, n) => (
                      <i key={n} />
                    ))}
                  </span>
                  <small>{p.handCount} 張</small>
                  <b className="cd-points">{p.score} 分</b>
                  {p.accomplice && (
                    <Handshake size={17} aria-label="已亮牌的共犯" />
                  )}
                  {g.pending?.locked.includes(id) && (
                    <ShieldCheck size={16} aria-label="已秘密選牌" />
                  )}
                </span>
                <small className="cd-seat-relation">{neighbor}</small>
                {g.policeChiefHolderUid === id && (
                  <span className="cd-police-badge" title="警部持有中">
                    <ShieldCheck size={13} />
                    <span>警部持有中</span>
                  </span>
                )}
                {g.policeChiefTargetUid === id && (
                  <span
                    className="cd-police-badge cd-police-target"
                    title="警部鎖定"
                  >
                    <Search size={13} />
                    <span>警部鎖定</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <section className="cd-center" aria-label="公開桌面">
          <div className="cd-last-card">
            {last ? <DanceCard id={last.cardId} /> : <DanceCard back />}
          </div>
          <div className="cd-table-copy">
            <span className="cd-seat-direction">
              <RotateCw size={14} />
              順時針 · 向左傳牌
            </span>
            <span className="cd-eyebrow">
              {last ? "最近公開的牌" : "案件尚未揭幕"}
            </span>
            <h3>
              {last
                ? `${g.players[last.uid].nickname} · ${DANCE_DEFINITIONS[DANCE_CARD_BY_ID[last.cardId].type].name}`
                : "犯人，就藏在其中一張手牌裡"}
            </h3>
            <p>
              {g.notice ??
                (last
                  ? DANCE_DEFINITIONS[DANCE_CARD_BY_ID[last.cardId].type].rule
                  : "第一發現者先出牌，其餘玩家依座位順序接續。")}
            </p>
            {selectionPhase && (
              <p>
                已鎖定 {g.pending?.locked.length ?? 0} /{" "}
                {g.pending?.eligible.length ?? 0} 人
              </p>
            )}
            {g.phase === "SELECT_TARGET" && turn && (
              <button className="cd-primary" onClick={() => setPanel(null)}>
                選擇目標
              </button>
            )}
          </div>
        </section>
      </div>
      <section className="cd-hand" aria-label="我的手牌">
        <div className="cd-hand-heading">
          <strong>我的手牌 · {own.hand.length} 張</strong>
          <span>
            {choosing
              ? "點卡牌並確認秘密交出"
              : selectionPhase && own.selection
                ? "你的選擇已鎖定"
                : "點牌放大，再確認出牌"}
          </span>
        </div>
        <div className="cd-hand-fan">
          {own.hand.map((id, i) => (
            <button
              key={id}
              className={`cd-hand-card ${own.selection === id ? "selected" : ""}`}
              style={
                {
                  "--fan-angle": `${(i - (own.hand.length - 1) / 2) * 3}deg`,
                } as CSSProperties
              }
              aria-label={`查看手牌：${DANCE_DEFINITIONS[DANCE_CARD_BY_ID[id].type].name}`}
              onClick={() => setSelected(id)}
            >
              <DanceCard id={id} />
            </button>
          ))}
          {!own.hand.length && (
            <p>目前沒有手牌，普通回合會略過；仍能收到別人傳來的牌。</p>
          )}
        </div>
      </section>
      <nav className="cd-footer">
        <button onClick={() => setPanel("scores")}>
          <Trophy size={17} />
          分數
        </button>
        <button onClick={() => setPanel("history")}>
          <History size={17} />
          出牌紀錄
        </button>
        {own.boyInitial && (
          <button onClick={() => setPanel("boy")}>
            <Eye size={17} />
            少年情報
          </button>
        )}
        <span>
          <Users size={15} />
          {g.order.length} 人
        </span>
      </nav>
      {error && (
        <p className="cd-error" role="alert">
          {error}
        </p>
      )}
      {card && !ended && (
        <GameDialog
          title={DANCE_DEFINITIONS[card.type].name}
          className="cd-dialog"
          onClose={() => setSelected(null)}
        >
          <div className="cd-preview">
            <DanceCard id={card.id} />
          </div>
          {choosing ? (
            <>
              <p>這張牌會秘密交出；其他玩家只會知道你已選好。</p>
              <button
                className="cd-primary"
                disabled={!ready}
                onClick={() => send({ type: "danceSelect", cardId: card.id })}
              >
                鎖定這張牌
              </button>
            </>
          ) : (
            <>
              <p>{selectedError ?? "確認後公開打出這張牌。"}</p>
              <button
                className="cd-primary"
                disabled={!ready || !!selectedError}
                onClick={() => send({ type: "dancePlay", cardId: card.id })}
              >
                打出此牌
              </button>
            </>
          )}
          {panel === "help" && (
            <p>
              警部選配取代神犬，持有人公開。出牌前手牌最多 3
              張，指定另一人後目標固定；回合結束時，若目標是最後犯人且沒有不在場證明，優先依警部破案計分：警部
              3 分、犯人與亮牌共犯 0 分，其餘玩家 1 分。
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </GameDialog>
      )}
      {g.phase === "SELECT_TARGET" && turn && g.pending && !ended && (
        <GameDialog
          title={`${DANCE_DEFINITIONS[g.pending.type].name} · 選擇目標`}
          onClose={() => {}}
          dismissible={false}
          className="cd-dialog"
        >
          <p>{DANCE_DEFINITIONS[g.pending.type].rule}</p>
          <div className="cd-targets">
            {danceTargets(g, uid, g.pending.type).map((id) => (
              <button
                key={id}
                aria-pressed={target === id}
                onClick={() => setTarget(id)}
              >
                <Search size={18} />
                {g.players[id].nickname}
                <small>{g.players[id].handCount} 張牌</small>
              </button>
            ))}
          </div>
          <button
            className="cd-primary"
            disabled={
              !ready || !danceTargets(g, uid, g.pending.type).includes(target)
            }
            onClick={() => send({ type: "danceTarget", target })}
          >
            確認目標
          </button>
          {error && <p role="alert">{error}</p>}
        </GameDialog>
      )}
      {g.phase === "WITNESS_REVEAL" && turn && own.witness && (
        <GameDialog
          title="目擊者 · 私人情報"
          onClose={() => {}}
          dismissible={false}
          className="cd-dialog"
        >
          <h3>{g.players[own.witness.target].nickname} 的手牌</h3>
          {!peek ? (
            <>
              <Eye size={42} />
              <p>這是私人資訊。請確認只有你能看見螢幕。</p>
              <button className="cd-primary" onClick={() => setPeek(true)}>
                查看對方手牌
              </button>
            </>
          ) : (
            <>
              <div className="cd-witness-hand">
                {own.witness.cards.map((id) => (
                  <DanceCard key={id} id={id} />
                ))}
              </div>
              <p>關閉後不能重新開啟這份情報。</p>
              <button
                className="cd-primary"
                disabled={!ready}
                onClick={() => send({ type: "danceAcknowledge" })}
              >
                我記住了
              </button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </GameDialog>
      )}
      {g.phase === "EFFECT_RESULT" && turn && !ended && (
        <EffectResult
          key={g.revision}
          text={g.notice ?? "效果已完成"}
          ready={ready}
          onContinue={() => send({ type: "danceAcknowledge" })}
          error={error}
        />
      )}
      {panel && !ended && (
        <GameDialog
          title={
            {
              help: "犯人在跳舞 · 遊戲指南",
              history: "公開出牌紀錄",
              scores: "累積分數",
              boy: "少年 · 開局情報",
            }[panel]
          }
          className="cd-dialog"
          onClose={() => {
            setPanel(null);
            setPeek(false);
          }}
        >
          {panel === "help" && (
            <>
              <p>
                3–8 人，每人 4
                張牌，不補牌。第一發現者必須先出；之後依座位順序，每回合出一張。沒有手牌時暫時略過，收到牌後可以再次行動。
              </p>
              <p>
                犯人身份跟著犯人牌移動。犯人只能當最後一張牌打出。共犯必須先亮牌才生效；不在場證明留在手中才有保護。
              </p>
              <p>
                偵探看出牌前張數：4 張以上沒有效果，3
                張以下才能指認。偵探抓到人得 2 分，神犬抓到人得 3
                分；其他非犯人／共犯各 1 分。犯人逃脫時，犯人與共犯各得 2
                分。同一人不重複計分。
              </p>
              <p>
                情報交換與謠言都會同時把牌移向左側下一個座位。空手的人仍可收牌；本次剛收到的牌不會再次被傳走。交易雙方選牌鎖定後才交換。
              </p>
              <p>
                神犬由伺服器隨機抽牌，任何有牌的人（包含自己）都能成為目標。沒有合法交易對象或打出交易後空手時，不交換並繼續。共犯與犯人同陣營，犯人被抓時本輪皆得
                0 分。
              </p>
              <p>
                每輪由房主確認再開始。有人達 {g.config.targetScore}{" "}
                分時，總分最高者勝出，同分並列。暫時離線保留座位；主動離席會中止本場。
              </p>
            </>
          )}
          {panel === "history" && (
            <ol className="cd-log">
              {[...g.events].reverse().map((e) => (
                <li key={e.revision}>
                  <b>{g.players[e.actor]?.nickname}</b> {e.text}
                </li>
              ))}
            </ol>
          )}
          {panel === "scores" && (
            <>
              <p>目標 {g.config.targetScore} 分 · 同時達標時比較總分</p>
              {g.order.map((id) => (
                <p key={id}>
                  {g.players[id].nickname} <b>{g.players[id].score} 分</b>
                  {g.players[id].accomplice ? " · 本輪共犯" : ""}
                </p>
              ))}
            </>
          )}
          {panel === "boy" &&
            (peek ? (
              <>
                <DanceDrawing type="BOY" />
                <h3>開局時：{g.players[own.boyInitial!]?.nickname} 持有犯人</h3>
                <p>這是開局快照，之後卡牌可能已經移動。</p>
              </>
            ) : (
              <>
                <p>只有你知道，請先確認身旁沒有人偷看。</p>
                <button className="cd-primary" onClick={() => setPeek(true)}>
                  查看開局情報
                </button>
              </>
            ))}
        </GameDialog>
      )}
      {playerView && !ended && (
        <GameDialog
          title="玩家公開資訊"
          className="cd-dialog"
          onClose={() => setPlayerView(null)}
        >
          <h3>{g.players[playerView].nickname}</h3>
          {g.policeChiefHolderUid === playerView && (
            <p>公開持有警部，其他手牌仍為秘密。</p>
          )}
          {g.policeChiefTargetUid === playerView && (
            <p>
              {g.players[g.policeChiefOwnerUid!].nickname}{" "}
              的警部已鎖定此玩家，回合結束時才判定。
            </p>
          )}
          <p>
            手牌 {g.players[playerView].handCount} 張 ·{" "}
            {g.players[playerView].score} 分
          </p>
          <p>
            {g.players[playerView].accomplice
              ? "已打出共犯，本輪加入犯人陣營。"
              : "尚未亮出共犯。"}
          </p>
          <div className="cd-witness-hand">
            {g.played
              .filter((c) => c.uid === playerView)
              .map((c) => (
                <DanceCard key={c.cardId} id={c.cardId} />
              ))}
          </div>
        </GameDialog>
      )}
      {ended && (
        <Result
          g={g}
          host={room.hostId === uid}
          ready={ready && !roomPending}
          onNext={() => send({ type: "danceNext" })}
          onRematch={onRematch}
          error={error}
        />
      )}
    </div>
  );
}
function EffectResult({
  text,
  ready,
  onContinue,
  error,
}: {
  text: string;
  ready: boolean;
  onContinue: () => void;
  error: string;
}) {
  const [watched, setWatched] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWatched(true), DANCE_MOTION_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <GameDialog
      title="行動結果"
      className="cd-dialog"
      onClose={() => {}}
      dismissible={false}
    >
      <div className="cd-effect-icon">
        <Footprints size={45} />
      </div>
      <h3>{text}</h3>
      <button
        className="cd-primary"
        disabled={!ready || !watched}
        onClick={onContinue}
      >
        {watched ? "確認，繼續" : "正在演出…"}
      </button>
      {error && <p role="alert">{error}</p>}
    </GameDialog>
  );
}
