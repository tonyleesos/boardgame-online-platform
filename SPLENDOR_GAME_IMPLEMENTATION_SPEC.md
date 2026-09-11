# 璀璨寶石（Splendor-inspired）Web Game — Codex Implementation Spec

> Target repository: `tonyleesos/boardgame-online-platform`
>
> Target platform: the existing React + TypeScript + Vite + Firebase multiplayer boardgame platform.
>
> Extend the existing platform. Do not create a standalone app and do not break Avalon / Time Bomb / 同房異夢.

---

# 0. Product goal

Add a new 2–4 player engine-building/resource-management game module inspired by **《璀璨寶石》 / Splendor**.

Implement the **base game completely first**, then add four optional expansion modules:

```text
Base Game
├─ Development Cards
├─ Gem Tokens
├─ Gold / Joker Tokens
├─ Reserved Cards
├─ Nobles
├─ Prestige Score
└─ Final-round / tie-break logic

Optional Expansions
├─ Cities
├─ Trading Posts
├─ The Orient
└─ Strongholds
```

For initial implementation, a room may use the base game alone or base game + one supported expansion module. Do not allow untested expansion combinations.

---

# 1. Content boundary

Implement the rules, state machine, generic card engine, multiplayer flow, UI, and original project assets.

Do not copy official commercial artwork, logos, illustrations, rulebook text, or scraped full card/noble/city datasets into the repository.

Use a data-driven engine and original/demo data so legally usable datasets can later be added without modifying game logic.

---

# 2. Game metadata

```ts
export const splendorGame = {
  id: 'splendor',
  name: '璀璨寶石',
  minPlayers: 2,
  maxPlayers: 4,
  type: 'engine-building',
};
```

Reuse the platform's existing:

- Firebase Anonymous Auth;
- nickname;
- create/join room;
- room code;
- host/ready state;
- reconnect/presence;
- game router;
- common UI components;
- Firebase initialization and deployment structure.

Do not duplicate generic room infrastructure inside the Splendor module.

---

# 3. Recommended module structure

```text
client/src/games/splendor/
├─ components/
│  ├─ SplendorBoard.tsx
│  ├─ MarketTier.tsx
│  ├─ DevelopmentCard.tsx
│  ├─ GemBank.tsx
│  ├─ PlayerPanel.tsx
│  ├─ ReservedCards.tsx
│  ├─ NoblePanel.tsx
│  ├─ ActionPanel.tsx
│  ├─ TokenReturnDialog.tsx
│  ├─ NobleChoiceDialog.tsx
│  ├─ GameResultDialog.tsx
│  └─ expansions/
│     ├─ CitiesPanel.tsx
│     ├─ TradingPostsPanel.tsx
│     ├─ OrientMarket.tsx
│     └─ StrongholdsOverlay.tsx
├─ engine/
│  ├─ setup.ts
│  ├─ actions.ts
│  ├─ purchase.ts
│  ├─ validation.ts
│  ├─ scoring.ts
│  ├─ turn.ts
│  ├─ endGame.ts
│  ├─ selectors.ts
│  └─ expansions/
│     ├─ cities.ts
│     ├─ tradingPosts.ts
│     ├─ orient.ts
│     └─ strongholds.ts
├─ data/
│  ├─ demoCards.ts
│  ├─ demoNobles.ts
│  ├─ demoCities.ts
│  ├─ demoTradingPosts.ts
│  └─ demoOrientCards.ts
├─ types.ts
├─ constants.ts
├─ rules.ts
└─ index.ts
```

Keep rule evaluation independent from React/Firebase wherever possible.

---

# 4. Gem types

```ts
export type GemColor =
  | 'white'
  | 'blue'
  | 'green'
  | 'red'
  | 'black';

export type TokenColor = GemColor | 'gold';
```

Traditional Chinese labels:

```text
white  → 鑽石
blue   → 藍寶石
green  → 祖母綠
red    → 紅寶石
black  → 黑瑪瑙
gold   → 黃金（百搭）
```

Gold is not a permanent bonus.

---

# 5. Development card model

```ts
export type DevelopmentTier = 1 | 2 | 3;

export interface GemCost {
  white: number;
  blue: number;
  green: number;
  red: number;
  black: number;
}

export interface DevelopmentCard {
  id: string;
  tier: DevelopmentTier;
  bonusColor: GemColor;
  prestige: number;
  cost: GemCost;
  source?: 'base' | 'orient';
  orientEffect?: OrientEffectDefinition;
}
```

The data model is authoritative; never infer cost from visual presentation.

---

# 6. Base-game setup

There are three independent development decks: Tier 1 / Tier 2 / Tier 3.

At game start:

```text
shuffle each tier independently
→ reveal 4 face-up cards from each tier
→ keep remaining cards face-down as that tier's deck
```

Conceptual board:

```text
Tier 3: [card] [card] [card] [card] [deck]
Tier 2: [card] [card] [card] [card] [deck]
Tier 1: [card] [card] [card] [card] [deck]
```

Whenever a visible card leaves the market through purchase/reservation:

```text
refill its slot immediately from the same tier deck
```

If the deck is empty, leave the slot empty.

---

# 7. Noble setup

Visible nobles:

```text
player count + 1
```

Examples:

```text
2 players → 3 nobles
3 players → 4 nobles
4 players → 5 nobles
```

Unused nobles are removed from the match.

```ts
export interface NobleTile {
  id: string;
  prestige: number;
  requirements: Partial<Record<GemColor, number>>;
}
```

Only permanent development-card bonuses count toward noble requirements. Tokens and gold do not count.

---

# 8. Token-bank setup

Normal gem tokens:

```text
2 players → 4 of each normal color
3 players → 5 of each normal color
4 players → 7 of each normal color
```

Gold:

```text
5 gold tokens for all player counts
```

Implement:

```ts
createInitialTokenBank(playerCount: 2 | 3 | 4): TokenInventory
```

---

# 9. Player state

```ts
export interface SplendorPlayerState {
  uid: string;
  nickname: string;
  tokens: TokenInventory;
  purchasedCardIds: string[];
  reservedCards: ReservedCard[];
  prestige: number;
  bonuses: Record<GemColor, number>;
  nobles: NobleTile[];
  tradingPosts?: string[];
  strongholdsRemaining?: number;
  connected: boolean;
}
```

Purchased cards are authoritative. If bonus totals/prestige are cached, validate or derive them from authoritative state.

---

# 10. Turn flow

Each turn the active player performs exactly one primary action:

```text
A. Take up to 3 different normal gem colors
B. Take exactly 2 gems of the same color
C. Reserve 1 development card
D. Purchase 1 development card
```

Then:

```text
resolve token-limit return if needed
→ resolve noble visit/choice
→ resolve expansion post-action effects
→ check end-game trigger
→ advance turn
```

All validation must occur in trusted game logic, not only in the UI.

---

# 11. Take 3 different gems

The player may take up to 3 **different** normal colors that are currently available in the bank.

Never take gold through this action.

Valid:

```text
white + red + green
```

Invalid:

```text
red + red + blue
```

If fewer than three colors are available, allow only available distinct colors according to the base rule flow.

---

# 12. Take 2 gems of one color

Exactly 2 normal tokens of the same color may be taken only if the bank has at least 4 of that color **before** the action:

```ts
bank[color] >= 4
```

Gold cannot be taken this way.

---

# 13. Token limit

At turn end:

```text
max held tokens = 10
```

Count includes all normal gems + gold.

If over 10, enter:

```ts
'RETURN_EXCESS_TOKENS'
```

The player chooses tokens to return until exactly 10 remain. Gold may be returned.

The server validates ownership and exact return count.

---

# 14. Reserving cards

A player may reserve:

```text
1 visible market card
```

or:

```text
1 hidden top card from a chosen tier
```

Maximum reserved cards per player:

```text
3
```

Reserved cards cannot be voluntarily discarded; they leave reserve only when purchased.

Visible reservation:

```text
remove visible card
→ refill same tier
→ add card to player's reserve
```

Hidden reservation:

```text
draw top card from chosen tier
→ add privately to owner's reserve
```

Model:

```ts
export interface ReservedCard {
  cardId: string;
  visibility: 'public' | 'private';
}
```

The identity of a blindly reserved card must remain private to its owner.

---

# 15. Gold rule

Reserving is the only standard base-game way to gain gold.

```text
if bank.gold > 0:
    receive 1 gold
else:
    reserve normally without gold
```

If this creates more than 10 total tokens, resolve token return afterward.

---

# 16. Purchasing cards

A player may purchase:

```text
one visible market card
```

or:

```text
one of their reserved cards
```

Permanent bonuses reduce costs:

```ts
effectiveCost[color] = Math.max(
  0,
  card.cost[color] - player.bonuses[color]
);
```

Normal tokens pay remaining costs. Gold substitutes missing colors.

Base game:

```text
1 gold = 1 missing normal gem
```

Required pure function:

```ts
calculatePurchasePayment(
  card: DevelopmentCard,
  player: SplendorPlayerState
): PurchasePaymentResult
```

Suggested result:

```ts
interface PurchasePaymentResult {
  affordable: boolean;
  requiredAfterBonuses: Record<GemColor, number>;
  normalPayment: Record<GemColor, number>;
  goldPayment: number;
  totalTokensSpent: number;
}
```

After purchase:

```text
return spent tokens to bank
→ add card to player's purchased cards
→ apply permanent bonus
→ add prestige
→ refill market if card was public
```

---

# 17. Prestige

Prestige comes from:

```text
development cards
+ nobles
+ expansion effects
```

Provide a centralized selector:

```ts
calculatePrestige(player, gameState): number
```

Do not duplicate score logic in React components.

---

# 18. Noble visit

At end of turn, check visible nobles against the player's permanent bonuses.

If exactly one noble qualifies:

```text
automatically gain it
```

If multiple qualify:

```text
player chooses exactly one
```

Use phase:

```ts
'CHOOSE_NOBLE'
```

Gaining a noble does not use the primary action.

After claim:

```text
remove noble from center
→ add to player
→ add prestige
```

Do not refill nobles in the base game.

---

# 19. Base-game end trigger

When a player reaches at least:

```text
15 prestige
```

do not stop immediately.

Mark the current round as final and allow all players to finish the same number of turns.

Example order A → B → C → D:

```text
B reaches 15
→ C acts
→ D acts
→ game ends
```

Store explicit final-round state; do not infer it from UI.

---

# 20. Winner / tie-break

At final scoring:

1. highest prestige wins;
2. if tied, fewer purchased development cards wins;
3. if still tied, allow shared tie unless a later project rule specifies otherwise.

Implement:

```ts
determineSplendorWinners(state): SplendorWinnerResult
```

---

# 21. Base state machine

```ts
export type SplendorPhase =
  | 'SETUP'
  | 'PLAYER_ACTION'
  | 'RETURN_EXCESS_TOKENS'
  | 'CHOOSE_NOBLE'
  | 'RESOLVE_EXPANSION'
  | 'STRONGHOLD_BONUS_PURCHASE'
  | 'TURN_END'
  | 'GAME_OVER';
```

Suggested public state:

```ts
export interface SplendorPublicState {
  phase: SplendorPhase;
  playerOrder: string[];
  currentPlayerIndex: number;
  round: number;
  bank: TokenInventory;
  market: {
    tier1: Array<DevelopmentCard | null>;
    tier2: Array<DevelopmentCard | null>;
    tier3: Array<DevelopmentCard | null>;
  };
  deckCounts: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  nobles: NobleTile[];
  expansionConfig: SplendorExpansionConfig;
  endTriggeredBy?: string;
  finalRoundNumber?: number;
}
```

Do not publish deck order.

---

# 22. Firebase visibility

Public information may include:

- bank counts;
- visible market cards;
- visible nobles/cities;
- player prestige;
- permanent bonus totals;
- player token counts;
- number of reserved cards;
- publicly known reserved cards;
- current player/round;
- expansion state.

Private/server-only information must include:

- identity of blindly reserved cards;
- hidden deck order;
- randomized setup secrets;
- trusted-only intermediate data.

Conceptual structure:

```text
rooms/{roomCode}/game/public/...
privateGameData/{roomCode}/{uid}/reservedPrivate/...
serverGameData/{roomCode}/decks/...
```

Another client must not be able to read someone else's private reserved card.

---

# 23. Trusted operations

Recommended operations:

```text
startSplendorGame
takeDifferentGems
takeDoubleGem
reserveVisibleCard
reserveHiddenCard
purchaseVisibleCard
purchaseReservedCard
returnExcessTokens
chooseNoble
endSplendorTurn
```

Expansion operations later:

```text
claimCity
claimTradingPost
resolveOrientEffect
placeStronghold
removeOpponentStronghold
executeStrongholdBonusPurchase
```

Validate authenticated uid, room membership, game, phase, current player, bank supply, token ownership, card ownership/existence, payment, reserve limit, token limit, noble/city eligibility, and expansion legality.

Use atomic transactions/trusted server updates for race-sensitive actions.

Clients must never overwrite the whole game state directly.

---

# 24. Demo dataset

Create original demo data sufficient to exercise the engine. Suggested minimum:

```text
Tier 1: 15+ cards
Tier 2: 10+ cards
Tier 3: 10+ cards
Nobles: 6+
```

Requirements:

- all five bonus colors represented;
- zero-point and scoring cards;
- low/mid/high costs;
- reachable noble conditions;
- deterministic fixtures for tests.

Use seeded shuffle in automated tests.

---

# 25. Main UI

Desktop concept:

```text
┌──────────────────────────────────────────────────────────┐
│ 璀璨寶石      Round 6                Tony 的回合          │
├──────────────────────────────────────────────────────────┤
│ Nobles / Cities     [N] [N] [N] [N]                    │
├──────────────────────────────────────────────────────────┤
│ Tier III  [card] [card] [card] [card]  Deck: 14        │
│ Tier II   [card] [card] [card] [card]  Deck: 20        │
│ Tier I    [card] [card] [card] [card]  Deck: 30        │
├──────────────────────────────────────────────────────────┤
│ Bank      W 5  B 4  G 6  R 3  K 7  GOLD 2              │
├──────────────────────────────────────────────────────────┤
│ Players                                                  │
│ Tony      12pt   Tokens 8   Reserved 2                  │
│ Kevin      9pt   Tokens 5   Reserved 3                  │
└──────────────────────────────────────────────────────────┘
```

Each card prominently shows prestige, bonus color, cost, tier, and expansion icon if applicable.

---

# 26. Mobile UI

Mobile is mandatory.

Recommended hierarchy:

```text
Top bar: score / current player / round
Scrollable board:
  nobles/cities
  tier 3 horizontal row
  tier 2 horizontal row
  tier 1 horizontal row
  bank
Sticky bottom:
  my tokens
  my bonuses
  my reserved cards
  action/confirm
```

Tap a card for an action sheet:

```text
[ 購買 ]
[ 保留 ]
[ 取消 ]
```

Never rely on hover.

---

# 27. Gem-action UX

For 3-different action:

```text
select colors
→ display selected 0/3
→ confirm only when legal
```

For 2-same action:

```text
show ×2 only on colors whose bank count >= 4
```

Do not auto-submit on the first tap.

---

# 28. Purchase preview

Before purchase show:

```text
Card cost
Permanent discounts
Actual payment
Gold used
Tokens remaining
```

Normal mode may suggest the legal payment. The server remains authoritative.

---

# 29. Reserved-card UX

Owner sees:

```text
保留卡 2 / 3
```

and may inspect their own reserved cards.

Other players see reserve counts. A blind reservation is represented as face-down/unknown to opponents.

Do not leak private identity in logs or client state.

---

# 30. Expansion configuration

```ts
export interface SplendorExpansionConfig {
  cities: boolean;
  tradingPosts: boolean;
  orient: boolean;
  strongholds: boolean;
  competitorMode?: boolean;
}
```

For initial release enforce:

```text
Base always on
0 or 1 major expansion module enabled
```

unless specific combinations are explicitly implemented and tested.

Use extension hooks such as:

```ts
beforePrimaryAction(...)
afterCardPurchased(...)
afterPrimaryAction(...)
beforeTurnEnd(...)
evaluateEndCondition(...)
modifyPaymentRules(...)
```

---

# 31. Expansion — Cities

When Cities is enabled:

```text
Cities replace Nobles
```

Setup:

```text
reveal exactly 3 City tiles
```

No nobles are used.

Generic model:

```ts
export interface CityTile {
  id: string;
  minimumPrestige?: number;
  bonusRequirements?: Partial<Record<GemColor, number>>;
  additionalRequirements?: CityRequirement[];
}
```

A player qualifies by satisfying all conditions of a City.

Once a player satisfies a City:

```text
finish the current round
```

Then among City-qualified players:

```text
highest prestige wins
```

Do not use the base 15-point end trigger unless required by the configured City itself.

---

# 32. Expansion — Trading Posts

Each player owns:

```text
5 personal trading-post markers
```

At end of turn evaluate trading-post conditions. When achieved, activate the corresponding post and its persistent ability.

Represent abilities as typed modifiers instead of UI special cases:

```ts
export type TradingPostEffect =
  | ExtraDifferentGemEffect
  | GoldValueModifierEffect
  | BonusPrestigeEffect
  | TokenReturnModifierEffect
  | CustomTradingPostEffect;
```

Engine must support effects such as:

- extra token after taking different gems;
- gold having modified payment value;
- bonus-based prestige;
- token-return modifications.

Provide:

```ts
applyTradingPostModifiers(action, player, state)
```

---

# 33. Expansion — The Orient

When Orient is enabled, add:

```text
2 face-up Orient cards beside each standard tier
```

Conceptually:

```text
Tier 3: base ×4 + orient ×2
Tier 2: base ×4 + orient ×2
Tier 1: base ×4 + orient ×2
```

Use typed effects:

```ts
export type OrientEffectDefinition =
  | DoubleBonusEffect
  | CopyBonusEffect
  | ReturnPurchasedCardEffect
  | ReserveSpecialEffect
  | NobleInteractionEffect
  | CustomOrientEffect;
```

Support effect capabilities such as:

- double permanent bonus;
- copy/dependent bonus;
- special purchase requirement;
- return/remove a purchased card as part of an effect;
- noble-related effects.

Every effect must provide `validate()` and `resolve()` and have unit tests.

Base payment logic must use effective bonuses rather than assuming one card always equals exactly one bonus.

---

# 34. Expansion — Strongholds

Each player starts with:

```text
3 strongholds
```

After purchasing a card, a player may perform a legal stronghold manipulation, such as placing one of their strongholds on a visible card or removing an opponent's stronghold according to configured rules.

State:

```ts
export interface StrongholdPlacement {
  cardId: string;
  ownerUid: string;
  count: number;
}
```

A card protected by another player's stronghold cannot normally be purchased or reserved by you.

If one player has all 3 strongholds on the same card, allow a post-action bonus-purchase flow:

```ts
'STRONGHOLD_BONUS_PURCHASE'
```

The trusted engine validates affordability and legality. The client must not directly grant the card.

When a protected market card leaves play, return strongholds to owners unless an implemented rule explicitly says otherwise.

---

# 35. Optional Competitor Mode

```ts
competitorMode: boolean
```

Default false.

Normal mode may show:

- affordable-card highlights;
- eligibility for taking two same-color gems;
- suggested payment;
- suggested gold usage;
- noble eligibility preview.

Competitor mode hides strategic assistance such as affordability highlighting or automatic payment hints, while preserving readable public information and server-side legality checks.

---

# 36. Reconnect / disconnect

Reconnect must restore:

- room and player identity;
- current turn;
- bank;
- market;
- nobles/cities;
- player's tokens/bonuses/purchased cards;
- private reserved cards;
- expansion state;
- any pending return/choice/bonus-purchase phase.

Temporary disconnect retains the player's seat/state and shows a disconnected indicator. Do not auto-play strategic actions.

---

# 37. Pure engine functions

Create/test at least:

```ts
canTakeDifferentGems(...)
canTakeDoubleGem(...)
canReserveCard(...)
canPurchaseCard(...)
calculateEffectiveCost(...)
calculatePurchasePayment(...)
applyPurchase(...)
getEligibleNobles(...)
mustReturnTokens(...)
calculatePrestige(...)
shouldTriggerFinalRound(...)
determineSplendorWinners(...)
```

Expansion helpers:

```ts
getEligibleCities(...)
evaluateTradingPosts(...)
resolveOrientEffect(...)
canInteractWithStrongholdCard(...)
```

React must not duplicate these calculations.

---

# 38. Required base-game tests

## Setup

- 2 players → 4 per normal color + 5 gold.
- 3 players → 5 per normal color + 5 gold.
- 4 players → 7 per normal color + 5 gold.
- up to 4 visible cards per tier.
- nobles = player count + 1.

## Gem actions

- taking 3 distinct available colors succeeds;
- duplicate color in 3-different action fails;
- 2-same succeeds only when bank initially has >=4;
- 2-same fails at <=3;
- gold cannot be taken as a normal gem action.

## Token limit

- 10 is legal;
- 11+ enters return phase;
- exact excess must be returned;
- returned tokens go to bank.

## Reserve

- visible reserve works and refills market;
- blind reserve works;
- blind identity remains private;
- max 3 reserved cards;
- receive gold if available;
- reserve still works with no gold available.

## Purchase

- permanent bonuses reduce cost;
- cost never below zero;
- gold substitutes missing gems;
- spent tokens return to bank;
- purchased card adds bonus and prestige;
- reserved card can be purchased;
- unaffordable purchase rejected.

## Nobles

- only permanent bonuses count;
- one eligible noble auto-awards;
- multiple require a choice;
- nobles do not refill.

## End game

- 15+ triggers final round;
- all players finish equal turns;
- highest prestige wins;
- prestige tie → fewer purchased cards wins.

---

# 39. Required expansion tests

## Cities

- Cities replace nobles;
- exactly 3 visible;
- City qualification triggers final-round logic;
- only City-qualified players are eligible to win.

## Trading Posts

- requirement unlocks only once;
- persistent modifier applies;
- modified gold/payment behavior respected;
- no duplicate claims.

## Orient

- 2 visible Orient cards per tier;
- proper refill source;
- special bonuses affect effective bonuses correctly;
- effects resolve atomically.

## Strongholds

- each player starts with 3;
- legal placement/removal;
- protected card blocks unauthorized interaction;
- 3 strongholds unlock bonus-purchase phase;
- strongholds return when card leaves market.

---

# 40. Visual direction

Use original CSS/SVG/project-owned assets.

Suggested style:

```text
Renaissance jewel merchant
+ dark navy / burgundy
+ gold accents
+ glass/gem effects
+ premium card depth
```

Do not copy official illustrations.

---

# 41. Motion

Use Motion sparingly for:

- gem pickup/return;
- card purchase;
- market refill;
- blind reservation flip;
- gold award;
- noble visit;
- City completion;
- trading-post unlock;
- stronghold placement;
- final-round notification;
- victory.

Animations must not block gameplay. Respect `prefers-reduced-motion`.

---

# 42. Game log

Maintain a public non-secret action log.

Examples:

```text
Tony 拿取了 3 種寶石
Kevin 保留了一張公開的 Tier 2 卡
Amy 保留了一張 Tier 1 暗牌
Jack 購買了一張發展卡
Tony 獲得了一位貴族
```

Never expose hidden-card identity.

---

# 43. Error messages

Traditional Chinese examples:

```text
目前不是你的回合
該寶石目前不足
只有寶石庫中至少有 4 枚時才能一次拿取 2 枚
你的保留卡已達 3 張上限
你目前無法支付這張卡牌
此卡牌已被其他玩家操作，請重新選擇
請先將代幣退回至 10 枚
```

Stale-state failures should re-sync state and preserve the session.

---

# 44. Security requirements

Never trust client-provided:

```text
uid
payment calculation
prestige
bonus total
card ownership
reserved identity
current player
end-game flag
```

A malicious client must not be able to:

- take unavailable gems;
- take 2 same-color when bank < 4;
- reserve >3 cards;
- read another player's blind reservation;
- purchase unaffordable cards;
- claim invalid nobles/cities;
- act out of turn;
- alter another player's tokens;
- forge prestige;
- skip mandatory token return.

---

# 45. Implementation milestones

## S1 — Game registration + skeleton

Add game catalog entry, route/module, 2–4 player constraints, responsive empty board, expansion config.

Acceptance:

```text
create room
→ select 璀璨寶石
→ 2–4 players ready
→ host starts
→ Splendor board renders
```

## S2 — Setup engine

Implement token bank, decks, markets, nobles, players, seeded setup tests.

## S3 — Base actions

Implement take-3, take-2, reserve public/private, gold, purchase, token return.

## S4 — Noble/scoring/endgame

Implement bonuses, nobles, prestige, 15-point final round, tie-break.

## S5 — Firebase multiplayer

Synchronize authoritative state and protect hidden reserved cards.

Acceptance with two browsers:

```text
Tony takes gems
→ Kevin sees bank update immediately
→ turn advances
→ Kevin buys a card
→ Tony sees market refill immediately
```

## S6 — Complete base-game UI

Implement market, bank, player panels, purchase preview, reserve, token return, noble choice, result, mobile UI, reconnect.

Acceptance: 2–4 browser sessions can finish a full base game without manual DB edits.

## S7 — Cities

Implement setup, requirements, ending/winner logic, UI.

## S8 — Trading Posts

Implement markers, requirements, persistent modifiers, UI.

## S9 — Orient

Implement separate Orient market/decks, typed effects, atomic resolution, UI.

## S10 — Strongholds

Implement placement/removal/protection/3-stronghold bonus purchase, UI.

## S11 — Polish / Competitor Mode

Responsive polish, animations, game log, accessibility, optional hint suppression, robust retry/error handling.

---

# 46. Definition of Done — Base Game

Base game is done only when:

- 璀璨寶石 appears in catalog;
- existing auth/room infrastructure reused;
- 2–4 players supported;
- correct token setup;
- three card tiers;
- four face-up cards per tier;
- take 3 different works;
- take 2 same with >=4-bank rule works;
- reserve visible/hidden works;
- reserve max 3;
- gold behavior works;
- 10-token limit works;
- discounts/payment/gold substitution work;
- prestige works;
- nobles work;
- 15-point final round works;
- tie-break works;
- blind reserved cards stay private;
- reconnect works;
- mobile UI usable;
- tests/lint/build pass;
- Firebase rules updated.

---

# 47. Definition of Done — Full Spec

Full feature additionally requires:

- Cities complete;
- Trading Posts complete;
- Orient complete;
- Strongholds complete;
- expansion rules tested;
- unsupported combinations prevented;
- Competitor mode works if enabled;
- mobile expansion UI works;
- README documents how to test each module.

---

# 48. Priority order

```text
rule correctness
> transaction/state integrity
> private-information security
> realtime synchronization
> mobile usability
> visual polish
> animation
```

---

# 49. Final instructions to Codex

Before editing:

1. Inspect the current repository.
2. Read the existing platform architecture.
3. Reuse current room/auth/Firebase abstractions.
4. Inspect how Avalon / Time Bomb / 同房異夢 are registered.
5. Do not create a second app or duplicate Firebase initialization.
6. Preserve all existing games.

Implement sequentially:

```text
S1 → S2 → S3 → S4 → S5 → S6
```

Get the **base game completely playable first**.

Then continue:

```text
S7 Cities
→ S8 Trading Posts
→ S9 Orient
→ S10 Strongholds
→ S11 polish
```

After each major milestone:

```text
run tests
run lint
run build
inspect git diff
```

Fix failures before continuing.

If Firebase deployment/Console configuration requires project-owner credentials or a manual action, complete all repository-side work possible and report the exact remaining manual step.

Do not stop after scaffolding. Begin implementation.
