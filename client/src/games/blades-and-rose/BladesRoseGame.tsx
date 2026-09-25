import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, Eye, LockKeyhole } from "lucide-react";
import type { Room } from "../../../../functions/src/shared/model";
import {
  CRYSTALS,
  PLAYER_COUNT_RULES,
  ROSE_CARDS,
  canSubmitRose,
  type RoseAction,
  type RoseCard,
  type RosePrivate,
} from "../../../../functions/src/shared/bladesRose";
import { roseAction } from "../../firebase/api";
import { useAction } from "../../hooks/useAction";
import { GameDialog } from "../../components/GameDialog";
import { BladesRoseCard } from "./BladesRoseCard";
import "./bladesRose.css";

export function BladesRoseGame({
  room,
  uid,
  privateData: p,
  connected,
  onRematch,
  roomPending,
}: {
  room: Room;
  uid: string;
  privateData: RosePrivate | null;
  connected: boolean;
  onRematch: () => void;
  roomPending: boolean;
}) {
  const { pending, error, run } = useAction();
  const [view, setView] = useState<"help" | "private" | null>(null);
  const [selected, setSelected] = useState<RoseCard | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [fast, setFast] = useState(false);
  const [flight, setFlight] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const g = room.rose;
  if (!g || !p) return <p role="status">正在連接私人牌庫，你的座位已保留…</p>;
  const synchronized = p.revision === g.revision;
  const blocked = pending || !connected || !synchronized;
  const myTurn = g.current === uid;
  const name = (id: string) => room.players[id]?.nickname ?? "已離席玩家";
  const rules = PLAYER_COUNT_RULES[g.order.length];
  const result = g.history.at(-1);
  const duration = reduced ? 0 : fast ? 0.25 : 0.65;
  const send = (action: RoseAction) =>
    void run(async () => {
      await roseAction(room.code, g, action);
      if (
        (action.type === "roseDecide" && action.cardId) ||
        action.type === "roseReplaceCard"
      )
        setFlight(g.revision);
      setSelected(null);
      setTargets([]);
    });
  const targetMode = g.phase === "TARGET" && myTurn;
  const coinMode = g.phase === "COIN" && myTurn;
  const replacement = g.phase === "REPLACE_TARGET" && myTurn;
  const validTargets = coinMode
    ? g.order.filter((id) => id !== uid && !g.players[id].crystalUsed)
    : replacement
      ? p.replacementTargets
      : targetMode
        ? g.order.filter((id) =>
            g.crystal === 7 ? id !== uid : g.players[id].handCount > 0,
          )
        : [];
  const required = g.crystal === 5 ? 2 : 1;
  const canPlay =
    myTurn && (g.phase === "DECISIONS" || g.phase === "REPLACE_CARD");
  const phaseText: Record<string, string> = {
    NIGHT: "夜幕降臨 · 確認你的身分",
    COIN: "自由討論 · 選擇下一位持幣者",
    CRYSTAL: "白水晶 · 等待持幣者啟封",
    TARGET: "白水晶 · 指定效果對象",
    PEEK: "祕密視界 · 等待查看完成",
    DECISIONS: "獻上抉擇 · 依序蓋牌或跳過",
    REPLACE_TARGET: "命運改寫 · 決定是否換牌",
    REPLACE_CARD: "命運改寫 · 選擇替換手牌",
    ROUND_RESULT: "儀式落幕 · 回合結算",
    GAME_OVER: "終章 · 命運已定",
  };
  return (
    <section
      className={`br-table ${fast ? "br-fast" : ""}`}
      style={{ "--br-motion": `${duration}s` } as CSSProperties}
    >
      {flight !== null && (
        <motion.div
          className="br-flight"
          key={flight}
          initial={{
            opacity: 1,
            y: reduced ? 0 : 180,
            scale: 0.9,
            rotate: reduced ? 0 : -8,
          }}
          animate={{
            opacity: [1, 1, 0],
            y: reduced ? 0 : -150,
            scale: 0.45,
            rotate: 0,
          }}
          transition={{ duration: reduced ? 0 : fast ? 0.4 : 0.9 }}
          onAnimationComplete={() => setFlight(null)}
          aria-hidden="true"
        >
          <BladesRoseCard />
        </motion.div>
      )}
      <header className="br-heading">
        <div>
          <p className="br-kicker">THE MIDNIGHT RITUAL</p>
          <h2>血與刃的白薔薇</h2>
          <p>BLADES & ROSE</p>
        </div>
        <div className="br-tools">
          <button onClick={() => setView("private")}>
            <Eye size={16} />
            私密情報
          </button>
          <button onClick={() => setView("help")} aria-label="魔法之書與規則">
            <BookOpen size={17} />
          </button>
          <label>
            <input
              type="checkbox"
              checked={fast}
              onChange={(e) => setFast(e.target.checked)}
            />
            快速動畫
          </label>
        </div>
      </header>
      <div className="br-roundline">
        <span>
          儀式 {g.round || "序"} / {g.order.length}
        </span>
        <span>◈ {name(g.coin)} 持幣</span>
        <span>
          水晶 {Object.values(g.players).filter((x) => x.crystalUsed).length} /{" "}
          {g.order.length}
        </span>
      </div>
      <div className="br-tracks">
        <div className="br-track">
          <small>WHITE ROSE · 獻祭</small>
          <strong>
            ❀ {g.safeBuds}
            <span> / {rules.requiredSafeBuds}</span>
          </strong>
          <div className="br-pips">
            {Array.from({ length: rules.requiredSafeBuds ?? 0 }, (_, i) => (
              <i key={i} className={i < g.safeBuds ? "filled" : ""} />
            ))}
          </div>
          <p>{g.safeRose ? "白薔薇已安全獻祭" : "等待白薔薇獻祭"}</p>
        </div>
        <div className="br-track br-blood">
          <small>BLOOD BLADE · 擊殺</small>
          <strong>
            ⚔ {g.deadBuds}
            <span> / {rules.bloodKillThreshold}</span>
          </strong>
          <div className="br-pips">
            {Array.from({ length: rules.bloodKillThreshold ?? 0 }, (_, i) => (
              <i key={i} className={i < g.deadBuds ? "filled" : ""} />
            ))}
          </div>
          <p>{g.deadRose ? "白薔薇已遭擊殺" : "血刃潛藏於夜色"}</p>
        </div>
      </div>
      <div className="br-altar">
        <div className="br-orbit" aria-hidden="true" />
        <AnimatePresence mode="wait">
          <motion.div
            className="br-phase"
            key={`${g.round}-${g.phase}`}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration / 2 }}
          >
            <p className="br-kicker">{phaseText[g.phase]}</p>
            {g.crystal && (
              <div className="br-active-crystal">
                <span className="br-crystal">{g.crystal}</span>
                <div>
                  <h3>{CRYSTALS[g.crystal].title}</h3>
                  <p>{CRYSTALS[g.crystal].text}</p>
                </div>
              </div>
            )}
            {g.phase === "NIGHT" && (
              <div className="br-night">
                <span>☾</span>
                <p>請私下確認身分、白水晶與夜晚情報。</p>
                <button
                  disabled={blocked || p.acknowledged}
                  onClick={() => setView("private")}
                >
                  {p.acknowledged ? "已確認，等待其他玩家" : "查看我的身分"}
                </button>
              </div>
            )}
            {g.phase === "COIN" && (
              <p>
                {myTurn
                  ? "與夥伴討論後，點選下方座位傳遞金幣。"
                  : `等待 ${name(g.current)} 傳遞金幣。`}
              </p>
            )}
            {g.phase === "CRYSTAL" && (
              <button
                className="br-seal"
                disabled={blocked || !myTurn}
                onClick={() => send({ type: "roseCrystal" })}
              >
                <span className="br-crystal">◇</span>
                {myTurn ? "啟封我的白水晶" : `等待 ${name(g.current)} 啟封`}
              </button>
            )}
            {g.phase === "TARGET" && (
              <p>
                {myTurn
                  ? `點選 ${required} 位玩家${required === 2 ? "，先選 A，再選 B" : ""}。`
                  : `等待 ${name(g.current)} 指定對象。`}
              </p>
            )}
            {g.phase === "DECISIONS" && (
              <>
                <h3>
                  {myTurn
                    ? "輪到你做出抉擇"
                    : `等待 ${name(g.current)} 做出抉擇`}
                </h3>
                <p>
                  已完成{" "}
                  {Object.values(g.players).filter((x) => x.ready).length} /{" "}
                  {g.order.length} 位
                </p>
                <div className="br-offerings">
                  {g.order
                    .filter((id) => g.players[id].ready)
                    .map((id) => (
                      <motion.div
                        key={id}
                        initial={{
                          opacity: 0,
                          y: reduced ? 0 : 55,
                          rotate: reduced ? 0 : -8,
                        }}
                        animate={{ opacity: 1, y: 0, rotate: 0 }}
                        transition={{ duration }}
                      >
                        <BladesRoseCard />
                      </motion.div>
                    ))}
                </div>
                <small>每個蓋牌標記代表已決定，並不表示該玩家有出牌。</small>
              </>
            )}
            {g.phase === "PEEK" && (
              <p>
                {myTurn
                  ? "你看見了命運的一角。請查看私人視窗。"
                  : "等待私密情報確認。"}
              </p>
            )}
            {g.phase === "REPLACE_TARGET" && (
              <>
                <p>
                  {myTurn
                    ? "可指定一位玩家換牌，或保留所有決定。"
                    : `等待 ${name(g.current)} 決定是否改寫命運。`}
                </p>
                {myTurn && (
                  <button
                    disabled={blocked}
                    onClick={() => send({ type: "roseReplaceTarget" })}
                  >
                    不使用換牌能力
                  </button>
                )}
              </>
            )}
            {g.phase === "REPLACE_CARD" && (
              <p>
                {myTurn
                  ? "請從手牌選一張替換；原本出牌將回到手中。"
                  : `等待 ${name(g.current)} 換牌。`}
              </p>
            )}
            {(g.phase === "ROUND_RESULT" || g.phase === "GAME_OVER") &&
              result && (
                <div
                  className={`br-result ${result.killed ? "is-blood" : ""}`}
                  key={`reveal-${result.round}`}
                >
                  {result.crystal !== 2 && result.cards.length > 1 && (
                    <div className="br-shuffle" aria-hidden="true">
                      <BladesRoseCard />
                      <BladesRoseCard />
                      <BladesRoseCard />
                    </div>
                  )}
                  <div className="br-reveal">
                    {result.cards.map((c, i) => (
                      <div
                        className="br-reveal-item"
                        key={c.revealId}
                        style={
                          {
                            "--reveal-delay": `${reduced ? 0 : (fast ? 0.05 : 0.1) * i + (fast ? 0.2 : 0.7)}s`,
                          } as CSSProperties
                        }
                      >
                        <BladesRoseCard type={c.type} />
                        {c.sourceUid && <small>{name(c.sourceUid)}</small>}
                      </div>
                    ))}
                  </div>
                  <p>
                    {result.cards.length === 0
                      ? "祭壇空無一物。"
                      : `${result.killed ? "血刃現身，花朵遭到擊殺" : "未見血刃，花朵安全獻祭"} · ${result.buds} 朵花苞${result.rose ? " · 白薔薇" : ""}`}
                  </p>
                  <small>
                    {result.crystal === 2
                      ? "水晶 2：依序揭示出牌者"
                      : "本輪已匿名洗牌"}
                  </small>
                </div>
              )}
            {g.phase === "ROUND_RESULT" && myTurn && (
              <button
                disabled={blocked}
                onClick={() => send({ type: "roseContinue" })}
              >
                繼續討論與傳幣
              </button>
            )}
            {g.phase === "GAME_OVER" && (
              <div className="br-ending">
                <p className="br-kicker">
                  {g.aborted ? "RITUAL INTERRUPTED" : "THE FINAL PETAL"}
                </p>
                <h2>
                  {g.aborted
                    ? "儀式中止"
                    : g.winner === "WHITE_ROSE"
                      ? "白薔薇陣營獲勝"
                      : "血刃陣營獲勝"}
                </h2>
                <p>{g.reason}</p>
                {g.roles && (
                  <div className="br-final-roles">
                    {g.order.map((id) => (
                      <span key={id}>
                        {name(id)} · {ROSE_CARDS[g.roles![id]].name}
                      </span>
                    ))}
                  </div>
                )}
                {room.hostId === uid && (
                  <button
                    disabled={roomPending || !connected}
                    onClick={onRematch}
                  >
                    回到房間，再開一局
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="br-seats" aria-label="玩家座位">
        {g.order.map((id, i) => (
          <button
            key={id}
            disabled={blocked || !validTargets.includes(id)}
            className={`br-seat ${g.current === id ? "is-current" : ""} ${targets.includes(id) ? "is-selected" : ""}`}
            onClick={() => {
              if (coinMode) send({ type: "roseCoin", target: id });
              else if (replacement)
                send({ type: "roseReplaceTarget", target: id });
              else
                setTargets((previous) =>
                  previous.includes(id)
                    ? previous.filter((x) => x !== id)
                    : [...previous, id].slice(-required),
                );
            }}
          >
            <span className="br-seat-top">
              {g.coin === id ? (
                <motion.span
                  layoutId={`rose-coin-${g.id}`}
                  className="br-coin"
                  transition={{ duration }}
                >
                  ❀
                </motion.span>
              ) : (
                <span className="br-seat-number">{i + 1}</span>
              )}
              <span>
                {name(id)}
                {id === uid ? "（你）" : ""}
              </span>
            </span>
            <small>
              {g.players[id].ready
                ? "已決定"
                : `${g.players[id].handCount} 張手牌`}{" "}
              · {g.players[id].crystalUsed ? "水晶已用" : "◇ 未用"}
            </small>
            {targets.includes(id) && (
              <b>{targets.indexOf(id) === 0 ? "A" : "B"}</b>
            )}
          </button>
        ))}
      </div>
      {targetMode && (
        <button
          className="br-confirm"
          disabled={blocked || targets.length !== required}
          onClick={() => send({ type: "roseTarget", targets })}
        >
          確認指定對象
        </button>
      )}
      {g.phase !== "GAME_OVER" && (
        <div className="br-personal">
          <div className="br-personal-heading">
            <span>
              <LockKeyhole size={14} />
              你的手牌 · 僅自己可見
            </span>
            <button onClick={() => setView("private")}>
              <span className="br-crystal br-mini">◇</span>我的白水晶
            </button>
          </div>
          <div className="br-hand">
            {p.hand.map((c, i) => (
              <motion.div
                layout
                key={c.id}
                style={
                  {
                    "--fan": `${(i - (p.hand.length - 1) / 2) * 4}deg`,
                  } as CSSProperties
                }
                initial={{ opacity: 0, y: reduced ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration }}
              >
                <BladesRoseCard
                  type={c.type}
                  selected={selected?.id === c.id}
                  onClick={() => setSelected(c)}
                />
              </motion.div>
            ))}
          </div>
          {p.hand.length === 0 && (
            <p>手牌已全部獻出，仍可參與討論與水晶儀式。</p>
          )}
          {canPlay && (
            <div className="br-decision">
              <p>
                {p.constraint.mustPlay
                  ? "白水晶效果：本輪你必須出牌"
                  : p.constraint.mustPass
                    ? "命運繫結：A 已跳過，本輪你也必須跳過"
                    : p.constraint.lockedCardId
                      ? "白水晶效果：本輪只能打出指定手牌，或跳過"
                      : "點選手牌查看，再確認蓋牌打出。"}
              </p>
              {g.phase === "DECISIONS" && (
                <button
                  disabled={blocked || !canSubmitRose(p)}
                  onClick={() => send({ type: "roseDecide" })}
                >
                  本輪跳過
                </button>
              )}
            </div>
          )}
          {p.decision && (
            <p className="br-locked">
              你的決定已封存 ·{" "}
              {p.decision === "PASS"
                ? "本輪跳過"
                : ROSE_CARDS[p.decision.type].name}
            </p>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!connected && <p role="status">連線中斷，重新連線後可從原座位繼續。</p>}
      <details className="br-history">
        <summary>儀式紀錄 · {g.history.length} 回合</summary>
        {g.history.map((r) => (
          <p key={r.round}>
            第 {r.round} 輪 · 水晶 {r.crystal} ·{" "}
            {r.cards
              .map(
                (c) =>
                  `${c.sourceUid ? name(c.sourceUid) + "：" : ""}${ROSE_CARDS[c.type].name}`,
              )
              .join("、") || "無人出牌"}{" "}
            · {r.killed ? "擊殺" : "獻祭"} {r.buds} 花苞
          </p>
        ))}
      </details>
      {selected && (
        <GameDialog
          title="查看手牌"
          className="br-dialog"
          onClose={() => setSelected(null)}
        >
          <div className="br-preview">
            <BladesRoseCard type={selected.type} />
            <p>{ROSE_CARDS[selected.type].text}</p>
          </div>
          <button
            disabled={
              blocked ||
              !canPlay ||
              !p.hand.some((c) => c.id === selected.id) ||
              (g.phase === "DECISIONS" && !canSubmitRose(p, selected.id))
            }
            onClick={() =>
              send(
                g.phase === "REPLACE_CARD"
                  ? { type: "roseReplaceCard", cardId: selected.id }
                  : { type: "roseDecide", cardId: selected.id },
              )
            }
          >
            {g.phase === "REPLACE_CARD" ? "以此牌替換" : "蓋牌打出"}
          </button>
          {p.constraint.lockedCardId &&
            selected.id !== p.constraint.lockedCardId && (
              <p>這張牌不是本輪被指定的手牌。</p>
            )}
        </GameDialog>
      )}
      {view === "private" && (
        <GameDialog
          title="私密情報 · 請勿展示螢幕"
          className="br-dialog"
          onClose={() => setView(null)}
        >
          <div className="br-identity">
            <BladesRoseCard type={p.identity} />
            <div>
              <h3>{ROSE_CARDS[p.identity].name}</h3>
              <p>{p.faction === "WHITE_ROSE" ? "白薔薇陣營" : "血刃陣營"}</p>
              <p>打出身分牌後，你的身分與陣營不變。</p>
            </div>
          </div>
          <h3>
            ◇ 白水晶 {p.crystal} · {CRYSTALS[p.crystal].title}
          </h3>
          <p>{CRYSTALS[p.crystal].text}</p>
          <p>發動前，不可明說水晶號碼與確切效果。</p>
          <h3>夜晚相認</h3>
          <p>
            {p.night.length
              ? p.night.map(name).join("、") +
                " 參與相認；你不知道他們的確切角色。"
              : "你未參與夜晚相認。"}
          </p>
          {p.identity === "DOUBLE_BLADE" && (
            <p>夜晚確認時，幽魂會祕密換成第二張雙刃。</p>
          )}
          {Object.entries(p.knownRoles).map(([id, role]) => (
            <p key={id}>
              暗刃情報：{name(id)} · {ROSE_CARDS[role].name}
            </p>
          ))}
          {g.phase === "NIGHT" && !p.acknowledged && (
            <button
              disabled={blocked}
              onClick={() =>
                void run(async () => {
                  await roseAction(room.code, g, { type: "roseNight" });
                  setView(null);
                })
              }
            >
              確認身分，完成夜晚儀式
            </button>
          )}
        </GameDialog>
      )}
      {p.peek && g.phase === "PEEK" && myTurn && (
        <GameDialog
          title="祕密視界 · 僅你可見"
          className="br-dialog"
          dismissible={false}
          onClose={() => {}}
        >
          <p>你在 {name(p.peek.target)} 的手中看見：</p>
          <div className="br-preview">
            <BladesRoseCard type={p.peek.type} />
          </div>
          <button disabled={blocked} onClick={() => send({ type: "rosePeek" })}>
            已看完，歸還手牌
          </button>
        </GameDialog>
      )}
      {view === "help" && (
        <GameDialog
          title="魔法之書"
          className="br-dialog br-book"
          onClose={() => setView(null)}
        >
          <h3>兩個陣營，一場儀式</h3>
          <p>
            白薔薇安全獻祭，並累積 {rules.requiredSafeBuds}{" "}
            朵安全花苞，白方獲勝。白薔薇與刀刃同輪揭示，或花苞擊殺達{" "}
            {rules.bloodKillThreshold}
            ，血刃獲勝。水晶耗盡時，白方手中若仍有花朵則落敗。
          </p>
          <p>
            每人起手為身分牌、信者與幽魂；雙刃在夜晚用幽魂換第二張雙刃。白薔薇、司教、双刃與巨刃在夜晚互認參與者，不知確切角色。
          </p>
          <p>
            持幣者選另一位未用水晶的玩家。新持幣者啟封水晶，依序出一張牌或跳過，所有決定鎖定後匿名洗牌揭示。有任何刀刃則本輪所有花朵死亡；幽魂不影響計分。
          </p>
          <p>
            可自由討論、虛張聲勢。水晶使用前不可明說號碼與效果。每人水晶限用一次，最多{" "}
            {g.order.length} 輪。
          </p>
          {Object.entries(CRYSTALS).map(([id, skill]) => (
            <p key={id}>
              <strong>
                {id}. {skill.title}
              </strong>
              <br />
              {skill.text}
            </p>
          ))}
        </GameDialog>
      )}
    </section>
  );
}
