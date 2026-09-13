import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  Crown,
  Eye,
  Fingerprint,
  Gem,
  Hand,
  LockKeyhole,
  Minus,
  Plus,
  Wallet as Pocket,
  RotateCcw,
  ShieldQuestion,
  Skull,
  Trophy,
  X,
} from "lucide-react";
import type { Room } from "../../../../functions/src/shared/model";
import {
  DEFAULT_MAFIA_CONFIG,
  MAFIA_HELP,
  MAFIA_ROLES,
  rightNeighbor,
} from "../../../../functions/src/shared/mafia";
import type {
  MafiaAction,
  MafiaBox,
  MafiaConfig,
  MafiaPrivate,
  MafiaPublicState,
  MafiaRole,
} from "../../../../functions/src/shared/mafia";
import { mafiaAction } from "../../firebase/api";
import { useAction } from "../../hooks/useAction";
import { GameDialog } from "../../components/GameDialog";
import { MafiaArt } from "./MafiaArt";
import "./mafia.css";

export function MafiaSettings({
  room,
  disabled,
  onChange,
}: {
  room: Room;
  disabled: boolean;
  onChange: (c: MafiaConfig) => void;
}) {
  const c = room.mafiaConfig ?? DEFAULT_MAFIA_CONFIG;
  return (
    <div className="mafia-settings">
      <MafiaArt kind="box" />
      <label>
        教父
        <select
          aria-label="選擇教父"
          disabled={disabled}
          value={
            c.godfatherSelection === "RANDOM"
              ? "RANDOM"
              : (c.godfatherId ?? room.hostId)
          }
          onChange={(e) =>
            onChange({
              ...c,
              godfatherSelection:
                e.target.value === "RANDOM" ? "RANDOM" : "HOST_SELECTS",
              ...(e.target.value !== "RANDOM"
                ? { godfatherId: e.target.value }
                : {}),
            })
          }
        >
          <option value="RANDOM">隨機選擇</option>
          {Object.values(room.players).map((p) => (
            <option key={p.uid} value={p.uid}>
              {p.nickname}
            </option>
          ))}
        </select>
      </label>
      <label className="mafia-toggle">
        <input
          type="checkbox"
          checked={c.cleanerEnabled}
          disabled={disabled}
          onChange={(e) => onChange({ ...c, cleanerEnabled: e.target.checked })}
        />
        清道夫 · 進階
      </label>
      <small>6–12 位玩家（可含 AI） · 更改設定後需重新準備</small>
    </div>
  );
}
export function MafiaGame(props: {
  room: Room;
  privateData: MafiaPrivate | null;
  uid: string;
  connected: boolean;
  onRematch: () => void;
  roomPending: boolean;
}) {
  return props.room.mafia ? (
    <MafiaTable key={props.room.mafia.id} {...props} game={props.room.mafia} />
  ) : (
    <p role="status">正在準備雪茄盒…</p>
  );
}
function MafiaTable({
  room,
  game: g,
  privateData,
  uid,
  connected,
  onRematch,
  roomPending,
}: {
  room: Room;
  game: MafiaPublicState;
  privateData: MafiaPrivate | null;
  uid: string;
  connected: boolean;
  onRematch: () => void;
  roomPending: boolean;
}) {
  const { run, pending, error } = useAction();
  const reduced = useReducedMotion();
  const [panel, setPanel] = useState<"box" | "role" | "help" | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [hidden, setHidden] = useState(0);
  const [receipt, setReceipt] = useState<{
    role: MafiaRole;
    diamonds: number;
  } | null>(null);
  const own = privateData?.gameId === g.id ? privateData : null;
  const father = uid === g.godfatherId,
    holder = uid === g.holderId;
  const passing = g.phase === "BOX_PASS";
  const box =
    holder &&
    (passing || g.phase === "INVESTIGATION" || g.phase === "ACCUSATION_PENDING")
      ? own?.currentBoxView
      : undefined;
  const locked = pending || !connected;
  const send = (a: MafiaAction, after?: () => void) =>
    void run(async () => {
      await mafiaAction(room.code, g, a);
      after?.();
    });
  useEffect(() => {
    if (g.phase !== "ACCUSATION_PENDING" || !g.pending || !connected) return;
    // Every member can resume a deadline after reconnect. Server time decides;
    // duplicate/stale resolver calls never change the result.
    const resolve = () => {
      if (Date.now() >= g.pending!.deadline)
        void mafiaAction(room.code, g, { type: "mafiaResolve" }).catch(
          () => {},
        );
    };
    const timer = setInterval(resolve, 1500);
    resolve();
    return () => clearInterval(timer);
  }, [g, connected, room.code]);
  const holderIndex = g.order.indexOf(g.holderId);
  const angle = (holderIndex / g.order.length) * Math.PI * 2 - Math.PI / 2;
  const last = (g.history ?? []).at(-1);
  return (
    <div className="mafia-game">
      <header className="mafia-heading">
        <div>
          <p className="eyebrow">HAVANA · 1955</p>
          <h2>一盒鑽石，滿桌秘密。</h2>
        </div>
        <button
          className="quiet icon-button"
          aria-label="遊戲玩法"
          onClick={() => setPanel("help")}
        >
          <ShieldQuestion />
        </button>
      </header>
      <div className="mafia-status" role="status">
        <span>
          <Crown size={17} />
          {g.seats[g.godfatherId].nickname}
        </span>
        <span title="已找回鑽石">
          <Gem size={17} />
          {g.recovered}
        </span>
        <span title="剩餘寬恕酒瓶">
          <MafiaArt kind="joker" />× {g.jokers}
        </span>
        <small>
          {g.phase === "GODFATHER_PREPARE_BOX"
            ? "準備雪茄盒"
            : passing
              ? "傳遞雪茄盒"
              : g.phase === "GAME_OVER"
                ? "真相揭曉"
                : "教父調查"}
        </small>
      </div>
      <div
        className={`mafia-table ${g.phase === "GAME_OVER" ? "is-finished" : ""}`}
        data-compact={g.order.length <= 8}
        aria-label="順時針座位；下一位是你的右手邊"
      >
        <div className="mafia-table-grain" />
        {g.order.map((id, i) => {
          const seat = g.seats[id],
            theta = (i / g.order.length) * Math.PI * 2 - Math.PI / 2;
          const accuse =
            father &&
            g.phase === "INVESTIGATION" &&
            id !== uid &&
            seat.alive &&
            !seat.revealed;
          return (
            <button
              key={id}
              className={`mafia-seat ${id === g.holderId ? "has-box" : ""} ${!seat.alive ? "eliminated" : ""} ${g.pending?.target === id ? "accused" : ""}`}
              style={{
                left: `${50 + 42 * Math.cos(theta)}%`,
                top: `${50 + 40 * Math.sin(theta)}%`,
              }}
              disabled={!accuse || locked}
              onClick={() => setTarget(id)}
              aria-label={`${seat.nickname}${seat.revealed && seat.role ? `，${MAFIA_ROLES[seat.role]}` : "，身分未揭曉"}${!seat.alive ? "，已出局" : ""}${accuse ? "，指控玩家" : ""}`}
            >
              <div className="mafia-portrait">
                {seat.revealed && seat.role ? (
                  <MafiaArt kind={seat.role} />
                ) : (
                  <Fingerprint />
                )}
                <b>{i + 1}</b>
                {!seat.alive && <Skull className="mafia-skull" />}
              </div>
              <strong>
                {seat.nickname}
                {id === uid && <small> · 你</small>}
              </strong>
              <small>
                {seat.revealed && seat.role
                  ? MAFIA_ROLES[seat.role]
                  : id === g.holderId && passing
                    ? "持盒中"
                    : "•••"}
              </small>
              {seat.diamonds !== undefined && seat.diamonds > 0 && (
                <span className="mafia-diamond-label">
                  <Gem size={12} />
                  {seat.diamonds}
                </span>
              )}
            </button>
          );
        })}
        <div className="mafia-table-center">
          <p className="eyebrow">LA FAMILIA</p>
          <span>
            {g.phase === "GODFATHER_PREPARE_BOX"
              ? "教父正在準備"
              : passing
                ? `${g.seats[g.holderId].nickname} 的回合`
                : g.phase === "ACCUSATION_PENDING"
                  ? "正在處理指控…"
                  : g.phase === "GAME_OVER"
                    ? "秘密不再是秘密"
                    : father
                      ? "選擇一位玩家調查"
                      : "誰拿走了鑽石？"}
          </span>
          <small>順時針傳遞 →</small>
        </div>
        {g.phase !== "GAME_OVER" && (
          <motion.div
            className="mafia-travelling-box"
            initial={false}
            animate={{
              left: `${50 + 25 * Math.cos(angle)}%`,
              top: `${50 + 25 * Math.sin(angle)}%`,
            }}
            transition={{ duration: reduced ? 0 : 1.1, ease: "easeInOut" }}
            aria-label={`雪茄盒在 ${g.seats[g.holderId].nickname} 手中`}
          >
            <MafiaArt kind="box" />
          </motion.div>
        )}
      </div>
      {g.phase === "GODFATHER_PREPARE_BOX" && father && (
        <section className="mafia-action-panel">
          <LockKeyhole />
          <span>秘密藏起</span>
          <Counter
            value={hidden}
            max={5}
            onChange={setHidden}
            disabled={locked}
          />
          <button
            className="primary"
            disabled={locked}
            onClick={() => send({ type: "mafiaPrepare", hidden })}
          >
            傳出雪茄盒 <ArrowRight size={18} />
          </button>
        </section>
      )}
      {passing && holder && !receipt && (
        <section className="mafia-action-panel">
          <LockKeyhole />
          <div>
            <strong>輪到你了</strong>
            <small>請確認只有你能看到螢幕</small>
          </div>
          <button
            className="primary"
            disabled={!box || locked}
            onClick={() => setPanel("box")}
          >
            <Eye size={18} />
            顯示雪茄盒
          </button>
        </section>
      )}
      {g.phase === "ACCUSATION_PENDING" && g.pending && (
        <section className="mafia-accusation" aria-live="polite">
          <Fingerprint />
          <strong>{g.seats[g.pending.target].nickname}</strong>
          <span>掏出口袋…</span>
          <Countdown deadline={g.pending.deadline} />
          {own?.role === "CLEANER" &&
            g.seats[uid].alive &&
            g.config.cleanerEnabled && (
              <div className="actions">
                {own.cleanerChoice ? (
                  <small>
                    <Check size={16} />
                    已秘密選擇
                  </small>
                ) : (
                  <>
                    <button
                      disabled={locked}
                      onClick={() =>
                        send({ type: "mafiaCleaner", choice: "PASS" })
                      }
                    >
                      放行
                    </button>
                    <button
                      className="danger"
                      disabled={locked}
                      onClick={() =>
                        send({ type: "mafiaCleaner", choice: "SHOOT" })
                      }
                    >
                      開槍攔截
                    </button>
                  </>
                )}
              </div>
            )}
        </section>
      )}
      {last && g.phase !== "ACCUSATION_PENDING" && g.phase !== "GAME_OVER" && (
        <motion.section
          key={last.revision}
          className="mafia-reveal"
          initial={{ opacity: 0, rotateY: reduced ? 0 : 90 }}
          animate={{ opacity: 1, rotateY: 0 }}
        >
          <MafiaArt kind={last.role} />
          <div>
            <strong>
              {g.seats[last.target].nickname} · {MAFIA_ROLES[last.role]}
            </strong>
            <p>
              {last.outcome === "THIEF"
                ? `找回 ${last.diamonds} 顆鑽石`
                : last.outcome === "JOKER"
                  ? "付出一瓶寬恕，繼續調查"
                  : last.outcome === "SHOT"
                    ? "槍聲響起，兩人出局"
                    : "指控已揭曉"}
            </p>
          </div>
          {last.outcome === "THIEF" ? <Gem /> : <MafiaArt kind="joker" />}
        </motion.section>
      )}
      {g.phase === "GAME_OVER" && <MafiaResults game={g} />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer className="mafia-toolbar">
        {own?.role && g.phase !== "GAME_OVER" && (
          <button onClick={() => setPanel("role")}>
            <Pocket size={18} />
            我的口袋
          </button>
        )}
        {father && box && !passing && (
          <button onClick={() => setPanel("box")}>
            <Eye size={18} />
            檢查雪茄盒
          </button>
        )}
        {g.phase === "GAME_OVER" && room.hostId === uid && (
          <button
            className="primary"
            disabled={roomPending || !connected}
            onClick={onRematch}
          >
            <RotateCcw size={18} />
            再開一局
          </button>
        )}
      </footer>
      {target && g.phase === "INVESTIGATION" && (
        <GameDialog title="正式指控" onClose={() => setTarget(null)}>
          <div className="mafia-confirm">
            <Fingerprint size={56} />
            <h2>{g.seats[target].nickname}</h2>
            <p>要求他掏出口袋？</p>
            <small>探員被指控會立即獨勝。</small>
            <div className="actions">
              <button onClick={() => setTarget(null)}>再想一下</button>
              <button
                className="danger"
                disabled={locked}
                onClick={() =>
                  send({ type: "mafiaAccuse", target }, () => setTarget(null))
                }
              >
                確認指控
              </button>
            </div>
          </div>
        </GameDialog>
      )}
      {panel === "box" && box && !receipt && (
        <GameDialog
          title="私人雪茄盒"
          className="mafia-private-dialog"
          onClose={() => setPanel(null)}
          dismissible={!pending}
        >
          {passing ? (
            <BoxDecision
              key={`${g.id}:${uid}`}
              box={box}
              first={uid === g.passOrder[0]}
              last={uid === g.passOrder.at(-1)}
              locked={locked}
              onTake={(a, r) =>
                send(a, () => {
                  setPanel(null);
                  setReceipt(r);
                })
              }
            />
          ) : (
            <div className="mafia-returned">
              <MafiaArt kind="open" />
              <BoxInventory box={box} />
              <p>
                藏起 <Gem size={16} /> {own?.hiddenDiamonds ?? 0} · 尚待找回{" "}
                <Gem size={16} /> {own?.missing ?? 0}
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </GameDialog>
      )}
      {panel === "role" && own?.role && (
        <GameDialog title="我的口袋 · 僅你可見" onClose={() => setPanel(null)}>
          <div className="mafia-role-card">
            <MafiaArt kind={own.role} />
            <h2>{MAFIA_ROLES[own.role]}</h2>
            {own.diamonds > 0 && (
              <p>
                <Gem />× {own.diamonds}
              </p>
            )}
            <p>{MAFIA_HELP[own.role]}</p>
            {own.role === "DRIVER" && (
              <p>右手邊：{g.seats[rightNeighbor(g.order, uid)].nickname}</p>
            )}
          </div>
        </GameDialog>
      )}
      {receipt && (
        <GameDialog
          title="已放入口袋 · 僅你可見"
          onClose={() => setReceipt(null)}
        >
          <div className="mafia-receipt">
            <motion.div
              initial={reduced ? false : { y: -100, scale: 1.4, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ duration: 0.75 }}
            >
              <MafiaArt
                kind={receipt.role === "THIEF" ? "diamond" : receipt.role}
              />
            </motion.div>
            <Pocket size={64} />
            <h2>
              <Check />
              {receipt.role === "THIEF"
                ? `${receipt.diamonds} 顆鑽石已入袋`
                : MAFIA_ROLES[receipt.role]}
            </h2>
            <p>{MAFIA_HELP[receipt.role]}</p>
            <button className="primary" onClick={() => setReceipt(null)}>
              收好口袋
            </button>
          </div>
        </GameDialog>
      )}
      {panel === "help" && (
        <GameDialog title="玩法速覽" onClose={() => setPanel(null)}>
          <div className="mafia-help">
            <p>
              <MafiaArt kind="box" />
              <ArrowRight />
              <Hand />
              <ArrowRight />
              <Pocket />
            </p>
            <h3>傳盒 → 秘密拿取 → 教父調查</h3>
            <p>
              拿鑽石成為竊賊，或拿一枚角色籌碼。第一位可先秘密移除一枚角色；最後一位可空手離開。
            </p>
            <p>
              司機的右手邊是座位編號的下一位，最後一位連回第 1
              位。出局不改變座位。
            </p>
            <p>
              <Gem />
              教父找回全部被偷鑽石即可獲勝。
              <br />
              <MafiaArt kind="joker" />
              指控無辜者須消耗一瓶寬恕；沒有酒瓶則教父出局。
              <br />
              探員被指控立即獨勝。
            </p>
            {g.config.cleanerEnabled && (
              <p>
                清道夫可在揭曉前秘密開槍：擊中探員獨勝，打錯則一起出局。未回應視為放行。
              </p>
            )}
          </div>
        </GameDialog>
      )}
    </div>
  );
}
function Counter({
  value,
  max,
  onChange,
  disabled = false,
  min = 0,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <div className="mafia-counter">
      <button
        aria-label="減少鑽石"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={18} />
      </button>
      <span>
        <Gem size={20} />
        <b>{value}</b>
      </span>
      <button
        aria-label="增加鑽石"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
function BoxInventory({ box }: { box: MafiaBox }) {
  return (
    <div className="mafia-inventory">
      <span>
        <Gem />× {box.diamonds}
      </span>
      {(box.tokens ?? []).map((t) => (
        <span key={t.id}>
          <MafiaArt kind={t.role} />
          <small>{MAFIA_ROLES[t.role]}</small>
        </span>
      ))}
    </div>
  );
}
function BoxDecision({
  box,
  first,
  last,
  locked,
  onTake,
}: {
  box: MafiaBox;
  first: boolean;
  last: boolean;
  locked: boolean;
  onTake: (
    a: MafiaAction,
    receipt: { role: MafiaRole; diamonds: number },
  ) => void;
}) {
  const [discard, setDiscard] = useState<string | undefined>();
  const [mode, setMode] = useState<"take" | "discard">("take");
  const [selection, setSelection] = useState<string>("");
  const [diamonds, setDiamonds] = useState(1);
  const tokens = box.tokens ?? [],
    available = tokens.filter((t) => t.id !== discard),
    empty = !box.diamonds && !available.length;
  const selectedToken = available.find((t) => t.id === selection);
  const valid =
    (selection === "diamonds" && diamonds <= box.diamonds) ||
    !!selectedToken ||
    ((selection === "nothing" || empty) && (last || empty));
  const confirm = () => {
    const base = {
      type: "mafiaTake" as const,
      ...(discard ? { discardTokenId: discard } : {}),
    };
    if (empty || selection === "nothing")
      onTake(
        { ...base, nothing: true },
        { role: "STREET_URCHIN", diamonds: 0 },
      );
    else if (selectedToken)
      onTake(
        { ...base, tokenId: selectedToken.id },
        { role: selectedToken.role, diamonds: 0 },
      );
    else onTake({ ...base, diamonds }, { role: "THIEF", diamonds });
  };
  return (
    <div className="mafia-box-decision">
      <MafiaArt kind="open" className="mafia-open-box" />
      <div className="mafia-box-caption">
        <Gem size={19} />
        <b>{box.diamonds}</b>
        <span>·</span>
        <Fingerprint size={19} />
        <b>{available.length}</b>
      </div>
      {first && (
        <div className="mafia-discard">
          <button
            aria-pressed={mode === "discard"}
            disabled={locked}
            onClick={() => setMode(mode === "discard" ? "take" : "discard")}
          >
            <X size={16} />
            秘密移除 {discard ? "1 枚" : "0 枚"}（可選）
          </button>
          {discard && (
            <button disabled={locked} onClick={() => setDiscard(undefined)}>
              復原
            </button>
          )}
          <small>
            {mode === "discard"
              ? "點選一枚角色移出盒子，再選擇你要拿的物品"
              : "選擇你要放入口袋的物品"}
          </small>
        </div>
      )}
      <div className="mafia-token-grid">
        {tokens.map((t) => (
          <button
            key={t.id}
            disabled={locked || (mode === "take" && discard === t.id)}
            className={`${selection === t.id ? "selected" : ""} ${discard === t.id ? "discarded" : ""}`}
            aria-pressed={
              mode === "discard" ? discard === t.id : selection === t.id
            }
            aria-label={`${mode === "discard" ? "秘密移除" : "拿取"}${MAFIA_ROLES[t.role]}`}
            onClick={() => {
              if (mode === "discard") {
                setDiscard(t.id);
                setSelection("");
                setMode("take");
              } else setSelection(t.id);
            }}
          >
            <MafiaArt kind={t.role} />
            <span>{MAFIA_ROLES[t.role]}</span>
          </button>
        ))}
      </div>
      {box.diamonds > 0 && (
        <div className="mafia-diamond-choice">
          <button
            className={selection === "diamonds" ? "selected" : ""}
            aria-pressed={selection === "diamonds"}
            disabled={locked}
            onClick={() => {
              setMode("take");
              setSelection("diamonds");
            }}
          >
            <MafiaArt kind="diamond" />
            拿鑽石
          </button>
          <Counter
            value={diamonds}
            min={1}
            max={box.diamonds}
            onChange={(n) => {
              setDiamonds(n);
              setSelection("diamonds");
              setMode("take");
            }}
            disabled={locked}
          />
        </div>
      )}
      {(last || empty) && (
        <button
          className={selection === "nothing" || empty ? "selected" : ""}
          aria-pressed={selection === "nothing" || empty}
          disabled={locked}
          onClick={() => setSelection("nothing")}
        >
          <Hand size={18} />
          {empty ? "空盒 · 街頭小子" : "空手離開 · 街頭小子"}
        </button>
      )}
      {(selectedToken || selection === "diamonds") && (
        <p className="mafia-choice-help">
          {MAFIA_HELP[selectedToken?.role ?? "THIEF"]}
        </p>
      )}
      <button
        className="primary mafia-confirm-take"
        disabled={!valid || locked || mode === "discard"}
        onClick={confirm}
      >
        <Pocket size={19} />
        確認拿取並傳盒 <ArrowRight size={19} />
      </button>
    </div>
  );
}
function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  return (
    <b className="mafia-countdown">
      {Math.max(0, Math.ceil((deadline - now) / 1000))}
    </b>
  );
}
function MafiaResults({ game: g }: { game: MafiaPublicState }) {
  const reduced = useReducedMotion();
  const [revealed, setRevealed] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const total = g.order.length + 2;
  useEffect(() => {
    if (reduced || revealed >= total) return;
    const timer = setTimeout(() => setRevealed((n) => n + 1), 650);
    return () => clearTimeout(timer);
  }, [reduced, revealed, total]);
  const count = reduced ? total : revealed;
  if (g.winReason === "ABORTED")
    return (
      <section className="mafia-results">
        <h2>本局已中止</h2>
        <p>有玩家離席，房主可重新開局。</p>
      </section>
    );
  const reason = {
    DIAMONDS_RECOVERED: "鑽石全數找回",
    GODFATHER_ELIMINATED: "教父出局",
    AGENT_ACCUSED: "探員獨勝",
    CLEANER_SHOT_AGENT: "清道夫獨勝",
  };
  return (
    <section className="mafia-results">
      <div className="section-heading">
        <h2>
          <Trophy />
          {count >= total ? g.winReason && reason[g.winReason] : "真相揭曉"}
        </h2>
        {count < total && (
          <button
            onClick={() => {
              setSkipped(true);
              setRevealed(total);
            }}
          >
            略過演出
          </button>
        )}
      </div>
      {count >= 1 && (
        <p className="mafia-final-stash">
          <Pocket size={20} />
          教父藏起 <Gem size={18} />
          {g.final?.hiddenDiamonds}
        </p>
      )}
      {count >= 2 && (
        <p className="mafia-final-stash">
          <X size={18} />
          秘密移除：
          {g.final?.discarded ? MAFIA_ROLES[g.final.discarded.role] : "無"}
        </p>
      )}
      <div className="mafia-final-grid">
        {g.order.slice(0, Math.max(0, count - 2)).map((id) => {
          const role = g.final?.roles[id];
          return (
            role && (
              <motion.div
                key={id}
                initial={
                  reduced || skipped ? false : { opacity: 0, rotateY: 90 }
                }
                animate={{ opacity: 1, rotateY: 0 }}
                transition={{ duration: reduced || skipped ? 0 : 0.4 }}
                className={
                  count >= total && (g.winners ?? []).includes(id)
                    ? "winner"
                    : ""
                }
              >
                <MafiaArt kind={role.role} />
                <strong>{g.seats[id].nickname}</strong>
                <span>{MAFIA_ROLES[role.role]}</span>
                {role.diamonds > 0 && (
                  <small>
                    <Gem size={13} />
                    {role.diamonds}
                  </small>
                )}
                {count >= total && (g.winners ?? []).includes(id) && (
                  <Trophy className="mafia-winner-icon" />
                )}
              </motion.div>
            )
          );
        })}
      </div>
      {count >= total && g.final && (
        <details>
          <summary>盒內剩餘物品</summary>
          <BoxInventory box={g.final.box} />
        </details>
      )}
    </section>
  );
}
