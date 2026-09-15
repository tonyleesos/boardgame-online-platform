import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Bookmark,
  Castle,
  Check,
  History,
  CircleHelp,
  Crown,
  Gem,
  Layers,
  LockKeyhole,
  ShoppingBag,
  Sparkles,
  Star,
  Trophy,
  Undo2,
} from "lucide-react";
import type { Room } from "../../../../functions/src/shared/model";
import {
  GEM_COLORS,
  TOKEN_COLORS,
  GEM_NAMES,
  CARD_BY_ID,
  EXPANSION_NAMES,
  DEMO_TRADING_POSTS,
  emptyTokens,
  tokenTotal,
  calculateBonuses,
  calculatePurchasePayment,
  calculatePrestige,
  canPurchaseCard,
  canReserveCard,
  canInteractWithStrongholdCard,
  mustReturnTokens,
  getEligibleNobles,
  applyTradingPostModifiers,
  deckKey,
} from "../../../../functions/src/shared/splendor";
import type {
  DevelopmentCard,
  DevelopmentTier,
  GemColor,
  SplendorAction,
  SplendorConfig,
  SplendorPrivate,
  SplendorPublicState,
  SplendorPlayerState,
  OrientChoice,
  TokenInventory,
} from "../../../../functions/src/shared/splendor";
import { splendorAction } from "../../firebase/api";
import { useAction } from "../../hooks/useAction";
import type { Presence } from "../../hooks/useRoom";
import { GameDialog } from "../../components/GameDialog";
import { Artwork, CardScene, GemIcon, GemAmount } from "./SplendorArt";
import { SplendorActivityPlayback } from "./SplendorActivityPlayback";
import { gemSelectionAction, nextGemSelection } from "./splendorGemSelection";
import "./splendor.css";

const EFFECT_NAMES = {
  double: "雙倍加成",
  copy: "複製已有加成",
  return: "歸還一張 I 階已購卡",
  reserve: "免費保留一張公開卡（不拿黃金）",
  noble: "邀約貴族，符合條件後來訪",
};
const MODULE_TIPS = {
  base: "收集寶石、購買卡牌，率先達到 15★ 觸發最後一輪。",
  cities: "城市取代貴族。達成任一城市條件觸發最後一輪，達標者比聲望。",
  tradingPosts: "累積加成解鎖 5 個貿易站，獲得持續能力。",
  orient: "每階增加 2 張東方卡，帶來雙倍加成與特殊交易。",
  strongholds: "購買後可放置或移除要塞。自己的 3 座要塞可換取額外購買機會。",
};
export function SplendorSettings({
  config,
  disabled,
  onChange,
}: {
  config: SplendorConfig;
  disabled: boolean;
  onChange: (c: SplendorConfig) => void;
}) {
  return (
    <div className="sp-settings">
      <label htmlFor="sp-module">選擇玩法</label>
      <select
        id="sp-module"
        value={config.module}
        disabled={disabled}
        onChange={(e) =>
          onChange({
            ...config,
            module: e.target.value as SplendorConfig["module"],
          })
        }
      >
        {Object.entries(EXPANSION_NAMES).map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
      <p>{MODULE_TIPS[config.module]}</p>
      <label className="sp-check">
        <input
          type="checkbox"
          checked={config.competitorMode}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...config, competitorMode: e.target.checked })
          }
        />
        競技模式 · 隱藏購買與付款提示
      </label>
      <small>原創示範卡組與擴充效果 · 更換設定需重新準備</small>
    </div>
  );
}
function Cost({ values }: { values: Partial<TokenInventory> }) {
  return (
    <span className="sp-cost">
      {TOKEN_COLORS.filter((c) => (values[c] ?? 0) > 0).map((c) => (
        <GemAmount key={c} color={c} count={values[c]!} />
      ))}
    </span>
  );
}
function DevelopmentTile({
  card,
  game,
  player,
  onClick,
  small = false,
}: {
  card: DevelopmentCard;
  game: SplendorPublicState;
  player: SplendorPlayerState;
  onClick: () => void;
  small?: boolean;
}) {
  const h = game.strongholds[card.id],
    affordable =
      !game.config.competitorMode && canPurchaseCard(game, player, card);
  return (
    <button
      className={`sp-card ${affordable ? "affordable" : ""} ${small ? "small" : ""}`}
      data-sp-source={`card:${card.id}`}
      onClick={onClick}
      aria-label={`${card.name}，${card.tier} 階，${GEM_NAMES[card.bonusColor]}加成，${card.prestige} 聲望`}
    >
      <CardScene card={card} />
      <span className="sp-card-head">
        <span className="sp-prestige">
          {card.prestige > 0 && card.prestige}
        </span>
        <span className="sp-card-bonus">
          <GemIcon color={card.bonusColor} size={30} />
          {card.orientEffect?.type === "double" && <b>×2</b>}
        </span>
      </span>
      {h && (
        <span
          className="sp-protected"
          title={`${game.players[h.ownerUid].nickname}的要塞`}
        >
          <Castle size={14} />
          {h.count}
          <small>{game.players[h.ownerUid].nickname.slice(0, 2)}</small>
        </span>
      )}
      <span className="sp-card-cost">
        <Cost values={card.cost} />
      </span>
      <span className="sp-card-foot">
        <small>
          {card.source === "orient" && <Sparkles size={11} />} {card.name}
        </small>
      </span>
      {affordable && (
        <span className="sp-affordable">
          <Check size={12} />
        </span>
      )}
    </button>
  );
}
export function SplendorGame(props: {
  room: Room;
  privateData: SplendorPrivate | null;
  uid: string;
  connected: boolean;
  presence: Record<string, Presence>;
  onRematch: () => void;
  roomPending: boolean;
}) {
  const g = props.room.splendor;
  if (!g) return <p role="status">正在開啟珠寶市場…</p>;
  return <Board key={g.id} {...props} game={g} />;
}
function Board({
  room,
  privateData,
  uid,
  connected,
  presence,
  onRematch,
  roomPending,
  game: g,
}: {
  room: Room;
  privateData: SplendorPrivate | null;
  uid: string;
  connected: boolean;
  presence: Record<string, Presence>;
  onRematch: () => void;
  roomPending: boolean;
  game: SplendorPublicState;
}) {
  const { pending, error, run } = useAction();
  const boardRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<GemColor[]>([]);
  const [selected, setSelected] = useState<{
      id: string;
      slot?: string;
    } | null>(null),
    [blind, setBlind] = useState<{
      tier: DevelopmentTier;
      source: "base" | "orient";
    } | null>(null);
  const [help, setHelp] = useState(false),
    [showResult, setShowResult] = useState(true),
    [history, setHistory] = useState(false),
    [posts, setPosts] = useState(false),
    [patron, setPatron] = useState<string | null>(null),
    [profile, setProfile] = useState<string | null>(null),
    [returns, setReturns] = useState(emptyTokens),
    [choice, setChoice] = useState<OrientChoice>({});
  const [selectionRevision, setSelectionRevision] = useState(g.revision);
  const p = g.players[uid],
    current = g.players[g.playerOrder[g.currentPlayerIndex]],
    mine = current.uid === uid;
  const active = mine && connected && !pending,
    primary = active && g.phase === "PLAYER_ACTION";
  const chosen = selectionRevision === g.revision ? selection : [];
  const double = chosen.length === 2 && chosen[0] === chosen[1];
  const takeAction = gemSelectionAction(g, p, chosen);
  const openCard = (id: string, slot?: string) => {
    setSelected({ id, slot });
    setChoice({});
  };
  const act = (a: SplendorAction) =>
    void run(async () => {
      await splendorAction(room.code, g, a);
      setSelected(null);
      setBlind(null);
      setSelection([]);
      setReturns(emptyTokens());
      setChoice({});
    });
  const selectGem = (c: GemColor) => {
    setSelectionRevision(g.revision);
    setSelection(nextGemSelection(g, chosen, c));
  };
  const card = selected ? CARD_BY_ID[selected.id] : undefined;
  const cardExists =
    !!selected &&
    (selected.slot
      ? p.reservedCards.some((r) => r.slot === selected.slot)
      : Object.values(g.market).some((row) => row.includes(selected.id)));
  const payment = card ? calculatePurchasePayment(card, p) : null;
  const owned = privateData?.gameId === g.id ? privateData.reserved : {};
  const canBuy =
    card &&
    cardExists &&
    (primary ||
      (active &&
        g.phase === "STRONGHOLD_BONUS_PURCHASE" &&
        g.strongholds[card.id]?.ownerUid === uid &&
        g.strongholds[card.id].count === 3)) &&
    canPurchaseCard(g, p, card);
  const effectReady =
    !card?.orientEffect ||
    ((card.orientEffect.type !== "copy" || !!choice.color) &&
      (card.orientEffect.type !== "return" || !!choice.returnCardId));
  const phaseText =
    g.phase === "GAME_OVER"
      ? "本局結束"
      : mine
        ? {
            PLAYER_ACTION: "輪到你了，讓收藏更閃耀",
            RETURN_EXCESS_TOKENS: "選擇要退回的寶石",
            CHOOSE_NOBLE: "選擇一位來訪貴族",
            RESOLVE_EXPANSION: "放置或移除一座要塞",
            STRONGHOLD_BONUS_PURCHASE: "要塞集結！可額外購買",
          }[g.phase]
        : `輪到 ${current.nickname} 執行動作`;
  return (
    <div className={`sp-game sp-module-${g.config.module}`} ref={boardRef}>
      <header className="sp-heading">
        <div>
          <span className="sp-eyebrow">THE GEM ATELIER</span>
          <h2>
            <Gem size={25} />
            璀璨寶石
          </h2>
        </div>
        <div className="sp-heading-right">
          {g.phase === "GAME_OVER" && <button className="sp-icon-button" aria-label="查看對局結果" onClick={() => setShowResult(true)}><Trophy size={18} /></button>}
          {g.config.module === "tradingPosts" && <button className="sp-icon-button" aria-label="查看貿易站" onClick={() => setPosts(true)}><Castle size={18} /></button>}
          <button className="sp-icon-button" aria-label="查看交易紀錄" onClick={() => setHistory(true)}><History size={18} /></button>
          <span>
            第 <b>{g.round}</b> 輪
          </span>
          <button
            className="sp-icon-button"
            aria-label="遊戲圖示說明"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={22} />
          </button>
        </div>
      </header>
      <div
        className={`sp-turn ${mine && g.phase !== "GAME_OVER" ? "is-mine" : ""}`}
        role="status"
        aria-live="polite"
      >
        {g.phase !== "GAME_OVER" && <span className="sp-turn-dot" />}
        <strong key={`${g.round}:${current.uid}:${g.phase}`} className="sp-turn-message">{phaseText}</strong>
        {mine && (g.phase === "RESOLVE_EXPANSION" || g.phase === "STRONGHOLD_BONUS_PURCHASE") &&
          <button className="sp-phase-skip" disabled={!active} onClick={() => act({ type: g.phase === "RESOLVE_EXPANSION" ? "splendorStronghold" : "splendorSkip" })}>略過</button>}
        <small>
          {g.finalRoundNumber ? "最後一輪" : EXPANSION_NAMES[g.config.module]}
        </small>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="sp-players" style={{ gridTemplateColumns: `repeat(${g.playerOrder.length}, minmax(0, 1fr))` }}>
        {g.playerOrder.map((id, i) => {
          const player = g.players[id];
          return (
            <button
              key={id}
              onClick={() => setProfile(id)}
              className={`sp-player ${current.uid === id && g.phase !== "GAME_OVER" ? "current" : ""}`}
              data-player-id={id}
              aria-label={`查看 ${player.nickname} 的收藏`}
            >
              <span className="sp-player-overview">
              {current.uid === id && g.phase !== "GAME_OVER" && <span className="sp-player-turn-dot" role="img" aria-label="目前行動玩家" />}
              <span className={`sp-avatar avatar-${i}`}>
                {player.nickname.slice(0, 1)}
                {!room.players[id]?.isBot &&
                  !Object.keys(presence[id]?.connections ?? {}).length && (
                    <i title="離線" />
                  )}
              </span>
              <span className="sp-player-name">
                {player.nickname}
                {id === uid && <small>你</small>}
                <span>
                  <Gem size={12} />
                  <span data-sp-source={`player:${id}:tokens`} data-sp-destination={`player:${id}:tokens`} aria-label={`寶石總數 ${tokenTotal(player.tokens)} 枚`}>
                  {tokenTotal(player.tokens)}
                  </span>
                  <Bookmark size={12} />
                  <span data-sp-source={`player:${id}:reserves`} data-sp-destination={`player:${id}:reserves`} aria-label={`已保留 ${player.reservedCards.length} 張`}>
                  {player.reservedCards.length}
                  </span>
                </span>
              </span>
              <b className="sp-score">
                <Star size={14} fill="currentColor" />
                {calculatePrestige(player)}
              </b>
              </span>
              <PlayerResources player={player} />
            </button>
          );
        })}
      </div>
      {g.phase === "GAME_OVER" && showResult && (
        <GameDialog title="對局結果" className="sp-dialog" onClose={() => setShowResult(false)}>
        <section className="sp-result">
          <Trophy size={44} />
          <h3>
            {g.aborted
              ? "玩家離席，本局中止"
              : `${(g.winners ?? []).map((id) => g.players[id].nickname).join("、")} 勝出`}
          </h3>
          <p>
            {g.aborted
              ? "回到準備區即可重新開局。"
              : g.config.module === "cities"
                ? "達成城市條件的玩家中，聲望最高者勝出。"
                : "聲望相同時，購買卡牌較少者勝出；仍相同則共享勝利。"}
          </p>
          {room.hostId === uid ? (
            <button
              className="sp-confirm"
              disabled={roomPending || !connected}
              onClick={onRematch}
            >
              再開一局 <ArrowRight size={17} />
            </button>
          ) : (
            <small>等待房主再開一局</small>
          )}
        </section>
        </GameDialog>
      )}
      <section
        className="sp-patrons"
        data-sp-source="nobles"
        aria-label={g.config.module === "cities" ? "城市" : "貴族"}
      >
        <div className="sp-section-label">
          <Crown size={16} />
          {g.config.module === "cities" ? "城市目標" : "貴族來訪"}
          <small>
            {g.config.module === "cities" ? "達成觸發終局" : "只計算永久加成"}
          </small>
        </div>
        <div className="sp-patron-row">
          {(g.config.module === "cities" ? g.cities : g.nobles).map((n, i) => (
            <button key={n.id} className={`sp-patron patron-${i}`} aria-label={`查看${n.name}條件`} onClick={() => setPatron(n.id)}>
              <span
                className={`sp-patron-seal ${g.config.module === "cities" ? "" : "sp-patron-portrait"}`}
              >
                {g.config.module === "cities" ? (
                  <Castle size={26} />
                ) : (
                  <Artwork cell={8} />
                )}
              </span>
              <div>
                <strong>{n.name}</strong>
                <Cost values={n.requirements} />
                {"differentBonuses" in n && (
                  <small>≥ {n.differentBonuses} 種加成</small>
                )}
                {Object.values(g.players).some((v) =>
                  v.pledgedNobleIds.includes(n.id),
                ) && <small className="sp-pledged-label">已邀約</small>}
              </div>
              <b>
                <Star size={11} fill="currentColor" />
                {"prestige" in n ? n.prestige : n.minimumPrestige}
              </b>
            </button>
          ))}
        </div>
      </section>
      <div className="sp-table-layout">
        <section className="sp-market" aria-label="發展卡市場" data-sp-source="market" data-sp-destination="market">
          <div className="sp-section-label">
            <Layers size={16} />
            珠寶市場<small>點卡牌查看 · 購買 / 保留</small>
          </div>
          {([3, 2, 1] as DevelopmentTier[]).map((tier) => (
            <div className="sp-tier" key={tier}>
              <div className="sp-tier-label">
                <span>{["", "I", "II", "III"][tier]}</span>
                <small>{["", "礦場", "商館", "宮殿"][tier]}</small>
              </div>
              <div className="sp-tier-scroll">
                {(
                  [
                    "base",
                    ...(g.config.module === "orient" ? ["orient"] : []),
                  ] as Array<"base" | "orient">
                ).map((source) => (
                  <div
                    className={`sp-market-row ${source === "orient" ? "sp-orient-row" : ""}`}
                    key={source}
                  >
                    <button
                      className={`sp-deck tier-${tier}`}
                      data-sp-source={`deck:${source}${tier}`}
                      aria-label={`保留 ${source === "orient" ? "東方" : "基礎"} ${tier} 階暗牌`}
                      disabled={
                        !primary ||
                        !canReserveCard(p) ||
                        !g.deckCounts[deckKey(tier, source)]
                      }
                      onClick={() => setBlind({ tier, source })}
                    >
                      <Gem size={26} />
                      <span>
                        {source === "orient"
                          ? "東方"
                          : Array(tier).fill("·").join(" ")}
                      </span>
                      <small>
                        <Layers size={11} />
                        {g.deckCounts[deckKey(tier, source)] ?? 0}
                      </small>
                    </button>
                    {g.market[deckKey(tier, source)].map((id, i) =>
                      id ? (
                        <DevelopmentTile
                          key={id}
                          card={CARD_BY_ID[id]}
                          game={g}
                          player={p}
                          onClick={() => openCard(id)}
                        />
                      ) : (
                        <div className="sp-empty-card" key={`empty${i}`}>
                          <Layers size={18} />
                        </div>
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
        <section className="sp-bank" aria-label="寶石庫">
          <div className="sp-section-label">
            <Gem size={16} />
            寶石庫
          </div>
          <div className="sp-bank-tokens">
            {TOKEN_COLORS.map((c) => (
              <button
                key={c}
                className={`sp-token sp-token-${c} ${chosen.includes(c as GemColor) ? "selected" : ""}`}
                aria-label={`${GEM_NAMES[c]}，庫存 ${g.bank[c]}`}
                aria-pressed={chosen.includes(c as GemColor)}
                disabled={
                  !primary ||
                  c === "gold" ||
                  g.bank[c] === 0 ||
                  (!chosen.includes(c as GemColor) && (double || chosen.length >= applyTradingPostModifiers(p).maxDifferent))
                }
                onClick={() => selectGem(c as GemColor)}
              >
                <span className="sp-chip" data-sp-source={`bank:${c}`} data-sp-destination={`bank:${c}`}>
                  <span className="sp-chip-face">
                    <GemIcon color={c} size={38} />
                  </span>
                </span>
                <b>{g.bank[c]}</b>
                <small>{c === "gold" ? "保留獲得" : GEM_NAMES[c]}</small>
                {chosen.includes(c as GemColor) && <em>×{chosen.filter((color) => color === c).length}</em>}
              </button>
            ))}
          </div>
          <div className="sp-bank-action">
            <span>
              {double ? "已選同色 2 枚" : `已選 ${chosen.length} / ${applyTradingPostModifiers(p).maxDifferent} 色`}
              <button className="sp-clear-selection" disabled={!primary || !chosen.length} onClick={() => setSelection([])}>清除選取</button>
            </span>
            <button
              className="sp-confirm"
              disabled={
                !primary || !takeAction
              }
              onClick={() => takeAction && act(takeAction)}
            >
              <ArrowDownToLine size={17} />
              拿取{chosen.length > 0 && ` ${double ? 2 : chosen.length}`}
            </button>
          </div>
        </section>
      </div>
      {mine && g.phase === "RESOLVE_EXPANSION" && (
        <div className="sp-special-banner">
          <Castle />
          剩餘 {p.strongholdsRemaining} 座 · 點市場卡放置 / 移除
          <button
            disabled={!active}
            onClick={() => act({ type: "splendorStronghold" })}
          >
            略過
          </button>
        </div>
      )}
      {mine && g.phase === "STRONGHOLD_BONUS_PURCHASE" && (
        <div className="sp-special-banner">
          <Castle />
          點選擁有 3 座要塞的卡購買
          <button
            disabled={!active}
            onClick={() => act({ type: "splendorSkip" })}
          >
            略過
          </button>
        </div>
      )}
      {posts && (
        <GameDialog title="貿易站" className="sp-dialog sp-posts" onClose={() => setPosts(false)}>
          <p>已啟用 {p.tradingPosts.length} / 5</p>
          <div>
            {DEMO_TRADING_POSTS.map((post) => (
              <article
                key={post.id}
                className={p.tradingPosts.includes(post.id) ? "unlocked" : ""}
              >
                <strong>
                  {p.tradingPosts.includes(post.id) ? "✓" : "◇"} {post.name}
                </strong>
                <Cost values={post.requirements} />
                <small>{post.description}</small>
              </article>
            ))}
          </div>
        </GameDialog>
      )}
      <section className="sp-reserves">
        <div className="sp-section-label">
          <Bookmark size={16} />
          我的保留卡 <small>{p.reservedCards.length} / 3</small>
        </div>
        <div className="sp-reserve-row">
          {p.reservedCards.map((r) => {
            const id = owned[r.slot] ?? r.cardId;
            return id ? (
              <DevelopmentTile
                key={r.slot}
                card={CARD_BY_ID[id]}
                game={g}
                player={p}
                small
                onClick={() => openCard(id, r.slot)}
              />
            ) : (
              <span key={r.slot} className="sp-reserve-empty">
                <LockKeyhole />
                私人卡同步中
              </span>
            );
          })}
          {Array.from({ length: 3 - p.reservedCards.length }, (_, i) => (
            <div key={i} className="sp-reserve-empty">
              <Bookmark size={20} />
              <small>留住下一步</small>
            </div>
          ))}
        </div>
      </section>
      {history && <GameDialog title="交易紀錄" className="sp-dialog sp-log" onClose={() => setHistory(false)}>
        {[...g.log].reverse().map((entry, i) => (
          <p key={`${entry.revision}-${i}`}>
            <b>{g.players[entry.uid].nickname}</b>
            {entry.text}
          </p>
        ))}
        {!g.log.length && <p>第一筆交易，從你開始。</p>}
      </GameDialog>}
      <footer className="sp-dock">
        <div className="sp-dock-title">
          <span>我的收藏</span>
          <b>
            <Star size={13} fill="currentColor" />
            {calculatePrestige(p)}
            <small> / {g.config.module === "cities" ? "城市" : 15}</small>
          </b>
          <span
            className="sp-dock-cards"
            data-sp-destination="cards"
            aria-label={`已購入 ${p.purchasedCardIds.length} 張發展卡`}
          >
            <Layers size={13} />
            {p.purchasedCardIds.length}
            <small>張</small>
          </span>
          <span
            className="sp-dock-cards"
            data-sp-destination="reserves"
            aria-label={`已保留 ${p.reservedCards.length} 張卡牌`}
          >
            <Bookmark size={13} />
            {p.reservedCards.length}
            <small>/ 3</small>
          </span>
          <span>
            <Gem size={13} />
            {tokenTotal(p.tokens)} / {applyTradingPostModifiers(p).tokenLimit}
          </span>
        </div>
        <div className="sp-inventory">
          <span className="sp-inventory-label">
            <Gem size={13} />
            持有
          </span>
          {TOKEN_COLORS.map((c) => (
            <GemAmount
              key={c}
              color={c}
              count={p.tokens[c]}
              destination={`token:${c}`}
            />
          ))}
        </div>
        <div className="sp-inventory">
          <span className="sp-inventory-label">
            <Layers size={13} />
            折扣
          </span>
          {GEM_COLORS.map((c) => (
            <GemAmount key={c} color={c} count={calculateBonuses(p)[c]} />
          ))}
          <span className="sp-permanent">∞</span>
        </div>
      </footer>
      {blind && (
        <GameDialog
          title="保留暗牌"
          className="sp-dialog"
          onClose={() => setBlind(null)}
        >
          <div className="sp-blind-preview">
            <Gem size={60} />
            <h3>
              {blind.tier} 階 · {blind.source === "orient" ? "東方" : "基礎"}
              牌堆
            </h3>
            <p>
              <LockKeyhole size={16} />
              抽出的牌只有你能看見
            </p>
          </div>
          <p>
            保留卡 {p.reservedCards.length} / 3 ·{" "}
            {g.bank.gold ? "獲得 1 枚黃金" : "黃金已領完，仍可保留"}
          </p>
          <button
            className="sp-confirm"
            disabled={
              !primary ||
              !canReserveCard(p) ||
              !g.deckCounts[deckKey(blind.tier, blind.source)]
            }
            onClick={() => act({ type: "splendorBlind", ...blind })}
          >
            <Bookmark size={17} />
            確認保留
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </GameDialog>
      )}
      {card && selected && (
        <GameDialog
          title={card.name}
          className="sp-dialog"
          onClose={() => setSelected(null)}
        >
          <div className="sp-card-preview">
            <DevelopmentTile
              card={card}
              game={g}
              player={p}
              onClick={() => {}}
            />
            <div>
              <p className="sp-preview-bonus">
                <GemIcon color={card.bonusColor} size={36} />
                <b>+{card.orientEffect?.type === "double" ? 2 : 1}</b>
                <span>永久折扣</span>
              </p>
              <p>
                <Star size={17} /> +{card.prestige} 聲望
              </p>
              {card.orientEffect && (
                <p className="sp-effect">
                  <Sparkles size={16} />
                  {EFFECT_NAMES[card.orientEffect.type]}
                </p>
              )}
            </div>
          </div>
          {!g.config.competitorMode && payment && (
            <div className="sp-payment">
              <div>
                <span>卡牌價格</span>
                <Cost values={card.cost} />
              </div>
              <div>
                <span>永久折扣</span>
                <Cost values={calculateBonuses(p)} />
              </div>
              <div>
                <strong>實際支付</strong>
                <Cost
                  values={{
                    ...payment.normalPayment,
                    gold: payment.goldPayment,
                  }}
                />
                {payment.totalTokensSpent === 0 && <b>免費</b>}
              </div>
              <small>
                {payment.affordable
                  ? `支付後持有 ${tokenTotal(p.tokens) - payment.totalTokensSpent} 枚代幣`
                  : "寶石不足，可以先保留"}
              </small>
            </div>
          )}
          {card.orientEffect?.type === "copy" && (
            <label className="sp-choice">
              複製加成
              <select
                value={choice.color ?? ""}
                onChange={(e) =>
                  setChoice({ ...choice, color: e.target.value as GemColor })
                }
              >
                <option value="">選擇已有加成</option>
                {GEM_COLORS.filter((c) => calculateBonuses(p)[c] > 0).map(
                  (c) => (
                    <option value={c} key={c}>
                      {GEM_NAMES[c]}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
          {card.orientEffect?.type === "return" && (
            <label className="sp-choice">
              歸還已購卡
              <select
                value={choice.returnCardId ?? ""}
                onChange={(e) =>
                  setChoice({ ...choice, returnCardId: e.target.value })
                }
              >
                <option value="">選擇一張 I 階卡（失去加成與分數）</option>
                {p.purchasedCardIds
                  .filter((id) => CARD_BY_ID[id].tier === 1)
                  .map((id) => (
                    <option value={id} key={id}>
                      {CARD_BY_ID[id].name} ·{" "}
                      {GEM_NAMES[CARD_BY_ID[id].bonusColor]}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {card.orientEffect?.type === "reserve" && canReserveCard(p) && (
            <label className="sp-choice">
              免費保留（可略過）
              <select
                value={choice.reserveCardId ?? ""}
                onChange={(e) =>
                  setChoice({ ...choice, reserveCardId: e.target.value })
                }
              >
                <option value="">略過</option>
                {Object.values(g.market)
                  .flat()
                  .filter((id): id is string => !!id && id !== card.id)
                  .map((id) => (
                    <option key={id} value={id}>
                      {CARD_BY_ID[id].tier} 階 · {CARD_BY_ID[id].name} ·{" "}
                      {GEM_NAMES[CARD_BY_ID[id].bonusColor]}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {card.orientEffect?.type === "noble" && (
            <label className="sp-choice">
              邀約貴族（可略過）
              <select
                value={choice.nobleId ?? ""}
                onChange={(e) =>
                  setChoice({ ...choice, nobleId: e.target.value })
                }
              >
                <option value="">略過</option>
                {g.nobles
                  .filter(
                    (n) =>
                      !Object.values(g.players).some((pl) =>
                        pl.pledgedNobleIds.includes(n.id),
                      ),
                  )
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {g.phase === "RESOLVE_EXPANSION" && mine && !selected.slot ? (
            <div className="sp-sheet-actions">
              <button
                className="sp-confirm"
                disabled={
                  !active ||
                  !cardExists ||
                  p.strongholdsRemaining < 1 ||
                  !canInteractWithStrongholdCard(g, uid, card.id)
                }
                onClick={() =>
                  act({ type: "splendorStronghold", cardId: card.id })
                }
              >
                <Castle size={17} />
                放置
              </button>
              <button
                disabled={
                  !active ||
                  !g.strongholds[card.id] ||
                  g.strongholds[card.id].ownerUid === uid
                }
                onClick={() =>
                  act({
                    type: "splendorStronghold",
                    cardId: card.id,
                    remove: true,
                  })
                }
              >
                移除對手要塞
              </button>
            </div>
          ) : (
            <div className="sp-sheet-actions">
              <button
                className="sp-confirm"
                disabled={!canBuy || !effectReady}
                onClick={() =>
                  act({
                    type: "splendorBuy",
                    ...(selected.slot
                      ? { slot: selected.slot }
                      : { cardId: card.id }),
                    choice,
                  })
                }
              >
                <ShoppingBag size={18} />
                購買
              </button>
              {!selected.slot && (
                <button
                  disabled={
                    !primary ||
                    !cardExists ||
                    !canReserveCard(p) ||
                    !canInteractWithStrongholdCard(g, uid, card.id)
                  }
                  onClick={() =>
                    act({ type: "splendorReserve", cardId: card.id })
                  }
                >
                  <Bookmark size={18} />
                  保留 {g.bank.gold > 0 && <GemIcon color="gold" size={20} />}
                </button>
              )}
            </div>
          )}
          {!cardExists && <p role="alert">此卡牌已被操作，請重新選擇。</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </GameDialog>
      )}
      {mine && g.phase === "RETURN_EXCESS_TOKENS" && (
        <GameDialog
          title={`退回 ${mustReturnTokens(p)} 枚代幣`}
          className="sp-dialog"
          onClose={() => {}}
          dismissible={false}
        >
          <p>保留最需要的寶石，退回超出的數量。</p>
          <div className="sp-return-grid">
            {TOKEN_COLORS.map((c) => (
              <div key={c}>
                <GemIcon color={c} size={32} />
                <small>
                  {GEM_NAMES[c]} · {p.tokens[c]}
                </small>
                <div>
                  <button
                    aria-label={`減少退回${GEM_NAMES[c]}`}
                    disabled={!returns[c]}
                    onClick={() =>
                      setReturns({ ...returns, [c]: returns[c] - 1 })
                    }
                  >
                    −
                  </button>
                  <b>{returns[c]}</b>
                  <button
                    aria-label={`增加退回${GEM_NAMES[c]}`}
                    disabled={
                      returns[c] >= p.tokens[c] ||
                      tokenTotal(returns) >= mustReturnTokens(p)
                    }
                    onClick={() =>
                      setReturns({ ...returns, [c]: returns[c] + 1 })
                    }
                  >
                    ＋
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            className="sp-confirm"
            disabled={!active || tokenTotal(returns) !== mustReturnTokens(p)}
            onClick={() => act({ type: "splendorReturn", tokens: returns })}
          >
            <Undo2 size={17} />
            退回 {tokenTotal(returns)} / {mustReturnTokens(p)}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </GameDialog>
      )}
      {mine && g.phase === "CHOOSE_NOBLE" && (
        <GameDialog
          title="選擇一位來訪貴族"
          className="sp-dialog"
          onClose={() => {}}
          dismissible={false}
        >
          <p>每回合一位，無須花費寶石。</p>
          {getEligibleNobles(p, g).map((n) => (
            <button
              className="sp-noble-choice"
              key={n.id}
              disabled={!active}
              onClick={() => act({ type: "splendorNoble", nobleId: n.id })}
            >
              <Crown />
              <strong>{n.name}</strong>
              <Cost values={n.requirements} />
              <b>+{n.prestige}★</b>
            </button>
          ))}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </GameDialog>
      )}
      {patron && (() => {
        const target = [...g.nobles, ...g.cities].find((n) => n.id === patron);
        return target && <GameDialog title={target.name} className="sp-dialog" onClose={() => setPatron(null)}>
          <p>需要的永久加成</p><Cost values={target.requirements} />
          <p><Star size={16} /> {"prestige" in target ? `獲得 ${target.prestige} 聲望` : `至少 ${target.minimumPrestige} 聲望`}</p>
          {"differentBonuses" in target && <p>至少 {target.differentBonuses} 種不同色加成</p>}
          <p>{g.config.module === "cities" ? "達成所有條件即可取得城市資格。" : "每回合最多一位貴族來訪，不消耗寶石或卡牌。"}</p>
        </GameDialog>;
      })()}
      {profile && (
        <GameDialog
          title={`${g.players[profile].nickname} 的收藏`}
          className="sp-dialog"
          onClose={() => setProfile(null)}
        >
          <PlayerCollection player={g.players[profile]} game={g} />
        </GameDialog>
      )}
      {help && (
        <GameDialog
          title="一眼學會交易"
          className="sp-dialog"
          onClose={() => setHelp(false)}
        >
          <div className="sp-help">
            <p>
              <Gem />
              <span>
                <b>拿寶石</b>選最多 {applyTradingPostModifiers(p).maxDifferent}{" "}
                種不同色，或庫存至少 4 枚時拿 2 枚同色。
              </span>
            </p>
            <p>
              <ShoppingBag />
              <span>
                <b>買卡牌</b>左上是聲望，左側圓圈是費用，右上寶石是永久折扣。
              </span>
            </p>
            <p>
              <Bookmark />
              <span>
                <b>保留卡</b>最多 3 張；庫存有黃金時獲得 1
                枚。暗牌只有自己看得到。
              </span>
            </p>
            <p>
              <Crown />
              <span>
                {g.config.module === "cities" ? (
                  <>
                    <b>城市目標</b>
                    同時達成聲望、指定折扣與不同色數量，就取得城市資格。
                  </>
                ) : (
                  <>
                    <b>貴族來訪</b>
                    永久折扣達到條件，就能獲得聲望；每回合最多一位。
                  </>
                )}
              </span>
            </p>
            <p>
              <Trophy />
              <span>
                <b>
                  {g.config.module === "cities"
                    ? "達成城市，開啟最後一輪"
                    : "15★ 開啟最後一輪"}
                </b>
                大家完成相同回合數，再比較聲望。
                {g.config.module === "cities" &&
                  "只有取得城市資格的玩家可勝出。"}
              </span>
            </p>
            <p>
              <Layers />
              <span>
                <b>持有 ≠ 折扣</b>
                寶石會花掉；卡牌折扣每次購買都有效。回合結束最多持有{" "}
                {applyTradingPostModifiers(p).tokenLimit} 枚代幣。
              </span>
            </p>
            {g.config.module !== "base" && (
              <p>
                <Sparkles />
                <span>
                  <b>{EXPANSION_NAMES[g.config.module]}</b>
                  {MODULE_TIPS[g.config.module]}
                </span>
              </p>
            )}
          </div>
          <small>本桌使用原創示範卡組；擴充為本平台的示範規則。</small>
          <button className="sp-confirm" onClick={() => setHelp(false)}>
            <Check size={18} />
            開始打造收藏
          </button>
        </GameDialog>
      )}
      <SplendorActivityPlayback game={g} boardRef={boardRef} />
    </div>
  );
}
function PlayerResources({ player }: { player: SplendorPlayerState }) {
  return <span className="sp-player-resources" aria-label={`${player.nickname} 的已購卡，點擊查看完整收藏`}
    data-sp-source={`player:${player.uid}:cards`} data-sp-destination={`player:${player.uid}:cards`}>
    {GEM_COLORS.map((color) => {
      const cards = player.purchasedCardIds.filter((id) => CARD_BY_ID[id].bonusColor === color);
      return <span key={color} className={`sp-owned-stack sp-${color} ${cards.length ? "" : "empty"}`}
        aria-label={`${GEM_NAMES[color]}已購 ${cards.length} 張`}
        title={cards.map((id) => CARD_BY_ID[id].name).join("、") || "尚未購入"}>
        <GemIcon color={color} size={13} /><b>{cards.length}</b>
      </span>;
    })}
  </span>;
}
function PlayerCollection({
  player: p,
  game: g,
}: {
  player: SplendorPlayerState;
  game: SplendorPublicState;
}) {
  return (
    <div className="sp-collection">
      <h3>
        <Star /> {calculatePrestige(p)} 聲望
      </h3>
      <p>持有寶石</p>
      <Cost values={p.tokens} />
      <p>永久折扣</p>
      <Cost values={calculateBonuses(p)} />
      <p>保留卡 · {p.reservedCards.length} / 3</p>
      <div className="sp-public-reserves">
        {p.reservedCards.map((r) => (
          <span key={r.slot}>
            {r.cardId ? (
              <>
                <GemIcon color={CARD_BY_ID[r.cardId].bonusColor} />
                {CARD_BY_ID[r.cardId].name}
              </>
            ) : (
              <>
                <LockKeyhole size={17} />
                {r.tier} 階暗牌
              </>
            )}
          </span>
        ))}
      </div>
      <p>已購卡 · {p.purchasedCardIds.length}</p>
      <div className="sp-owned-list">
        {p.purchasedCardIds.map((id) => (
          <span key={id}>
            <GemIcon color={CARD_BY_ID[id].bonusColor} />
            {CARD_BY_ID[id].name}
            <b>{CARD_BY_ID[id].prestige}★</b>
          </span>
        ))}
      </div>
      {p.nobles.map((n) => (
        <p key={n.id}>
          <Crown size={16} /> {n.name} +{n.prestige}★
        </p>
      ))}
      {g.config.module === "cities" && <p>已達成 {p.cityIds.length} 座城市</p>}
      {g.config.module === "strongholds" && (
        <p>
          <Castle size={16} /> 剩餘 {p.strongholdsRemaining} 座要塞
        </p>
      )}
      {g.config.module === "tradingPosts" &&
        DEMO_TRADING_POSTS.filter((post) =>
          p.tradingPosts.includes(post.id),
        ).map((post) => (
          <p key={post.id}>
            ✓ {post.name} · {post.description}
          </p>
        ))}
    </div>
  );
}
