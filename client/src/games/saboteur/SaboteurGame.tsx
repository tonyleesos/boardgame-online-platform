import { useState } from "react";
import {
  BookOpen,
  History,
  HardHat,
  Layers,
  RotateCw,
  Check,
  X,
  LockKeyhole,
  Eye,
  Trophy,
  Pickaxe,
} from "lucide-react";
import type { Room } from "../../../../functions/src/shared/model";
import {
  MINE_CARD_BY_ID,
  DWARF_ROLE_NAMES,
  DWARF_ROLE_HELP,
  EFFECT_NAMES,
  GOAL_KEYS,
  mineActor,
  pathBlocked,
} from "../../../../functions/src/shared/saboteur";
import type {
  Effect,
  MineAction,
  MineGame,
  MinePrivate,
  Tool,
} from "../../../../functions/src/shared/saboteur";
import { legalActionTargets } from "../../../../functions/src/shared/mineActions";
import { validatePathPlacement } from "../../../../functions/src/shared/mineTopology";
import { GameDialog } from "../../components/GameDialog";
import { useAction } from "../../hooks/useAction";
import { mineAction } from "../../firebase/api";
import { HandCard, EffectIcons, TunnelArt } from "./MineArt";
import { MineBoard } from "./MineBoard";
import { MinePlayback } from "./MinePlayback";
import {
  ActionIllustration,
  CrystalArt,
  GoldArt,
  HandCount,
  RolePortrait,
} from "./MineIllustrations";
import { RoundVictory } from "./RoundVictory";
import { roundPresentation } from "./roundPresentation";
import type { Presence } from "../../hooks/useRoom";
import "./saboteur.css";
const ACTION_HELP: Record<string, string> = {
  BREAK: "破壞另一位玩家的一種工具。任何工具損壞時都無法蓋路。",
  REPAIR: "修復自己或其他玩家的一種工具。雙工具牌只能選一種。",
  ROCKFALL: "移除一張已放置的道路；入口和目標不能移除。",
  MAP: "私下查看一個未揭開目標，只有你知道內容。",
  THEFT: "放在自己面前。輪末分金後可偷另一人 1 金；被困住時無法偷竊。",
  HANDS_OFF: "移除任何一位玩家的偷竊牌。",
  SWAP_HANDS: "交換彼此全部手牌，再由對方補一張牌。",
  INSPECTION: "私下查看另一位玩家的目前身份。之後可能被更換。",
  CHANGE_HATS: "為自己或另一位玩家換上新身份。舊身份回到未使用身份牌堆底部。",
  TRAPPED: "困住另一位玩家：不能蓋路，輪末不能領金或偷竊。",
  FREEDOM: "解除自己或其他玩家的受困狀態。",
};
export function SaboteurGame(props: {
  room: Room;
  uid: string;
  privateData: MinePrivate | null;
  connected: boolean;
  presence: Record<string, Presence>;
  onRematch: () => void;
  roomPending: boolean;
}) {
  const g = props.room.saboteur;
  if (!g) return null;
  const own = props.privateData;
  return (
    <>
      {own && own.gameId === g.id && own.round === g.round ? (
        <Board key={`${g.id}:${g.round}`} {...props} game={g} own={own} />
      ) : (
        <p role="status">正在讀取你的私人手牌…</p>
      )}
      <MinePlayback key={g.id} game={g} />
    </>
  );
}
function Board({
  room,
  uid,
  game: g,
  own,
  connected,
  presence,
  onRematch,
  roomPending,
}: {
  room: Room;
  uid: string;
  game: MineGame;
  own: MinePrivate;
  connected: boolean;
  presence: Record<string, Presence>;
  onRematch: () => void;
  roomPending: boolean;
}) {
  const { pending, error, run } = useAction();
  const [panel, setPanel] = useState<
    "hand" | "role" | "help" | "history" | "discard" | "knowledge" | null
  >(null);
  const [revealed, setRevealed] = useState(false),
    [seenRole, setSeenRole] = useState(0);
  const [draft, setDraft] = useState<{ id: string; revision: number } | null>(
      null,
    ),
    [rotation, setRotation] = useState<0 | 180>(0),
    [chosen, setChosen] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState(""),
    [tool, setTool] = useState<Tool | "">(""),
    [discard, setDiscard] = useState<string[]>([]),
    [effect, setEffect] = useState<Effect | "">("");
  const [inspect, setInspect] = useState<string | null>(null),
    [dismissedResult, setDismissedResult] = useState("");
  const [victorySeen, setVictorySeen] = useState(false);
  const showVictory = !!g.result && !g.aborted && !victorySeen;
  const me = g.players[uid],
    current = mineActor(g),
    myTurn = current === uid;
  const ready =
    connected &&
    !pending &&
    own.round === g.round &&
    own.revision === g.revision;
  const primary = ready && myTurn && g.phase === "PLAYER_ACTION";
  const selected =
    draft?.revision === g.revision && own.hand.includes(draft.id)
      ? MINE_CARD_BY_ID[draft.id]
      : null;
  const targets =
    selected?.kind === "action" ? legalActionTargets(g, uid, selected) : [];
  const resultKey = `${g.round}:${g.phase}`,
    showResult =
      !showVictory &&
      (!!g.result || g.aborted) &&
      g.phase !== "PLAYER_ACTION" &&
      g.phase !== "PRIVATE_RESULT" &&
      dismissedResult !== resultKey &&
      !panel &&
      !inspect;
  const send = (a: MineAction) =>
    void run(async () => {
      await mineAction(room.code, g, a);
      setDraft(null);
      setChosen(null);
      setPanel(null);
      setTarget("");
      setTool("");
      setDiscard([]);
      setEffect("");
    });
  function select(id: string) {
    setDraft({ id, revision: g.revision });
    setChosen(null);
    setRotation(0);
    setTarget("");
    setTool("");
    setPanel(null);
  }
  const pathError =
    selected?.kind === "path" && chosen
      ? validatePathPlacement(
          g.board,
          selected,
          chosen.x,
          chosen.y,
          rotation,
          me,
        )
      : null;
  const phaseText =
    g.phase === "GAME_OVER"
      ? "三輪冒險結束"
      : g.phase === "ROUND_RESULT"
        ? "本輪結算 · 等待房主開始下一輪"
        : g.phase === "THEFT_RESOLUTION"
          ? `${g.players[current]?.nickname} 選擇偷竊對象`
          : g.phase === "PRIVATE_RESULT"
            ? `${g.players[current]?.nickname} 正在查看私人情報`
            : myTurn
              ? "輪到你了 · 出牌或換牌"
              : `輪到 ${g.players[current]?.nickname}`;
  const closePanel = () => {
    setPanel(null);
    setRevealed(false);
  };
  return (
    <div className="mine-game">
      <header className="mine-heading">
        <div>
          <span>INTO THE MINE</span>
          <h2>
            <Pickaxe size={21} />
            矮人礦坑 2
          </h2>
        </div>
        <nav>
          <button aria-label="礦坑規則" onClick={() => setPanel("help")}>
            <BookOpen size={19} />
          </button>
          <button aria-label="礦坑紀錄" onClick={() => setPanel("history")}>
            <History size={19} />
          </button>
          <strong>第 {g.round} / 3 輪</strong>
        </nav>
      </header>
      <div
        className={`mine-turn ${myTurn ? "mine-my-turn" : ""}`}
        role="status"
      >
        <span>{phaseText}</span>
        <small>
          <Layers size={13} />
          {g.drawCount} 張
        </small>
      </div>
      {!connected && (
        <p className="mine-warning">
          目前離線；座位與手牌已保留，連線後可繼續。
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="mine-players">
        {g.order.map((id, i) => {
          const p = g.players[id];
          return (
            <button
              key={id}
              data-mine-player={id}
              className={`mine-player ${id === current ? "active" : ""}`}
              aria-label={`${p.nickname}，${p.handCount} 張牌${pathBlocked(p) ? "，不能蓋路" : ""}`}
              onClick={() => setInspect(`player:${id}`)}
            >
              <span>
                <i className={`mine-avatar mine-avatar-${i % 4}`}>
                  {p.nickname.slice(0, 1)}
                </i>
                <b>
                  {p.nickname}
                  {id === uid ? " · 你" : ""}
                </b>
                {!room.players[id]?.isBot &&
                  !Object.keys(presence[id]?.connections ?? {}).length && (
                    <em title="離線">◌</em>
                  )}
              </span>
              <small className="mine-player-inventory">
                <HandCount count={p.handCount} />
                <EffectIcons effects={Object.keys(p.effects) as Effect[]} />
                {p.hasGold && (
                  <span
                    className="mine-has-gold"
                    role="img"
                    aria-label="持有金塊"
                  >
                    <GoldArt size={24} />
                  </span>
                )}
              </small>
            </button>
          );
        })}
      </div>
      <MineBoard
        game={g}
        uid={uid}
        cardId={selected?.kind === "path" ? selected.id : undefined}
        rotation={rotation}
        chosen={chosen}
        onChoose={setChosen}
        onInspect={setInspect}
      />
      {selected?.kind === "path" ? (
        <div className="mine-placement">
          <span>
            <strong>{selected.name}</strong>
            <small>
              {pathBlocked(me)
                ? "不能蓋路，請先解除狀態"
                : (pathError ??
                  (chosen ? `預覽 ${chosen.x},${chosen.y}` : "點選亮起的格子"))}
            </small>
          </span>
          <button
            aria-label="旋轉道路 180 度"
            onClick={() => setRotation((r) => (r === 0 ? 180 : 0))}
          >
            <RotateCw size={19} />
            {rotation}°
          </button>
          <button
            className="mine-primary"
            disabled={!primary || !chosen || !!pathError}
            onClick={() =>
              chosen &&
              send({
                type: "minePath",
                cardId: selected.id,
                ...chosen,
                rotation,
              })
            }
          >
            <Check size={17} />
            蓋路
          </button>
          <button
            aria-label="取消選牌"
            onClick={() => {
              setDraft(null);
              setChosen(null);
            }}
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <div className="mine-bottom">
          <div className="mine-own-info">
            <button
              onClick={() => {
                setRevealed(false);
                setPanel("role");
              }}
            >
              <HardHat size={17} />
              {own.roleVersion > seenRole ? "身份已更新" : "查看身份"}
            </button>
            <span>
              <GoldArt size={30} />
              <b>{own.gold}</b>
              <small>僅自己可見</small>
            </span>
            <EffectIcons effects={Object.keys(me.effects) as Effect[]} />
            <button
              aria-label="查看私人情報"
              onClick={() => setPanel("knowledge")}
            >
              <Eye size={18} />
            </button>
          </div>
          <div className="mine-hand-summary">
            {own.hand.map((id, i) => (
              <button
                key={id}
                className="mine-mini-card"
                aria-label={`選擇手牌 ${i + 1}：${MINE_CARD_BY_ID[id].name}`}
                disabled={!primary}
                onClick={() => select(id)}
              >
                <HandCard card={MINE_CARD_BY_ID[id]} />
              </button>
            ))}
            {!own.hand.length && <small>沒有手牌，剩餘回合自動略過</small>}
          </div>
          <div className="mine-bottom-actions">
            <button onClick={() => setPanel("hand")}>
              <Layers size={17} />
              手牌 {own.hand.length}
            </button>
            <button
              disabled={!primary}
              onClick={() => {
                setDiscard([]);
                setEffect("");
                setPanel("discard");
              }}
            >
              換牌 / 解除狀態
            </button>
            {(g.result || g.aborted) && (
              <button onClick={() => setDismissedResult("")}>
                <Trophy size={17} />
                結算
              </button>
            )}
          </div>
        </div>
      )}
      {panel && !showVictory && (
        <GameDialog
          title={
            {
              hand: "我的手牌",
              role: "私人身份",
              help: "礦坑冒險指南",
              history: "礦坑紀錄",
              discard: "換牌 / 解除狀態",
              knowledge: "我的私人情報",
            }[panel]
          }
          className="mine-dialog"
          onClose={closePanel}
        >
          {panel === "hand" && (
            <>
              <p>點道路牌後，在棋盤選位置並確認；行動牌會列出合法目標。</p>
              <div className="mine-hand-grid">
                {own.hand.map((id) => (
                  <button
                    key={id}
                    disabled={!primary}
                    onClick={() => select(id)}
                  >
                    <HandCard card={MINE_CARD_BY_ID[id]} />
                  </button>
                ))}
              </div>
            </>
          )}
          {panel === "role" &&
            (revealed ? (
              <div className="mine-role">
                <RolePortrait role={own.role} />
                <h3>{DWARF_ROLE_NAMES[own.role]}</h3>
                <p>{DWARF_ROLE_HELP[own.role]}</p>
                <p>被困住時無法蓋路，也不能在輪末領金或偷竊。</p>
                <button onClick={closePanel}>藏好身份</button>
              </div>
            ) : (
              <div className="mine-role">
                <LockKeyhole size={52} />
                <p>確認旁邊沒有人偷看，再揭開你的身份。</p>
                <button
                  className="mine-primary"
                  onClick={() => {
                    setRevealed(true);
                    setSeenRole(own.roleVersion);
                  }}
                >
                  揭開我的身份
                </button>
              </div>
            ))}
          {panel === "help" && (
            <div className="mine-help">
              <p>
                <b>三輪比金塊</b> · 每輪重新發身份、6 張手牌，偷偷移除 10
                張。累積金塊最多者勝出，同分共享勝利。
              </p>
              <p>
                <b>每回合選一種</b>：蓋 1 張道路、出 1 張行動牌、棄 2 張解除自己
                1 個狀態，或棄 1–3 張換牌。一般出牌補 1
                張，換牌補相同張數；沒牌堆就不補。
              </p>
              <p>
                <b>道路</b> · 只能旋轉
                180°，所有相鄰邊緣必須相符，且至少一條隧道接回入口。橋梁、雙彎道的兩條路彼此不通。梯子直接連回入口，但不能貼著目標。
              </p>
              <p>
                <b>色門</b> ·
                藍門阻擋綠隊、綠門阻擋藍隊。仍可在門後蓋路。點道路可放大查看圖示。
              </p>
              <p>
                <b>不能蓋路？</b> ·
                查看頭像下的紅色工具／鎖圖示。可用修復、自由，或棄兩張解除一個狀態。陷阱也會讓你無法領金。
              </p>
              <p>
                <b>結算</b> · 找到黃金或大家手牌用盡時結算。勝者 1／2／3／4／5+
                人分別領 5／4／3／2／1 金；工頭少 1、奸商少
                2。地質學家另算所有場上水晶，受困者除外。
              </p>
              <p>
                <b>找到黃金</b> ·
                由藍／綠挖金矮人接通時，該隊若可通行便獨贏；該隊受門阻擋則另一可通行隊獲勝。其他身份接通時，所有可通行隊伍勝出。工頭與奸商仍可通過所有門。
              </p>
              <p>
                <b>偷竊</b> ·
                發金後，最後打出偷竊的人先選，再依座位順時針。每人偷另一人 1
                金，三輪偷竊完才揭曉總分。
              </p>
            </div>
          )}
          {panel === "history" && (
            <ol className="mine-log">
              {g.activities
                .slice()
                .reverse()
                .map((a) => (
                  <li key={a.revision}>
                    <b>{g.players[a.uid]?.nickname}</b> {a.text}
                  </li>
                ))}
            </ol>
          )}
          {panel === "knowledge" && (
            <>
              <p>只有你能讀取；偵查是當時的身份，更換身份後不會更新舊情報。</p>
              {Object.entries(own.goals).map(([k, v]) => (
                <p key={k}>
                  {GOAL_KEYS.indexOf(k) + 1} 號目標：
                  {v === "GOLD" && <GoldArt size={35} />}
                  <b>{v === "GOLD" ? "黃金" : "岩石"}</b>
                </p>
              ))}
              {own.inspections.map((i, n) => (
                <p key={n}>
                  {g.players[i.uid]?.nickname}：{DWARF_ROLE_NAMES[i.role]}{" "}
                  <small>（操作 {i.revision} 時）</small>
                </p>
              ))}
              {!Object.keys(own.goals).length && !own.inspections.length && (
                <p>還沒有取得私人情報。</p>
              )}
            </>
          )}
          {panel === "discard" && (
            <>
              <p>選 1–3 張換牌；選 2 張也可解除自己一個狀態，再補 1 張。</p>
              <div className="mine-hand-grid">
                {own.hand.map((id) => (
                  <button
                    key={id}
                    aria-pressed={discard.includes(id)}
                    onClick={() =>
                      setDiscard((v) =>
                        v.includes(id)
                          ? v.filter((k) => k !== id)
                          : v.length < 3
                            ? [...v, id]
                            : v,
                      )
                    }
                  >
                    <HandCard card={MINE_CARD_BY_ID[id]} />
                  </button>
                ))}
              </div>
              <label>
                解除的狀態
                <select
                  value={effect}
                  onChange={(e) => setEffect(e.target.value as Effect | "")}
                >
                  <option value="">只換牌</option>
                  {(Object.keys(me.effects) as Effect[]).map((e) => (
                    <option key={e} value={e}>
                      {EFFECT_NAMES[e]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="mine-primary"
                disabled={
                  !primary ||
                  (effect ? discard.length !== 2 : discard.length < 1)
                }
                onClick={() =>
                  send(
                    effect
                      ? { type: "mineClean", cards: discard, effect }
                      : { type: "minePass", cards: discard },
                  )
                }
              >
                確認{effect ? "解除狀態" : `換 ${discard.length} 張牌`}
              </button>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </GameDialog>
      )}
      {selected?.kind === "action" && !showVictory && (
        <GameDialog
          title={selected.name}
          className="mine-dialog"
          onClose={() => setDraft(null)}
        >
          <div className="mine-action-preview">
            <div className="mine-action-large">
              <ActionIllustration card={selected} />
            </div>
            <p>{ACTION_HELP[selected.action]}</p>
          </div>
          <div className="mine-targets">
            {targets.map((id) => (
              <button
                key={id}
                aria-pressed={target === id}
                onClick={() => {
                  setTarget(id);
                  setTool("");
                }}
              >
                {g.players[id] ? (
                  <>
                    <HardHat size={20} />
                    {g.players[id].nickname}
                    <EffectIcons
                      effects={Object.keys(g.players[id].effects) as Effect[]}
                    />
                  </>
                ) : selected.action === "MAP" ? (
                  `${GOAL_KEYS.indexOf(id) + 1} 號目標`
                ) : (
                  <>
                    <span className="mine-target-tile">
                      <TunnelArt tile={g.board[id]} />
                    </span>
                    {MINE_CARD_BY_ID[g.board[id].cardId].name} ({g.board[id].x},
                    {g.board[id].y})
                  </>
                )}
              </button>
            ))}
          </div>
          {!targets.length && <p>目前沒有合法目標，可以換牌或選別張牌。</p>}
          {selected.action === "REPAIR" && target && (
            <label>
              修復工具
              <select
                value={tool}
                onChange={(e) => setTool(e.target.value as Tool)}
              >
                <option value="">選一種工具</option>
                {selected
                  .tools!.filter((t) => me && g.players[target]?.effects[t])
                  .map((t) => (
                    <option key={t} value={t}>
                      {EFFECT_NAMES[t]}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            className="mine-primary"
            disabled={
              !primary ||
              !targets.includes(target) ||
              (selected.action === "REPAIR" && !tool)
            }
            onClick={() =>
              send({
                type: "mineAction",
                cardId: selected.id,
                ...(selected.action === "MAP" || selected.action === "ROCKFALL"
                  ? { cell: target }
                  : { target }),
                ...(tool ? { tool } : {}),
              })
            }
          >
            確認使用
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </GameDialog>
      )}
      {inspect && !showVictory && (
        <GameDialog
          title={inspect.startsWith("player:") ? "矮人狀態" : "礦道詳情"}
          className="mine-dialog"
          onClose={() => setInspect(null)}
        >
          {inspect.startsWith("player:")
            ? (() => {
                const p = g.players[inspect.slice(7)];
                return (
                  <>
                    <h3>{p.nickname}</h3>
                    <p>
                      <HandCount count={p.handCount} /> ·{" "}
                      {p.hasGold ? "持有金塊" : "沒有金塊"}
                    </p>
                    <EffectIcons effects={Object.keys(p.effects) as Effect[]} />
                    <p>
                      {pathBlocked(p)
                        ? "目前不能蓋路；仍可使用行動牌或換牌。"
                        : "可以放置道路。"}
                    </p>
                    {(Object.keys(p.effects) as Effect[]).map((e) => (
                      <p key={e}>
                        {EFFECT_NAMES[e]}
                        {e === "TRAPPED" ? "：輪末無法領金或偷竊" : ""}
                      </p>
                    ))}
                  </>
                );
              })()
            : (() => {
                const t = g.board[inspect];
                if (!t) return <p>這張道路已被移除。</p>;
                const c = MINE_CARD_BY_ID[t.cardId];
                return (
                  <>
                    <div className="mine-large-tile">
                      <TunnelArt tile={t} />
                    </div>
                    <p>{c?.name ?? (t.type === "start" ? "入口" : "目標")}</p>
                    {c?.kind === "path" && (
                      <p>
                        {c.special === "BRIDGE"
                          ? "兩条直線礦道交叉，但不能在橋上轉彎。"
                          : c.special === "DOUBLE_BEND"
                            ? "兩條彎曲礦道各自獨立。"
                            : c.ladder
                              ? "梯子直接通往入口，不能放在目標旁。"
                              : c.door
                                ? `${c.door === "BLUE" ? "藍" : "綠"}門只允許同色挖金矮人通過，不阻止蓋路。`
                                : "亮色礦道相接才能通行。"}
                        {c.crystalCount ? ` · ${c.crystalCount} 顆水晶` : " "}
                      </p>
                    )}
                  </>
                );
              })()}
        </GameDialog>
      )}
      {myTurn && g.phase === "PRIVATE_RESULT" && own.notice && (
        <GameDialog
          title={own.notice.title}
          className="mine-dialog"
          onClose={() => {}}
          dismissible={false}
        >
          <Eye size={40} />
          {own.notice.title === "偵查情報" ? (
            <>
              <h3>
                {g.players[own.notice.text]?.nickname}：
                {DWARF_ROLE_NAMES[own.inspections.at(-1)!.role]}
              </h3>
              <RolePortrait role={own.inspections.at(-1)!.role} />
              <p>這是此刻的身份，更換身份後可能失效。</p>
            </>
          ) : (
            <>
              <div className="mine-private-discovery">
                {own.notice.text.includes("黃金") && <GoldArt size={90} />}
              </div>
              <h3>{own.notice.text}</h3>
            </>
          )}
          <button
            className="mine-primary"
            disabled={!ready}
            onClick={() => send({ type: "mineAcknowledge" })}
          >
            記住並關閉
          </button>
          {error && <p role="alert">{error}</p>}
        </GameDialog>
      )}
      {showVictory && g.result && (
        <RoundVictory
          result={g.result}
          round={g.round}
          onContinue={() => {
            setPanel(null);
            setInspect(null);
            setDraft(null);
            setVictorySeen(true);
          }}
        />
      )}
      {showResult && (
        <GameDialog
          title={
            g.phase === "GAME_OVER" ? "礦坑最終結果" : `第 ${g.round} 輪結算`
          }
          className="mine-dialog"
          onClose={() => setDismissedResult(resultKey)}
        >
          <div className="mine-result">
            <Trophy size={38} />
            <h3>
              {g.aborted
                ? "玩家離席，本局中止"
                : g.phase === "GAME_OVER"
                  ? `${(g.winners ?? []).map((id) => g.players[id].nickname).join("、")} 勝出`
                  : g.result?.reason === "TREASURE_REACHED"
                    ? "找到黃金！"
                    : "手牌用盡，未找到黃金"}
            </h3>
          </div>
          {g.result && (
            <>
              <p className="mine-round-winner">
                {roundPresentation(g.result).title}
              </p>
              <p className="mine-crystal-total">
                <CrystalArt size={38} />
                場上水晶 <b>{g.result.crystals}</b> 顆
              </p>
              <table className="mine-scores">
                <thead>
                  <tr>
                    <th>玩家 / 身份</th>
                    <th>本輪</th>
                    {g.totals && <th>總金塊</th>}
                  </tr>
                </thead>
                <tbody>
                  {g.order.map((id) => (
                    <tr key={id}>
                      <th>
                        {g.players[id].nickname}
                        <small>
                          {DWARF_ROLE_NAMES[g.result!.roles[id]]}
                          {g.result!.trapped.includes(id) ? " · 受困" : ""}
                        </small>
                      </th>
                      <td>
                        <span className="mine-gold-amount">
                          <GoldArt size={26} />+{g.result!.awards[id]}
                        </span>
                      </td>
                      {g.totals && (
                        <td>
                          {g.totals[id]}
                          {g.winners?.includes(id) ? " ★" : ""}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {g.phase === "THEFT_RESOLUTION" && (
            <>
              <p>
                {myTurn
                  ? "選擇一位玩家偷走 1 金塊"
                  : `等待 ${g.players[current]?.nickname} 選擇偷竊對象`}
              </p>
              {myTurn && (
                <div className="mine-targets">
                  {g.order
                    .filter((id) => id !== uid && g.players[id].hasGold)
                    .map((id) => (
                      <button
                        key={id}
                        disabled={!ready}
                        onClick={() => send({ type: "mineSteal", target: id })}
                      >
                        <GoldArt size={28} />
                        {g.players[id].nickname} · 偷 1 金
                      </button>
                    ))}
                </div>
              )}
            </>
          )}
          {g.phase === "ROUND_RESULT" &&
            (room.hostId === uid ? (
              <button
                className="mine-primary"
                disabled={!ready}
                onClick={() => send({ type: "mineNext" })}
              >
                開始第 {g.round + 1} 輪
              </button>
            ) : (
              <p>等待房主開始下一輪</p>
            ))}
          {g.phase === "GAME_OVER" && room.hostId === uid && (
            <button
              className="mine-primary"
              disabled={roomPending || !connected}
              onClick={onRematch}
            >
              再開一局
            </button>
          )}
          {error && <p role="alert">{error}</p>}
        </GameDialog>
      )}
    </div>
  );
}
