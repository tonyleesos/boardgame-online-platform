# 血與刃的白薔薇（Blades & Rose）Web Game — Codex Implementation Spec

> Target repository: `tonyleesos/boardgame-online-platform`
>
> Target platform: the existing React + TypeScript + Vite + Firebase multiplayer boardgame platform.
>
> This document is an implementation instruction for Codex / coding agents working directly in VS Code.
>
> **Directive:** extend the existing platform. Do not create a second React app, do not duplicate Firebase initialization, and do not break existing games.
>
> **UI requirement:** this game must use a convincing **physical tabletop card / ritual-board presentation** from the first implementation milestone. Do not leave generic buttons/cards as the final UI.

---

# 0. Research status and important verification rule

This specification was prepared from public rules/reference material for:

```text
血與刃的白薔薇
Blades & Rose
血と刃の白薔薇
```

Primary references:

```text
https://www.chitchatclinic.com.tw/blog/blade-rose
https://www.jp.moaideas.net/bladerose
https://joinboardgame.pixnet.net/blog/posts/16110660866
https://punchboardgame.blogspot.com/2024/04/by_10.html
https://home.gamer.com.tw/artwork.php?sn=5800402
```

Official Moaideas information confirms:

```text
5–10 players
20–40 minutes
31 role cards
3 player-count boards
10 magic-book/help cards
12 crystal chips
1 coin
```

Public rule articles clearly confirm:

```text
two factions
six identity roles
3-card starting hand
night recognition
Double Blade special exchange
one secret white crystal per player
coin / starting-player flow
face-down play-or-pass decisions
shuffle and anonymous reveal
blood-blade resolution
White Rose immediate-death condition
one crystal use per player
```

## VERY IMPORTANT: player-count balance tables

The exact official **5–10 player role composition and sacrifice/kill thresholds** are printed on physical setup/player boards and are not fully represented as reliable text in the public sources used here.

The **8-player values are independently documented in text** and may be treated as verified:

```text
8 players
White Rose faction: 5 players
Blood Blade faction: 3 players

Identity roles:
White Rose ×1
Bishop ×1
Follower ×3
Double Blade ×1
Great Blade ×1
Dark Blade ×1

White victory threshold:
White Rose safely sacrificed
AND 5 buds safely sacrificed

Blood victory threshold:
White Rose killed
OR 6 buds killed
OR final-round unresolved flower condition
```

For all other player counts:

> Do not invent numbers inside gameplay code.

Implement a single data-driven `PLAYER_COUNT_RULES` table and mark every entry with a verification flag.

Example:

```ts
interface PlayerCountRule {
  playerCount: 5 | 6 | 7 | 8 | 9 | 10;

  identities: {
    whiteRose: number;
    bishop: number;
    follower: number;
    doubleBlade: number;
    greatBlade: number;
    darkBlade: number;
  };

  requiredSafeBuds: number;
  bloodKillThreshold: number;

  verifiedAgainstOfficialBoard: boolean;
  verificationNote?: string;
}
```

The repository may contain provisional/transcribed values only if they are explicitly marked:

```ts
verifiedAgainstOfficialBoard: false
```

Before enabling a player-count configuration in production, verify that row against:

```text
official rulebook
OR
a clear photograph of the corresponding official player board
```

Do not silently derive thresholds from a formula.

---

# 1. Product goal

Add a complete digital implementation of **《血與刃的白薔薇》**.

This is a 5–10 player hidden-role social-deduction game.

Two factions:

```text
⚪ White Rose faction / 白薔薇陣營
vs
🔴 Blood Blade faction / 血刃陣營
```

Core experience:

```text
secret identity
+
3-card personal hand
+
secret one-time crystal ability
+
discussion / bluffing
+
ordered play-or-pass decisions
+
anonymous face-down contribution
+
dramatic shuffled reveal
+
sacrifice vs slaughter race
```

The central tension is:

> White-side players need to safely contribute flower cards without exposing the White Rose, while Blood-side players need to time their blade cards so they kill enough flowers or strike the White Rose itself.

---

# 2. Game metadata

```ts
export const bladesAndRoseGame = {
  id: 'blades-and-rose',
  name: '血與刃的白薔薇',
  minPlayers: 5,
  maxPlayers: 10,
  type: 'social-deduction',
};
```

Recommended game catalog card:

```text
┌──────────────────────────────┐
│      血與刃的白薔薇           │
│       BLADES & ROSE          │
│                              │
│  5–10 人 · 陣營 · 推理        │
│                              │
│       [ 建立房間 ]            │
└──────────────────────────────┘
```

Reuse existing platform infrastructure:

- Firebase Anonymous Auth;
- nickname;
- create/join room;
- room code;
- host;
- ready state;
- reconnect;
- shared lobby;
- shared game router;
- loading/error/toast primitives;
- current platform deployment conventions.

Do not duplicate generic platform room logic.

---

# 3. Copyright / visual-content boundary

The user wants the web game to strongly evoke the **physical card game**.

Implement:

```text
physical card proportions
dark-fantasy mood
ritual-board presentation
black / ivory / crimson visual language
white-rose vs blood-blade contrast
crystal tokens
coin token
card fan / card flip / shuffled reveal
```

However:

> Do NOT use scans or copied official commercial illustrations.

Do not:

- download official role-card images into the repository;
- trace official character artwork;
- reproduce the official logo as an asset;
- recreate official illustrations pixel-for-pixel;
- paste long rulebook text onto cards.

Use original project-owned:

```text
SVG illustrations
CSS shapes
textures
icons
silhouettes
ornaments
```

Art direction may be inspired by:

```text
gothic dark fantasy
ritual manuscripts
cathedral iconography
blackened steel
white roses
blood-red blades
aged parchment
```

but must be an original digital design.

---

# 4. Physical-card UI requirement — HIGH PRIORITY

Public descriptions of the Traditional Chinese physical edition cite a sleeve/card size around:

```text
65 mm × 100 mm
```

Use approximately:

```css
aspect-ratio: 65 / 100;
```

Recommended reusable component:

```tsx
<BladesRoseCard
  card={card}
  mode="hand | table | preview | faceDown"
  selected={boolean}
  disabled={boolean}
/>
```

Card should look physically printed:

```text
thin ornamental frame
dark matte paper
subtle grain
raised shadow
slight edge wear/noise
serif/gothic title treatment
clear faction glyph
large original character/symbol illustration
small concise rule/icon area
```

Example:

```text
┌──────────────────────┐
│       白薔薇          │
│          ✦           │
│                      │
│      ORIGINAL        │
│    DARK-FANTASY      │
│       ARTWORK        │
│                      │
│        🌹            │
│                      │
├──────────────────────┤
│      WHITE ROSE      │
└──────────────────────┘
```

The primary play action should be selecting a **card itself**, not clicking a generic text button representing it.

---

# 5. Recommended source structure

```text
client/src/games/blades-and-rose/
├ components/
│  ├ BladesRoseBoard.tsx
│  ├ BladesRoseCard.tsx
│  ├ PhysicalCardFrame.tsx
│  ├ PlayerSeat.tsx
│  ├ PlayerHand.tsx
│  ├ RitualBoard.tsx
│  ├ SacrificeTrack.tsx
│  ├ DeathTrack.tsx
│  ├ CrystalToken.tsx
│  ├ CoinToken.tsx
│  ├ CrystalRevealDialog.tsx
│  ├ NightKnowledgeDialog.tsx
│  ├ PlayDecisionDialog.tsx
│  ├ RevealSequence.tsx
│  ├ RoundResultDialog.tsx
│  ├ ResultDialog.tsx
│  └ skills/
│     ├ SkillTargetDialog.tsx
│     ├ ForcedCardChoiceDialog.tsx
│     ├ Skill9PrivateReveal.tsx
│     ├ Skill10ReplacementDialog.tsx
│     └ Skill11PeekDialog.tsx
│
├ engine/
│  ├ setup.ts
│  ├ roles.ts
│  ├ hand.ts
│  ├ night.ts
│  ├ crystalSkills.ts
│  ├ playConstraints.ts
│  ├ round.ts
│  ├ reveal.ts
│  ├ scoring.ts
│  ├ winConditions.ts
│  ├ validation.ts
│  └ selectors.ts
│
├ data/
│  ├ playerCountRules.ts
│  ├ cardDefinitions.ts
│  └ crystalSkillDefinitions.ts
│
├ types.ts
├ constants.ts
├ rules.ts
└ index.ts
```

Keep rule logic pure and independently testable.

---

# 6. Identity roles

Six identity types:

```ts
export type BladesRoseIdentity =
  | 'WHITE_ROSE'
  | 'BISHOP'
  | 'FOLLOWER'
  | 'DOUBLE_BLADE'
  | 'GREAT_BLADE'
  | 'DARK_BLADE';
```

Traditional Chinese:

```text
WHITE_ROSE   → 白薔薇
BISHOP       → 司教
FOLLOWER     → 信者
DOUBLE_BLADE → 雙刃
GREAT_BLADE  → 巨刃
DARK_BLADE   → 暗刃
```

Faction:

```ts
export type BladesRoseFaction =
  | 'WHITE_ROSE'
  | 'BLOOD_BLADE';
```

Mapping:

```text
White faction:
- White Rose
- Bishop
- Follower

Blood faction:
- Double Blade
- Great Blade
- Dark Blade
```

---

# 7. Identity is NOT the same as current hand

This is critical.

Each player initially receives an identity card, but later may play that physical card.

Playing the identity card does **not** change faction or identity.

Therefore store:

```ts
interface PrivatePlayerState {
  identity: BladesRoseIdentity;
  faction: BladesRoseFaction;

  hand: BladesRoseCard[];

  crystalSkillId: CrystalSkillId;
  crystalUsed: boolean;

  privateKnowledge: PrivateKnowledge;
}
```

Do not infer current identity from:

```text
which role card remains in the hand
```

Example:

```text
Amy starts as WHITE_ROSE
Amy safely plays the White Rose card

Amy is STILL a White Rose faction player
until the game ends.
```

---

# 8. Card categories

Players use physical hand cards.

```ts
export type BladesRoseCardType =
  | 'WHITE_ROSE'
  | 'BISHOP'
  | 'FOLLOWER'
  | 'GHOST'
  | 'DOUBLE_BLADE'
  | 'GREAT_BLADE'
  | 'DARK_BLADE';
```

Semantic card classes:

```text
White Rose       → flower / major flower
Bishop           → flower / bud
Follower         → flower / bud
Ghost            → decoy / no-result card
Double Blade     → blade
Great Blade      → blade
Dark Blade       → blade
```

Helpers:

```ts
isFlowerCard(card)
isMajorFlower(card)
isBudCard(card)
isBladeCard(card)
isGhostCard(card)
```

---

# 9. Standard three-card starting hand

Every player receives:

```text
1 Follower card
1 Ghost card
1 identity card
```

after identity assignment.

Therefore examples:

```text
White Rose:
White Rose + Follower + Ghost

Bishop:
Bishop + Follower + Ghost

Great Blade:
Great Blade + Follower + Ghost

Dark Blade:
Dark Blade + Follower + Ghost
```

A normal Follower identity player effectively has:

```text
Follower + Follower + Ghost
```

because the identity card is also a Follower card.

---

# 10. Double Blade special hand

Double Blade is the exception.

During the night setup:

```text
Double Blade exchanges their Ghost
with the spare Double Blade card
placed in the center.
```

Final Double Blade hand:

```text
Double Blade
Double Blade
Follower
```

No Ghost.

Do not model this as merely:

```ts
doubleBladeAttackCount = 2
```

The actual hand must contain two separately playable Double Blade card instances.

This matters for:

```text
forced play
random card selection
hand counts
skill interactions
```

---

# 11. Initial setup

Conceptual setup:

```text
1. validate 5–10 players
2. load verified PLAYER_COUNT_RULES row
3. build identity pool
4. shuffle identity pool server-side
5. assign exactly one identity to each player
6. give every player:
     Follower
     Ghost
     identity card
7. put one spare Double Blade in central setup reserve
8. randomly select one of 12 white crystals for each player
9. each player privately learns only their own crystal
10. randomize initial coin holder / setup start flow
11. perform night-knowledge setup
12. resolve Double Blade Ghost → spare Double Blade exchange
13. enter daytime discussion
```

Do not publish identity assignment or crystal assignment.

---

# 12. White crystals

There are:

```text
12 unique white crystals
```

numbered:

```text
1–12
```

Each player receives exactly one unused/random crystal.

A player's crystal number/effect is private until activated.

Players may discuss:

```text
"I like my skill"
"Mine is useful"
"Mine is dangerous"
```

and may lie.

They should **not explicitly disclose**:

```text
exact crystal number
exact printed effect
```

The web application cannot police external voice chat.

For built-in UI:

- do not provide a "share skill" button;
- do not auto-post number/effect to public log before activation;
- rules/help should remind players of the communication restriction.

---

# 13. Crystal use and maximum rounds

Each crystal can be activated only once.

Every round consumes exactly one player's crystal.

Therefore:

```text
maximum normal round count = player count
```

Example:

```text
8 players → at most 8 crystal rounds
```

After the final unused crystal is activated and that round resolves:

```text
run final-round victory resolution
```

if no earlier immediate victory occurred.

---

# 14. Coin / next-start-player flow

Use the coin as the public turn-lead token.

Conceptual flow:

```text
current coin holder
↓
selects another player with UNUSED crystal
↓
passes coin to that player
↓
recipient reveals/activates crystal
↓
recipient becomes this round's starting player
↓
play decisions proceed clockwise
↓
round resolves
↓
current coin holder chooses a still-unused crystal holder
```

For the very first round, follow the selected edition's setup semantics consistently.

Recommended digital implementation:

```text
random initial selector receives coin
↓
selects first crystal user
↓
that recipient becomes first actual round leader
```

Do not allow selecting a player whose crystal is already used.

On the final unused crystal:

```text
no next-start-player selection exists
```

Proceed to final resolution.

---

# 15. Night recognition — initial knowledge

The most detailed public Traditional Chinese rules identify the initial recognition group as:

```text
White Rose
Bishop
Double Blade
Great Blade
```

These roles mutually see/recognize the members of this group.

The following do not participate in initial mutual recognition:

```text
Follower
Dark Blade
```

Digital implementation:

Do NOT emulate "close eyes" literally.

Give each eligible player a private knowledge screen:

```text
你在夜色中認出了：

Kevin — ?
Amy   — ?
Jack  — ?

These players belong to the night-recognition group.
Their exact identity is not necessarily labeled unless the physical rule grants that information.
```

If the public/official rule interpretation used by this project allows exact role labels, store exact labels; otherwise only identify the players in the group.

Recommended product contract:

```text
eligible players learn WHICH PLAYERS are in the recognition group,
but do not receive extra machine-generated strategic conclusions.
```

After acknowledgment, remove the temporary modal but persist legally learned knowledge in that player's private knowledge model if the UI offers a personal notes/reference screen.

Do not expose it publicly.

---

# 16. Important source discrepancy guard

One secondary public strategy article lists a different fourth role during night recognition.

More detailed setup articles and the physical-card "eye" icon descriptions identify:

```text
Great Blade
```

as the blood-side recognition role, while:

```text
Dark Blade
```

remains blind initially and may gain special knowledge through crystal skill 9.

Therefore implement:

```text
White Rose + Bishop + Double Blade + Great Blade
```

for initial recognition.

Add a rule-source comment in code so this is not casually "corrected" later from a weaker secondary source.

---

# 17. Double Blade exchange phase

After initial recognition:

```text
only the Double Blade player resolves the special exchange
```

Server action:

```ts
exchangeDoubleBladeGhost(uid)
```

Validation:

```text
uid identity == DOUBLE_BLADE
hand contains GHOST
central reserve contains spare DOUBLE_BLADE
```

Atomic result:

```text
remove Ghost from player's hand
remove spare Double Blade from reserve
add second Double Blade to player's hand
```

This is secret.

Public UI should show only:

```text
夜晚儀式進行中……
```

Do not reveal that a particular user performed a transaction.

---

# 18. Daytime discussion

Between secret/night setup and each round's play decision:

```text
free discussion is allowed
```

Players may:

```text
bluff
claim alignments
claim intentions
discuss who should receive coin
discuss whether a round looks safe
```

Do not implement an automatic "truth checker".

For MVP:

```text
players can use external voice / in-person discussion
```

No built-in voice is required.

Optional platform text chat must not automatically expose private data.

---

# 19. Round state machine

Recommended phases:

```ts
export type BladesRosePhase =
  | 'SETUP'
  | 'NIGHT_RECOGNITION'
  | 'DOUBLE_BLADE_EXCHANGE'
  | 'DISCUSSION'
  | 'SELECT_CRYSTAL_USER'
  | 'CRYSTAL_REVEAL'
  | 'SKILL_TARGETING'
  | 'SKILL_RESOLUTION'
  | 'PLAY_DECISIONS'
  | 'SKILL_10_POST_SELECTION'
  | 'COLLECT_PLAYED_CARDS'
  | 'SHUFFLE_REVEAL'
  | 'ROUND_RESULT'
  | 'WIN_CHECK'
  | 'GAME_OVER';
```

Do not implement this through dozens of unrelated React-local booleans.

---

# 20. Basic play-or-pass sequence

After the crystal skill resolves enough to establish constraints:

```text
start with the current coin holder / round leader
↓
clockwise seat order
↓
each player chooses:
   PLAY exactly one legal card face-down
   OR
   PASS
```

A player's decision may be affected by the active crystal skill.

Once a player locks the decision:

```text
it cannot be changed
```

except where skill 10 explicitly permits replacement.

Public state may show:

```text
Tony 已決定
Kevin 思考中
Amy 已決定
```

Never show:

```text
Tony played a blade
Kevin passed
```

unless the rule/effect legitimately exposes it.

Whether a user played or passed may itself be inferable physically; follow the chosen product UX consistently.

Recommended secrecy:

```text
publicly show decision-complete,
not PLAY/PASS choice,
until reveal.
```

This is slightly more secrecy-preserving for remote play.

---

# 21. Played-card anonymity

Normal round:

```text
collect all face-down submitted cards
shuffle them
reveal only after shuffle
```

The normal public result must NOT preserve:

```text
which player contributed which card
```

Required server model:

```ts
interface AnonymousRoundContribution {
  serverContributionId: string;
  cardInstanceId: string;
  sourceUid: string; // server-only
}
```

Public reveal:

```ts
interface PublicRevealedCard {
  revealId: string;
  cardType: BladesRoseCardType;
}
```

Do not include `sourceUid`.

Exception:

```text
crystal skill 2
```

which intentionally disables the anonymity shuffle / preserves source order/identity per the skill rule.

---

# 22. Round reveal result

After collection/reveal:

## Ghost

```text
Ghost cards have no scoring effect.
```

Move to discard/out-of-play history.

## No Blood Blade in reveal

All revealed white flower cards are safe/successful sacrifices:

```text
White Rose → safe major flower
Bishop     → safe bud
Follower   → safe bud
```

Update:

```text
safeWhiteRose
safeBudCount
```

## One or more Blood Blades in reveal

Every white flower card revealed in that batch is killed.

Update:

```text
killedWhiteRose
killedBudCount
```

All revealed blade cards are also moved to appropriate revealed/used area.

## White Rose + any Blade

Immediate Blood Blade faction victory:

```text
endReason = WHITE_ROSE_KILLED
```

Do not wait for the remainder of normal game flow.

---

# 23. White faction victory

White faction wins if an official player-count condition is met.

Primary pattern:

```text
White Rose has been safely sacrificed
AND
safeBudCount >= requiredSafeBuds
```

There is also a final-round condition documented in public rules:

```text
after all crystals are used,
if White-faction players have no remaining unresolved flower cards
that the final board condition requires,
White may win
```

Model this with an explicit function:

```ts
evaluateFinalRoundWhiteCondition(state, rules): boolean
```

Do not embed a vague condition inside UI text.

For 8-player verified example:

```text
safe White Rose
+
5 safely sacrificed buds
```

is sufficient.

---

# 24. Blood faction victory

Blood Blade faction wins immediately if:

```text
White Rose is killed by a reveal containing any blade
```

or if:

```text
killedBudCount >= player-count-specific bloodKillThreshold
```

Blood also wins through the final-round unresolved-flower condition when all crystals are exhausted and White has not met the applicable completion requirement.

Use:

```ts
evaluateBloodVictory(...)
```

and:

```ts
evaluateFinalRoundWinner(...)
```

as pure functions.

---

# 25. 8-player verified rule fixture

Add an explicit immutable test fixture:

```ts
export const VERIFIED_EIGHT_PLAYER_RULE: PlayerCountRule = {
  playerCount: 8,

  identities: {
    whiteRose: 1,
    bishop: 1,
    follower: 3,
    doubleBlade: 1,
    greatBlade: 1,
    darkBlade: 1,
  },

  requiredSafeBuds: 5,
  bloodKillThreshold: 6,

  verifiedAgainstOfficialBoard: true,
};
```

Test:

```text
White Rose + 5 safe buds → White win
White Rose + 4 safe buds → no threshold win
6 killed buds → Blood win
5 killed buds → no kill-threshold win
White Rose killed → Blood immediate win
```

---

# 26. Player-count configuration validation

Before a match starts:

```ts
validatePlayerCountRule(rule)
```

Must ensure:

```text
identity counts sum to player count
exactly one White Rose
exactly one Bishop
exactly one Double Blade
no negative values
thresholds defined
verified flag policy satisfied
```

Production behavior:

```text
if rule.verifiedAgainstOfficialBoard === false
AND productionStrictRules === true:

    disable that player count
    show host:
    "此人數規則尚未完成官方圖板校對"
```

Development mode may allow provisional rows for testing.

This is preferable to silently shipping guessed balance values.

---

# 27. Crystal skill engine

Do not implement white-crystal effects directly inside React components.

Use typed definitions:

```ts
export type CrystalSkillId =
  | 1 | 2 | 3 | 4 | 5 | 6
  | 7 | 8 | 9 | 10 | 11 | 12;
```

```ts
interface CrystalSkillDefinition {
  id: CrystalSkillId;
  mandatory: boolean;
  timing: CrystalSkillTiming;
  effect: CrystalSkillEffect;
}
```

Known rule:

```text
Skills 1–9, 11, 12 are mandatory.
Skill 10 is optional.
```

---

# 28. Crystal skill 1 — force one player to play

Digital behavior:

```text
choose one player who has at least one card
```

That target receives:

```ts
mustPlay = true
```

for this round.

When their decision turn arrives:

```text
PASS is disabled
they must choose one legal hand card
```

Do not auto-select the actual card unless only one legal card exists.

---

# 29. Crystal skill 2 — reveal without shuffle

Normal round anonymity is disabled for this round.

Players still make face-down decisions in normal seat order.

At reveal:

```text
do NOT shuffle contributions
reveal them preserving contribution/source relationship
```

UI may show:

```text
Tony → Follower
Kevin → Ghost
Amy → Double Blade
```

because this skill intentionally exposes origin information.

Do not accidentally keep cards anonymous.

---

# 30. Crystal skill 3 — random card from right neighbor becomes constrained card

Trusted/server logic randomly selects one card from the skill user's right neighbor's current hand.

The selected card identity is handled according to the physical skill's information rule; do not let the client choose the random index.

For this digital contract:

```text
if neighbor has cards:
   select exactly one random card
   that card becomes the neighbor's ONLY card they may submit this round
   they may still follow the printed skill's required/optional play semantics
if neighbor has zero cards:
   no effect
```

Store:

```ts
roundConstraints[neighborUid].lockedCardId
```

Do not leak the locked card identity to unrelated players.

---

# 31. Crystal skill 4 — random card from left neighbor becomes constrained card

Same as skill 3, but target is:

```text
left neighbor
```

Use persisted seat order.

Do not compute neighbor from a filtered "active players" array.

---

# 32. Crystal skill 5 — bind two players' play decisions

Choose two players who currently have cards.

Create a linked decision constraint.

Product contract:

```text
Player B's ability/requirement to play is tied to Player A's decision.

If A plays:
  B must play.

If A does not play:
  B must not play.
```

The target ordering chosen by skill user must be explicit:

```text
Leader A
Bound B
```

If natural seat order would cause B to decide before A:

```text
defer B's final decision until A is locked
```

or use a dependency-aware decision queue.

Do not let UI chronology create an impossible constraint.

---

# 33. Crystal skill 6 — skill user decides last

Normally the current round leader decides first.

With skill 6:

```text
all other players decide in clockwise order
then the skill user decides last
```

The skill user should not see card identities chosen by others.

They may see only the public amount/progress information that the tabletop equivalent allows.

Do not accidentally reveal play/pass details while they wait.

---

# 34. Crystal skill 7 — give a Ghost card

Choose another player.

Give them:

```text
1 spare Ghost card
```

from a central reserve.

This increases their hand size.

Maintain an explicit central Ghost reserve:

```ts
ghostReserveCount
```

Do not fabricate an unlimited Ghost token source.

If the physical component pool/reserve is exhausted:

```text
effect resolves with no card
```

unless verified official rules say otherwise.

---

# 35. Crystal skill 8 — left/right neighbors must play

Both immediate neighbors of the skill user:

```text
left neighbor
right neighbor
```

must play if they have at least one card.

Apply:

```ts
mustPlay = true
```

to each eligible neighbor.

If one neighbor has zero cards:

```text
that side has no effect
```

In very small seating configurations, ensure left/right targets are not accidentally duplicated; with 5–10 players they should be distinct.

---

# 36. Crystal skill 9 — Dark Blade privately sees White Rose and Bishop

This is a highly sensitive hidden-information effect.

Digital implementation:

```text
1. resolve skill activation publicly only as "skill 9 resolving"
2. identify Dark Blade player server-side
3. privately reveal:
      White Rose player
      Bishop player
   to Dark Blade only
4. no other player receives this data
5. continue round
```

If the Dark Blade card was already played:

```text
identity remains DARK_BLADE
```

so the player still receives the legal information.

Do not derive this from current hand.

Do not post:

```text
"Dark Blade looked at Tony and Kevin"
```

into public logs.

The Dark Blade may verbally lie/tell truth afterward according to table discussion rules.

---

# 37. Crystal skill 10 — optional post-selection replacement

This is the only crystal skill that is optional.

Timing:

```text
AFTER all normal play/pass/card selections are locked
BUT BEFORE collection/shuffle/reveal
```

Skill user chooses:

```text
use skill
OR
decline
```

If used:

```text
select one other player who submitted a card
```

That target may/must replace the submitted card with another valid card still in their hand according to the verified printed effect.

Recommended digital contract:

```text
skill user forces the replacement opportunity;
target chooses which alternative card to substitute;
the original chosen card returns to target's hand;
the replacement becomes the submitted contribution.
```

If target has no alternative card:

```text
target is not a legal target
```

Do not reveal replacement card identity publicly.

---

# 38. Crystal skill 11 — privately peek at one random card

Choose a player who has at least one card.

Trusted/server logic randomly selects one card from that player's hand.

Only the crystal user sees the selected card.

Then:

```text
return card to target hand unchanged
remove temporary peek after user acknowledges
```

The skill user may discuss what they saw and may lie.

Do not preserve the peek in public history.

Reconnect rule:

```text
if disconnected while peek modal is still unresolved:
  restore it
after acknowledged:
  do not restore historical peek
```

---

# 39. Crystal skill 12 — force one player to play

Public magic-book images show another forced-play ability at slot 12.

Implement it as a separate skill ID even if its current effect matches skill 1.

```text
choose one eligible player
target must play this round
```

Do not alias the IDs into one visible crystal because:

```text
number identity
distribution
future official correction
tests
```

must remain independent.

If the official manual later shows a distinction:

```text
change only `crystalSkillDefinitions.ts`
and corresponding tests.
```

---

# 40. Skill combination / constraint engine

Although only one crystal activates per round, a skill may create several constraints.

Use a generic model:

```ts
interface RoundPlayConstraint {
  mustPlay?: boolean;
  mustPass?: boolean;

  lockedCardId?: string;

  linkedToUid?: string;
  linkedBehavior?: 'FOLLOW_PLAY_DECISION';

  decisionOrderOverride?: number;
}
```

Validate conflicts centrally.

Do not scatter logic:

```text
if skill === 8
...
if skill === 5
...
```

across every React component.

---

# 41. Play decision model

```ts
interface PrivatePlayDecision {
  uid: string;

  decision:
    | { type: 'PASS' }
    | { type: 'PLAY'; cardInstanceId: string };

  locked: boolean;
}
```

Do not publish card IDs before reveal.

For normal rounds public state may expose only:

```text
decision complete / waiting
```

---

# 42. Anonymous contribution / shuffle security

The server/trusted layer must perform the shuffle.

Do not use ordinary client:

```ts
Math.random()
```

for authoritative anonymous reveal ordering.

Clients must not be able to inspect:

```text
sourceUid → card type
```

from Realtime Database before/after a normal shuffled reveal.

Even after reveal, source mapping should remain server-private unless skill 2 applies.

---

# 43. Firebase public state

Conceptual:

```text
rooms/{roomCode}/game/public/
  gameId
  phase
  playerOrder
  currentCoinHolderUid
  currentRound
  usedCrystalCount

  players/
    {uid}/
      nickname
      handCount
      crystalUsed
      connected
      decisionReady

  ritual/
    safeWhiteRose
    safeBudCount
    killedWhiteRose
    killedBudCount
    revealedBladeCount

  currentCrystal/
    revealedSkillId   // only after activation
    skillUserUid

  publicSkillState/
  revealCards/
  result/
```

Do not include identities/hands.

---

# 44. Firebase private player state

```text
privateGameData/{roomCode}/{uid}/
  identity
  faction
  hand
  crystalSkillId
  privateKnowledge/
    initialNightRecognition
    skill9Knowledge
    skill11CurrentPeek
  currentPrivateDecision
  currentSkillPrivateState
```

Security:

```text
only matching auth.uid reads this path
trusted backend may write
```

---

# 45. Server-only state

```text
serverGameData/{roomCode}/bladesAndRose/
  identityAssignments
  crystalAssignments
  centralReserve
  contributionSourceMap
  preRevealShuffle
  randomSkillSelections
  roundConstraints
  terminalCalculation
  stateVersion
```

Clients do not directly read this.

---

# 46. Trusted operations

Recommended authoritative operations:

```text
startBladesRoseGame
acknowledgeNightKnowledge
exchangeDoubleBladeGhost

selectNextCrystalUser
revealCrystal
submitCrystalTarget
resolveCrystalSkill

submitPlayDecision
submitSkill10Decision
submitSkill10Replacement

resolveRoundReveal
resolveRoundResult
startNextRound
```

Every operation validates:

```text
authenticated uid
room membership
game id
phase
seat/order
ownership
card existence
crystal ownership
crystal-used state
skill eligibility
target legality
round constraints
stateVersion
```

---

# 47. Concurrency requirements

Guard against:

```text
double-clicking PLAY
two tabs submitting different cards
coin holder selecting two next players
skill user submitting two targets
skill 10 resolving after reveal already started
reconnect replaying an old request
```

Use:

```ts
stateVersion: number;
roundId: string;
actionId: string;
```

Trusted mutation:

```text
validate expected stateVersion
validate phase
apply once
increment version
```

---

# 48. Reconnect behavior

Reconnect must restore legally persistent private state:

```text
identity
current hand
own crystal
own legal knowledge
pending decision
```

Temporary knowledge behavior:

## Skill 11

If currently viewing unresolved peek:

```text
restore current peek
```

After acknowledgement:

```text
do not recreate historical peek UI
```

## Skill 9

This is persistent legally acquired identity knowledge.

Allow a private "已知情報" panel if desired:

```text
White Rose = ...
Bishop = ...
```

visible only to Dark Blade.

## Night recognition

May be persisted as personal knowledge in the same private notebook.

Do not expose to public.

---

# 49. Public logs — no secret leakage

Allowed examples:

```text
Tony 將金幣交給 Kevin
Kevin 發動白水晶
4 位玩家已完成本輪決定
本輪共揭開 3 張牌
本輪沒有血刃，2 朵花成功獻祭
本輪出現血刃，2 朵花遭到擊殺
```

Do NOT log:

```text
Tony chose White Rose
Kevin passed
Amy played Dark Blade
Jack's crystal is 9 before activation
Dark Blade learned Tony is White Rose
Skill 11 saw Bishop in Kevin's hand
```

Skill 2 is the intentional exception for source-attributed reveal.

---

# 50. Physical ritual-board UI

The center of the screen should look like a ritual table, not an admin dashboard.

Desktop concept:

```text
┌──────────────────────────────────────────────────────┐
│ 血與刃的白薔薇      Round 4 / 8         Coin: Amy    │
├──────────────────────────────────────────────────────┤
│                                                      │
│      WHITE / SACRIFICE             BLOOD / DEATH     │
│                                                      │
│      🌹 White Rose safe             ✦ killed buds     │
│      ○ ○ ○ ○  4 / 5               ✕ ✕ ✕  3 / 6      │
│                                                      │
│                  [ ritual altar ]                    │
│                 [ revealed cards ]                   │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Players around table                                 │
│ Tony   Kevin   Amy   Jack   Mary ...                 │
├──────────────────────────────────────────────────────┤
│                    YOUR HAND                         │
│        [CARD]    [CARD]    [CARD]                    │
│                                                      │
│           ◇ Your White Crystal: hidden               │
└──────────────────────────────────────────────────────┘
```

Use the player-count rules to render thresholds.

Do not hardcode `5 / 6` outside the 8-player rule row.

---

# 51. Physical role-card visual system

Suggested card palettes:

```text
White Rose:
ivory / silver / pale rose

Bishop:
aged ivory / muted gold

Follower:
stone / parchment / pale green-gray

Ghost:
charcoal / mist / transparent gray

Double Blade:
black / crimson

Great Blade:
black / dark iron / deep red

Dark Blade:
near-black / violet-red
```

Card should include original faction glyphs:

```text
white rose glyph
bud glyph
blade glyph
ghost glyph
```

Avoid relying only on color.

---

# 52. Original illustration direction

Use project-owned original visuals.

Recommended motifs:

```text
White Rose:
veiled witch / rose halo / pale thorn crown

Bishop:
hooded cleric / ritual staff / cathedral motif

Follower:
anonymous pilgrim / candle

Ghost:
empty veil / smoke / spectral mask

Double Blade:
crossed short blades

Great Blade:
large execution sword / knight silhouette

Dark Blade:
hidden dagger / shadow figure
```

These are concept prompts, not instructions to trace official cards.

---

# 53. Hand UI

Every player normally starts with 3 cards.

Desktop:

```text
        [CARD] [CARD] [CARD]
```

Use subtle physical fan:

```text
-4°
0°
+4°
```

Selected card:

```text
translateY(-18px)
scale(1.04)
stronger rim light
```

Face-down submitted card should visibly leave hand and move toward ritual center, but card identity remains hidden.

---

# 54. Mobile UI

Mobile must remain playable with 10 players.

Recommended:

```text
Top bar:
Round / Coin / thresholds

Center:
ritual result board

Horizontal compact player strip

Bottom:
my 3-card hand
my crystal
primary decision status
```

Cards:

```text
horizontal/fanned
tap to enlarge
tap again/select
```

Action flow:

```text
tap card
↓
full-size physical preview
↓
[蓋牌打出]
```

or:

```text
[本輪跳過]
```

For forced skills:

```text
PASS button disabled
clear reason:
「白水晶效果：本輪你必須出牌」
```

---

# 55. White crystal UI

Crystal should look like a physical token.

Before use:

```text
faceted white/opal crystal
face-down / number hidden from others
```

Owner view:

```text
◇ 9
```

plus private concise effect.

When activated:

```text
3D-ish flip
crystal glow
number reveal
skill title/effect
then token flies to used-crystal track
```

Do not use image scans.

Important UX:

Distinguish:

```text
6
9
```

with:

```text
underlines
orientation marker
or clear glyph
```

to avoid the physical edition's common readability problem.

---

# 56. Coin UI

Use an original ritual coin.

Coin animation:

```text
current holder
↓
target selected
↓
coin slides/floats to new player
```

Coin ownership is public.

Do not let animation duration block server state.

---

# 57. Reveal sequence

This should be the dramatic centerpiece.

Normal round:

```text
face-down cards fly into center
↓
shuffle animation
↓
one-by-one reveal
↓
Ghost fades
↓
Flowers move left if safe
OR
blade slash + flowers move right if killed
```

If White Rose + blade:

```text
white rose reveal
↓
blade reveal
↓
short red slash / petal effect
↓
immediate Blood victory
```

Do not make every normal round a 5+ second cutscene.

Recommended:

```text
normal reveal: 1.0–2.0 sec
major White Rose death: 2.0–3.0 sec
```

Support:

```text
FAST animation mode
prefers-reduced-motion
```

---

# 58. Skill 2 reveal UI

Because skill 2 disables the shuffle anonymity:

```text
show player source next to each reveal
```

Example:

```text
Tony → Ghost
Kevin → Follower
Amy → Double Blade
```

This UI is intentionally different from normal anonymous reveal.

---

# 59. Discussion timer

Do not enforce a mandatory timer by default.

Optional host setting:

```ts
discussionTimerSeconds?: 0 | 30 | 60 | 90 | 120;
```

Default:

```text
0 = unlimited
```

This is friend-focused social deduction.

Do not auto-advance while people are talking unless host enabled timer behavior.

---

# 60. Rule/help panel

Provide a concise in-game help panel.

Sections:

```text
陣營目標
角色介紹
三張起手牌
夜晚相認
白水晶
金幣與回合
出牌 / 跳過
匿名洗牌揭示
獻祭 / 擊殺
12 種技能
勝利條件
```

Do not paste long copyrighted rulebook prose.

Write original concise explanations.

---

# 61. AI support

AI is NOT required for the initial multiplayer release.

If AI practice is added later:

```text
AI must receive only legally visible information
```

Do not give AI:

```text
all identities
all hands
all crystal skills
source mapping of anonymous cards
future shuffle result
```

Use the same anti-cheat design already applied in other platform games.

---

# 62. Engine tests — setup

At minimum:

- game rejects <5 players;
- game rejects >10 players;
- selected identity counts sum to player count;
- every player receives one Follower + one Ghost + one identity;
- Follower identity produces two Follower cards + Ghost;
- Double Blade night exchange results in two Double Blade + one Follower;
- Double Blade has no Ghost afterward;
- every player gets one unique crystal from the 12;
- crystals are private;
- identity/faction persists after identity card is played;
- unverified production rule row is rejected in strict mode.

---

# 63. Engine tests — night knowledge

- White Rose gets legal night group knowledge;
- Bishop gets legal night group knowledge;
- Double Blade gets legal night group knowledge;
- Great Blade gets legal night group knowledge;
- Follower does not;
- Dark Blade does not initially;
- no public path exposes night knowledge;
- Double Blade exchange does not reveal owner publicly.

---

# 64. Engine tests — base play

- round leader starts decision order;
- order proceeds clockwise;
- player may pass unless constrained;
- player may play exactly one card;
- cannot play card not owned;
- locked decision cannot be resubmitted;
- normal reveal loses source attribution;
- skill 2 reveal preserves source attribution;
- Ghost causes no sacrifice/kill score;
- no blade → flowers safe;
- blade → flowers killed;
- White Rose + blade → immediate Blood victory;
- identity remains unchanged after card play.

---

# 65. Engine tests — 8-player verified victory

Test:

```text
safe White Rose + 5 safe buds → White win
safe White Rose + 4 safe buds → no threshold win
6 killed buds → Blood win
5 killed buds → not enough
killed White Rose → immediate Blood win
```

Test final-crystal resolution separately.

---

# 66. Skill tests

At minimum one dedicated describe block per skill.

## Skill 1

- valid target required;
- target with cards forced to play;
- PASS unavailable.

## Skill 2

- contributions not shuffled;
- source mapping public only for this round.

## Skills 3/4

- left/right relationship uses fixed seat order;
- trusted random selection;
- only selected/locked card may be submitted according to effect;
- no hidden card leak.

## Skill 5

- two players selected;
- B follows A play/pass state;
- decision dependency works even if seat order puts B first.

## Skill 6

- skill user decides last;
- no secret selections leaked while waiting.

## Skill 7

- one Ghost added to selected player;
- central reserve decremented;
- zero reserve handled safely.

## Skill 8

- both neighbors forced if they have cards;
- empty hand handled.

## Skill 9

- Dark Blade privately sees White Rose + Bishop;
- no other UID can read;
- public log leaks nothing.

## Skill 10

- optional;
- only after all choices locked;
- valid replacement target;
- no replacement if no alternative;
- replacement remains secret before reveal.

## Skill 11

- trusted random peek;
- only skill user reads;
- card returns unchanged;
- temporary peek removed after acknowledgement.

## Skill 12

- remains distinct skill ID;
- forced-play behavior tested.

---

# 67. Firebase Security tests

Use Emulator Rules tests where feasible.

Prove:

```text
Player A cannot read Player B identity.
Player A cannot read Player B hand.
Player A cannot read Player B crystal.
Player A cannot read night knowledge.
Non-Dark-Blade cannot read skill 9 knowledge.
Non-skill-user cannot read skill 11 peek.
Clients cannot read contribution source mapping.
Clients cannot read random-selection internals.
Clients cannot overwrite ritual score.
Clients cannot forge winner.
Clients cannot act for another UID.
```

---

# 68. Browser/E2E acceptance matrix

At minimum:

```text
5-player match with verified rule row
8-player canonical match
10-player match with verified rule row

White-side threshold win
White Rose killed
Blood bud-kill threshold win
final-crystal ending

skill 2 source reveal
skill 5 linked decisions
skill 6 decide-last
skill 9 private Dark Blade reveal
skill 10 replacement
skill 11 private peek
```

If 5/10 rules are not yet officially verified:

```text
run those in development fixtures
but do not enable production matchmaking for them
```

until verification is complete.

---

# 69. Responsive acceptance

Test:

```text
360px
390px
430px
768px
desktop
```

Verify:

- 3 physical cards remain usable;
- 10-player player strip does not break;
- crystal popup fits;
- skill-target dialog fits;
- ritual tracks remain readable;
- reveal animation stays on-screen;
- mobile card preview rule text readable;
- hidden information is not accidentally exposed in responsive alternative components.

---

# 70. Error messages

Traditional Chinese examples:

```text
目前不是你的回合
你已經完成本輪決定
這張牌不在你的手中
本輪白水晶效果要求你必須出牌
本輪只能打出被指定的牌
這位玩家的白水晶已經使用過
請選擇尚未使用白水晶的玩家
目前無法指定這位玩家
你的操作已過期，遊戲狀態已更新
```

On stale state:

```text
resync
keep user in match
show concise toast
```

---

# 71. Production logging

Never log secret values:

```text
identity
full hand
crystal number before reveal
skill 9 target identities
skill 11 peek
anonymous contribution source map
```

Allowed diagnostics:

```text
room id/hash
game id
round
phase
action type
actor uid/hash
stateVersion
success/failure
error code
latency
```

---

# 72. Implementation milestones

## BR1 — Game registration + physical design system

Implement:

- catalog registration;
- 5–10 player validation;
- module/router;
- physical role-card system;
- card back;
- ritual board skeleton;
- physical crystal token;
- physical coin;
- responsive 3-card hand.

Acceptance:

```text
Game launches from lobby
and visually already feels like a physical dark-fantasy card game.
```

Do not postpone the physical-card system to final polish.

---

## BR2 — Rule-data layer + setup

Implement:

- `PLAYER_COUNT_RULES`;
- strict verification flag;
- identity assignment;
- 3-card hands;
- crystal assignment;
- private player state;
- 8-player verified fixture.

Acceptance:

all setup tests pass.

---

## BR3 — Night phase

Implement:

- private recognition;
- Double Blade exchange;
- private knowledge persistence;
- no public leakage.

---

## BR4 — Base round engine

Implement:

- coin flow;
- select unused crystal owner;
- reveal crystal;
- ordered play/pass;
- anonymous contribution;
- shuffle/reveal;
- sacrifice/death tracks;
- Ghost handling;
- White Rose immediate kill.

Acceptance:

8 players can complete multiple rounds without special crystal effects.

---

## BR5 — Crystal skills 1–6

Implement typed skill engine and first half of skills.

Do not special-case logic only in UI.

---

## BR6 — Crystal skills 7–12

Implement remaining effects including:

```text
Dark Blade private reveal
post-selection replacement
private random peek
```

Acceptance:

all 12 skill unit tests pass.

---

## BR7 — Victory / final-round engine

Implement:

- verified 8-player thresholds;
- generic rule-table winner engine;
- all-crystals-used final resolution;
- result reveal;
- winner screen.

---

## BR8 — Firebase security / concurrency / reconnect

Implement:

- trusted operations;
- private paths;
- source-map secrecy;
- random authoritative effects;
- stateVersion;
- idempotency;
- multi-tab protection;
- reconnect.

Acceptance:

security/rules tests pass.

---

## BR9 — Complete UI / animation polish

Implement:

- ritual table;
- card fan;
- card play animation;
- shuffle/reveal animation;
- sacrifice/death effects;
- crystal activation;
- coin movement;
- private knowledge screens;
- mobile UX;
- FAST/Normal motion;
- reduced-motion.

---

## BR10 — Player-count official verification

Before production 5–10 support is claimed:

```text
obtain official player-board/manual values
```

for each count:

```text
5
6
7
8
9
10
```

Update only:

```text
playerCountRules.ts
tests
help text if necessary
```

Do NOT rewrite engine logic.

Every production-enabled row:

```ts
verifiedAgainstOfficialBoard: true
```

---

## BR11 — Production deployment

Only after BR1–BR10:

```text
test
browser tests
Firebase Rules tests
lint
build
```

Then deploy:

```text
Rules / Functions or trusted backend / Hosting
```

as one coordinated release.

Run production smoke test with at least two real browser sessions.

---

# 73. Definition of Done — core engine

Core game is complete when:

- 5–10 architecture is data-driven;
- production-enabled player counts use verified setup rows;
- identities are private;
- each player starts with correct 3-card structure;
- Double Blade gets second blade through night exchange;
- crystals are unique/private;
- initial night knowledge works;
- Dark Blade remains initially blind;
- coin/crystal flow works;
- each crystal is used once;
- normal play/pass sequence works;
- normal contribution sources remain anonymous;
- skill 2 source reveal works;
- sacrifice/death tracks work;
- White Rose + Blade ends game immediately;
- all 12 crystal skills work;
- player-count victory thresholds work;
- final-crystal resolution works;
- reconnect works;
- Firebase security prevents secret leakage;
- tests/lint/build pass.

---

# 74. Definition of Done — UI

UI is complete when:

- cards look like original physical tabletop cards;
- role cards use original dark-fantasy artwork/SVG;
- no official scans are embedded;
- 65:100-ish physical proportions are preserved;
- ritual board visually communicates White vs Blood tracks;
- crystals look like tokens, not plain buttons;
- coin looks like a token;
- card play is face-down;
- anonymous shuffle/reveal is visually clear;
- skill 2 visibly differs from normal reveal;
- private knowledge uses dedicated privacy screens;
- mobile 360px is playable;
- desktop feels like a table rather than a CRUD dashboard;
- reduced-motion works.

---

# 75. Non-goals for first release

Do not block MVP on:

```text
AI bots
public matchmaking
ranked ladder
spectator mode
voice chat
custom fan-made crystal skills
alternate balance house rules
tournament system
```

First deliver a correct friend-focused multiplayer implementation.

---

# 76. Priority order

When tradeoffs occur:

```text
hidden-information security
>
rule correctness
>
crystal-skill correctness
>
anonymous shuffle integrity
>
player-count balance correctness
>
realtime consistency
>
physical-card UX
>
animation polish
```

---

# 77. Codex execution instructions

Before editing:

1. Read this file completely.
2. Inspect the current repository.
3. Inspect existing platform room/auth/Firebase abstractions.
4. Inspect how existing games are registered.
5. Reuse existing shared infrastructure.
6. Preserve all current games.
7. Do not create another Firebase project.
8. Do not create another React app.
9. Do not download official card art.
10. Keep player-count balance data isolated from engine code.

Implement:

```text
BR1
→ BR2
→ BR3
→ BR4
→ BR5
→ BR6
→ BR7
→ BR8
→ BR9
```

Then perform:

```text
BR10 official player-count verification
```

before claiming full 5–10 production support.

After every milestone:

```text
run unit tests
run browser/integration tests where relevant
run lint
run build
inspect git diff
```

Fix regressions before proceeding.

If official 5/6/7/9/10 player-board values are not available in the repository:

```text
DO NOT GUESS THEM.
```

Instead:

- keep the engine complete;
- keep those rows unverified;
- clearly report exactly which setup/threshold numbers require owner verification;
- leave 8-player canonical mode fully testable;
- prepare the data table so the owner can supply values without engine changes.

If Firebase Console/deployment requires manual owner action:

- complete all repository work possible;
- do not invent credentials;
- report exact manual step.

Do not stop after scaffolding.

Begin implementation.

---

# 78. Suggested final Codex report

When finished, report:

```text
1. Implemented milestones
2. Added/modified files
3. Unit test count
4. Browser/integration test count
5. Lint result
6. Production build result
7. Firebase Rules/security result
8. Which player-count rows are officially verified
9. Any remaining player-board values needed from owner
10. Production deployment readiness
```

---

# 79. Quick rule summary for implementation review

```text
5–10 players

Each player:
- 1 Follower
- 1 Ghost
- 1 identity card
- 1 private white crystal

Exception:
Double Blade exchanges Ghost for spare Double Blade
→ Double Blade + Double Blade + Follower

Initial recognition:
White Rose
Bishop
Double Blade
Great Blade

Not initially recognizing:
Follower
Dark Blade

Each round:
- coin moves to an unused-crystal player
- crystal reveals / resolves
- players decide play/pass in order
- cards normally shuffle anonymously
- reveal

No blade:
white flower cards safely sacrifice

Any blade:
white flower cards in same reveal die

White Rose + any blade:
Blood wins immediately

Every player crystal used at most once.
Maximum rounds = player count.

White:
protect/safely sacrifice White Rose
+ required buds
or satisfy final-round completion rule

Blood:
kill White Rose
or kill enough buds
or win final unresolved-flower check
```

---

# 80. Physical UI reminder

This is not acceptable as the final presentation:

```text
[White Rose]
[Bishop]
[Follower]
[Play]
```

The intended result is:

```text
a dark ritual table
with actual-looking cards in the player's hand,
a physical crystal beside them,
a coin moving between seats,
face-down cards gathering in the center,
then a tense shuffle and reveal.
```

That presentation is part of the product requirement, not optional polish.
