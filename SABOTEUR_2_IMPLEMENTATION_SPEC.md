# 矮人礦坑 2（Saboteur 2）Web Game — Codex Implementation Spec

> Target repository: `tonyleesos/boardgame-online-platform`
>
> Target platform: the existing React + TypeScript + Vite + Firebase multiplayer boardgame platform.
>
> This file is an implementation instruction for Codex / coding agents working directly in VS Code.
>
> **Directive:** extend the existing platform. Do not create a second React application, do not duplicate Firebase initialization, and do not break Avalon / Time Bomb / 同房異夢 / 璀璨寶石 / 教父風雲 or other existing games.

---

# 0. Scope and interpretation

Implement **《矮人礦坑 2》 / Saboteur 2** as a self-contained digital game module.

The physical `Saboteur 2` product is an expansion and officially requires path/action cards from the original `Saboteur` base game. The digital implementation must therefore include the **base tunnel/action mechanics that Saboteur 2 depends on**, plus all Saboteur 2 roles, path mechanics, action mechanics and scoring.

Supported player count:

```text
2–12 players
```

Recommended social sweet spot for the UI may be displayed as:

```text
5–8 players recommended
```

A full match consists of:

```text
Round 1
→ Round 2
→ Round 3
→ total Gold comparison
→ final winner(s)
```

Core experience:

```text
secret roles
+ route building
+ bluffing
+ sabotage
+ changing identities
+ two competing miner teams
+ individual opportunist roles
+ three-round hidden-score competition
```

---

# 1. Rule-source priority

This specification was prepared from:

1. **AMIGO Saboteur 20th Anniversary official rules**, especially the Saboteur base-game and Saboteur 2 sections;
2. the older official AMIGO / Z-Man Saboteur 2 rulebook;
3. the Traditional Chinese overview supplied by the project owner from Andyventure.

If wording differs between community summaries and official rules, use this priority:

```text
this digital implementation spec
> current official AMIGO rules
> older official rulebook
> community / blog summary
```

The spec deliberately resolves a few rare edge cases so the online engine remains deterministic.

---

# 2. Copyright / asset boundary

Implement the rules and game systems, but do not copy official commercial artwork, card illustrations, card backs, logos, or large sections of rulebook text.

Use original project-owned visuals for:

```text
dwarves
mine tunnels
doors
crystals
tools
action cards
gold tokens
start / goal cards
```

Card data should be machine-readable. Concise functional labels are fine, but do not embed scans of physical cards.

The implementation should make it easy to adjust card artwork/data later without changing the game engine.

---

# 3. Game metadata

```ts
export const saboteur2Game = {
  id: 'saboteur-2',
  name: '矮人礦坑 2',
  minPlayers: 2,
  maxPlayers: 12,
  type: 'hidden-role-route-building',
};
```

Recommended catalog card:

```text
┌──────────────────────────────┐
│          矮人礦坑 2           │
│          SABOTEUR 2          │
│                              │
│  2–12 人 · 陣營 · 路線 · 心機 │
│                              │
│       [ 建立房間 ]            │
└──────────────────────────────┘
```

Reuse existing platform infrastructure:

- Firebase Anonymous Auth;
- nickname;
- create/join room;
- room code;
- host and ready state;
- reconnect / presence;
- game router;
- common toast/loading/error components;
- existing Firebase client initialization;
- shared private-player-state conventions.

---

# 4. Recommended module structure

```text
client/src/games/saboteur-2/
├─ components/
│  ├─ Saboteur2Board.tsx
│  ├─ MineGrid.tsx
│  ├─ PathCardView.tsx
│  ├─ GoalCardView.tsx
│  ├─ HandDrawer.tsx
│  ├─ PlayerStatusPanel.tsx
│  ├─ RoleCardPrivate.tsx
│  ├─ ActionTargetDialog.tsx
│  ├─ GoalPeekDialog.tsx
│  ├─ RolePeekDialog.tsx
│  ├─ PassDialog.tsx
│  ├─ RoundResultDialog.tsx
│  ├─ TheftResolutionDialog.tsx
│  └─ FinalResultDialog.tsx
│
├─ engine/
│  ├─ setup.ts
│  ├─ grid.ts
│  ├─ topology.ts
│  ├─ placement.ts
│  ├─ reachability.ts
│  ├─ goals.ts
│  ├─ actions.ts
│  ├─ roles.ts
│  ├─ scoring.ts
│  ├─ theft.ts
│  ├─ turn.ts
│  ├─ round.ts
│  ├─ validation.ts
│  └─ selectors.ts
│
├─ data/
│  ├─ basePathCards.ts
│  ├─ expansionPathCards.ts
│  ├─ baseActionCards.ts
│  ├─ expansionActionCards.ts
│  └─ roles.ts
│
├─ types.ts
├─ constants.ts
├─ rules.ts
└─ index.ts
```

Keep topology, scoring and action validation independent from React/Firebase wherever possible.

---

# 5. Roles

Saboteur 2 uses **15 role cards**:

```text
4 × Blue Gold Digger
4 × Green Gold Digger
3 × Saboteur
1 × Boss
1 × Profiteer
2 × Geologist
```

Type:

```ts
export type Saboteur2Role =
  | 'BLUE_DIGGER'
  | 'GREEN_DIGGER'
  | 'SABOTEUR'
  | 'BOSS'
  | 'PROFITEER'
  | 'GEOLOGIST';
```

Traditional Chinese labels:

```text
BLUE_DIGGER  → 藍隊挖金矮人
GREEN_DIGGER → 綠隊挖金矮人
SABOTEUR     → 破壞者 / 壞矮人
BOSS         → 工頭
PROFITEER    → 奸商
GEOLOGIST    → 地質學家
```

Choose one translation and use it consistently throughout the app.

---

# 6. Role privacy

At the beginning of **every round**:

```text
shuffle all 15 role cards
→ deal exactly 1 face-down role to each player
→ remaining roles form a secret unused-role deck
```

Unused roles must remain hidden because `Change Hats` may draw from that deck later.

A player's role is private until:

```text
round scoring / round reveal
```

or another player legitimately uses `Inspection` to view it privately.

Do not store all roles under publicly readable room state.

Conceptual Firebase layout:

```text
rooms/{roomCode}/game/public/...

privateGameData/{roomCode}/{uid}/
  role
  hand
  privateGoalKnowledge
  inspectedRoles
  goldTotal

serverGameData/{roomCode}/saboteur2/
  drawDeck
  removedTenCards
  goalIdentities
  unusedRoleDeck
  hiddenDiscardedRoleInfo
```

---

# 7. Match / round state

```ts
export interface Saboteur2GameState {
  matchRound: 1 | 2 | 3;
  phase: Saboteur2Phase;

  playerOrder: string[];
  currentPlayerIndex: number;

  board: MineBoardState;

  drawCount: number;
  discardCount: number;

  publicPlayers: Record<string, Saboteur2PublicPlayerState>;

  lastPathPlayerUid?: string;
  treasureConnectorUid?: string;

  roundEndReason?: 'TREASURE_REACHED' | 'NO_CARDS_LEFT';
  roundResult?: Saboteur2RoundPublicResult;

  gameOver: boolean;
}
```

Suggested phases:

```ts
export type Saboteur2Phase =
  | 'ROUND_SETUP'
  | 'PLAYER_ACTION'
  | 'ACTION_TARGET_SELECTION'
  | 'PRIVATE_INFORMATION_RESULT'
  | 'ROUND_SCORING'
  | 'THEFT_RESOLUTION'
  | 'ROUND_RESULT'
  | 'GAME_OVER';
```

---

# 8. Three-round match

A complete match always runs for:

```text
3 rounds
```

At the beginning of each new round:

- reset the mine board;
- reshuffle all base + expansion path/action cards, including the 10 cards removed in the previous round;
- secretly remove a new top 10 cards;
- deal 6 cards to every player;
- reshuffle all 15 role cards;
- deal a fresh role to each player;
- clear round-only action effects;
- retain each player's accumulated Gold total.

Starting player:

```text
Round 1:
platform may choose random first player
(or youngest-player rule may be replaced digitally by random)

Round 2/3:
player to the left of the player who played the final card of previous round
```

For online play, use deterministic random selection instead of asking player ages.

---

# 9. Round setup — board

Use the classic mine layout:

```text
                       Goal A
                         ?

Start  ── 7 card widths ── Goal B
                         ?

                       Goal C
                         ?
```

More precisely:

- Start card is face-up.
- Three goal cards are face-down.
- Exactly one goal contains gold.
- Two contain rock.
- Middle goal is seven card widths from Start.
- Upper/lower goals are one card-height apart from the middle goal.

Use integer grid coordinates instead of pixel-derived logic.

Recommended coordinates:

```ts
START = { x: 0, y: 0 };
GOALS = [
  { x: 8, y: -2 },
  { x: 8, y: 0 },
  { x: 8, y: 2 },
];
```

The exact coordinate convention may differ, but spacing must preserve the physical rules.

Players may build beyond the nominal setup rectangle.

---

# 10. Playing-card deck

For Saboteur 2 mode:

```text
all base-game ordinary Path cards
+ all base-game Action cards
+ all Saboteur 2 Path cards
+ all Saboteur 2 Action cards
```

Do **not** use the base game's role cards or base gold-card reward deck.

Saboteur 2 scoring uses Gold Piece values instead.

Before every round:

```text
shuffle full playing-card deck
→ remove top 10 secretly
→ deal 6 cards to every player
→ remaining cards = draw deck
```

Every player receives **6 cards regardless of player count**.

The 10 removed cards are hidden from everyone until they are returned to the full deck during next-round setup.

---

# 11. Card-data architecture

Do not encode tunnel logic as image filenames.

Every path card needs machine-readable topology.

```ts
export type Edge = 'N' | 'E' | 'S' | 'W';

export interface PathChannel {
  ports: Edge[];
}

export interface PathCardDefinition {
  id: string;
  source: 'BASE' | 'SABOTEUR_2';

  channels: PathChannel[];

  crystalCount?: number;
  ladder?: boolean;
  door?: 'BLUE' | 'GREEN';

  special?: 'BRIDGE' | 'DOUBLE_BEND';
}
```

Examples:

```ts
// ordinary connected corner
channels: [{ ports: ['N', 'E'] }]

// ordinary four-way connected intersection
channels: [{ ports: ['N', 'E', 'S', 'W'] }]

// bridge: crossing tunnels that do NOT connect internally
channels: [
  { ports: ['N', 'S'] },
  { ports: ['E', 'W'] },
]
```

This internal-connectivity model is required. A simple `openEdges[]` representation is insufficient because Bridge and Double Bend contain multiple disconnected internal paths.

Dead-end cards can be represented by one-port channels.

---

# 12. Rotation

Path cards are always portrait-oriented.

Allow:

```text
0°
180°
```

Do not allow:

```text
90°
270°
```

Rotation must transform edge/channel topology before validation.

---

# 13. General path placement validation

For an ordinary path card placement:

1. target coordinate must be empty;
2. it must be orthogonally adjacent to at least one existing board card;
3. every touching edge must match exactly:
   - tunnel ↔ tunnel;
   - wall ↔ wall;
4. orientation must be portrait (`0°` or `180°`);
5. the newly placed card must participate in an uninterrupted path back to Start, except where the Ladder special rule creates the virtual Start connection;
6. current player must be permitted to play path cards.

Required API:

```ts
validatePathPlacement(
  board,
  card,
  coordinate,
  rotation,
  playerState
): PathPlacementValidation
```

React must never decide legality independently.

---

# 14. Reachability graph

Build a graph at the **tunnel-port level**, not merely card-to-card level.

A node should conceptually represent:

```text
(card coordinate, tunnel channel / port)
```

The graph must understand:

- internal tunnel connections;
- adjacent-card edge connections;
- Start connectivity;
- Ladder virtual connectivity;
- independent Bridge paths;
- independent Double Bend paths;
- door restrictions when evaluating colored-team access.

Recommended helpers:

```ts
buildTunnelGraph(board): TunnelGraph

isConnectedToStart(board, coordinate, channel?): boolean

canTeamReachGold(
  board,
  team: 'BLUE' | 'GREEN'
): boolean
```

The same graph engine should power:

- legal placement;
- goal reveal;
- end-of-round team resolution.

---

# 15. Start and goal cards

When a newly placed path makes a face-down goal reachable from Start:

```text
reveal that goal
```

If it is:

```text
ROCK
→ round continues
```

If it is:

```text
GOLD
→ round ends immediately
```

A revealed rock goal remains on the board.

When orienting a revealed goal, try to match surrounding paths. As in the physical rules, a goal card is the special exception where not every adjacent side must match if no perfect orientation exists.

Because a Ladder can connect a previously disconnected network to Start, after **every successful path placement**, recompute whether any goal has newly become reachable. Do not only inspect the path card physically adjacent to a goal.

Record:

```ts
treasureConnectorUid = currentPlayerUid;
```

when the gold goal is revealed. The connecting player's **current role at that exact moment** matters for colored-team victory resolution.

---

# 16. Base action cards required by Saboteur 2

The digital Saboteur 2 deck also includes the base-game action mechanics:

```text
Broken Pickaxe
Broken Lantern
Broken Mine Cart
Repair cards
Rockfall
Treasure Map
```

Use typed actions rather than image recognition.

```ts
export type BaseActionType =
  | 'BREAK_PICKAXE'
  | 'BREAK_LANTERN'
  | 'BREAK_CART'
  | 'REPAIR'
  | 'ROCKFALL'
  | 'MAP';
```

---

# 17. Broken tools

There are three sabotage tool types:

```ts
type ToolType = 'PICKAXE' | 'LANTERN' | 'CART';
```

A player may have multiple different broken tools, but never duplicate copies of the same broken-tool effect.

If **any** broken tool is in front of a player at the start of their turn:

```text
they cannot play a Path card
```

They may still:

- play Action cards;
- use the Saboteur 2 discard-two self-cleanup action;
- pass/discard.

---

# 18. Repair

A Repair card may remove a matching broken tool from:

```text
self
or
another player
```

A dual-symbol Repair can repair **one** matching tool only.

A Repair card cannot be played preemptively when the target does not have a matching break effect.

After repair:

```text
repair card → discard
broken-tool card → discard
```

---

# 19. Rockfall

Rockfall removes one existing ordinary Path card.

It may not remove:

```text
Start
Goal cards
```

Removed path card and Rockfall card go to the discard pile.

After Rockfall:

- disconnected tunnel sections may remain physically on board;
- those disconnected cards simply cease to be Start-reachable;
- future legal placement still needs to satisfy placement/reachability rules;
- visible crystals on a removed card no longer count for Geologists.

Rockfall cannot undo a round that has already ended from revealing the gold.

---

# 20. Treasure Map

Map allows its actor to privately inspect one still face-down goal.

Only the acting player receives:

```text
GOLD
or
ROCK
```

Do not publish the result.

After the private view is acknowledged:

```text
Map → discard
```

Store private knowledge only for reconnect convenience if desired:

```ts
privateGoalKnowledge: Record<goalId, 'GOLD' | 'ROCK'>
```

This knowledge is personal and must not become public.

---

# 21. Saboteur 2 special path cards

Support these mechanics.

## Bridge — 2 cards

Contains two straight paths crossing each other, but the two paths are **not internally connected**.

At least one of its two internal paths must connect to Start when played.

Players cannot turn from one channel into the other.

## Double Bend — 2 cards

Contains two independent curved paths.

They are not internally connected.

At least one channel must connect to Start when played.

## Path with Ladder — 4 cards

A Ladder is treated as a virtual direct connection to:

```text
Start
and every other Ladder card
```

Placement rules:

- it must touch an existing Path card;
- it may not be placed adjacent to a Goal card;
- it does not otherwise need an ordinary continuous path back to Start, because the Ladder itself supplies that connection.

## Colored Door — 3 Blue + 3 Green

A Door does not stop Path cards from being placed beyond it.

It matters during role/team reachability resolution:

```text
Blue Door  → blocks Green Diggers
Green Door → blocks Blue Diggers
```

Boss, Profiteer and Geologists can conceptually pass either door for role-resolution purposes.

## Crystal path cards

Some expansion Path cards show one or more crystals.

Crystals:

- do not affect placement;
- do not alter connectivity;
- count for Geologist scoring while the card remains visibly on the board;
- count even if that crystal card is currently disconnected from Start.

Required helper:

```ts
countVisibleCrystals(board): number
```

---

# 22. Saboteur 2 action cards

Support:

```text
Theft ×4
Hands Off ×3
Swap Hands ×2
Inspection ×2
Change Hats ×2
Trapped ×3
Freedom ×4
```

Use typed data:

```ts
export type ExpansionActionType =
  | 'THEFT'
  | 'HANDS_OFF'
  | 'SWAP_HANDS'
  | 'INSPECTION'
  | 'CHANGE_HATS'
  | 'TRAPPED'
  | 'FREEDOM';
```

No player may have two simultaneous copies of the same persistent action effect in front of them.

---

# 23. Theft

The player plays Theft face-up in front of **themselves**.

It remains until end-of-round resolution unless removed by Hands Off or self-cleanup.

After normal Gold distribution:

```text
each eligible Theft owner steals exactly 1 Gold from one other player who has Gold
```

A player who is still Trapped at round end:

```text
cannot use Theft
```

If several Theft cards remain:

1. the player who **most recently played Theft** resolves first;
2. then other eligible Theft owners resolve in clockwise seat order.

Track:

```ts
playedAtTurnSequence: number
```

for deterministic ordering.

Gold totals should remain secret from opponents, but it is acceptable for the public UI to indicate whether a player currently has any Gold available to steal, mirroring observable physical tokens.

---

# 24. Hands Off

Play Hands Off to remove one Theft card currently on the table.

Target can be any player's Theft.

After resolution:

```text
Hands Off → discard
Theft → discard
```

---

# 25. Swap Hands

Actor chooses exactly one other player.

Then:

```text
swap the players' entire private hands
```

Hand sizes may differ.

After the swap:

```text
the TARGET player draws 1 card
```

The acting player does not perform the normal one-card draw for this action; the special effect redirects the draw to the target as defined by the official rule.

Do not reveal either hand publicly during exchange.

Use one atomic trusted operation so no client can observe an intermediate duplicated/lost hand.

---

# 26. Inspection

Actor selects another player and privately sees that player's **current role**.

Only the actor receives the result.

Then:

```text
Inspection → discard
```

If the inspected player's role later changes due to Change Hats, previously learned information becomes stale naturally. Do not silently update old Inspection knowledge.

---

# 27. Change Hats

Actor selects:

```text
self
or
any one player
```

Target's current role is removed privately and placed at the **bottom of the unused-role deck**.

Then target privately draws the **top** role from that unused-role deck.

Do not reveal either old or new role publicly.

Important:

```text
role changes take effect immediately
```

Therefore:

- winning role may change mid-round;
- team color may change;
- Inspection information may become outdated;
- the role used for treasure-connector resolution is the role held at the moment gold is reached.

Perform the swap atomically server-side.

---

# 28. Trapped

Play Trapped face-up in front of another player.

While Trapped:

```text
player cannot play Path cards
```

They may still play actions, clean up effects, and pass.

If still Trapped when the round ends:

```text
player is NOT counted in the winning group
player receives no normal role Gold
Geologist receives no crystal Gold
player cannot execute Theft
```

This applies regardless of role.

---

# 29. Freedom

Freedom removes one Trapped card from any player.

After resolution:

```text
Freedom → discard
Trapped → discard
```

---

# 30. Turn choices

On each turn the active player must choose exactly one of four actions:

```text
A. Play 1 Path card
   → draw 1

B. Play 1 Action card
   → normally draw 1
   → special card rules may override recipient of draw

C. Discard exactly 2 hand cards face-down
   → remove 1 Action card in front of yourself
   → draw 1

D. Pass
   → discard 1–3 hand cards face-down
   → draw the same number
```

When draw deck runs out:

```text
do not draw
```

If a player has zero hand cards:

```text
their remaining turns in that round are skipped automatically
```

Round ends when all players have no cards left to play, unless gold was reached earlier.

---

# 31. Discard-two self-cleanup

A player may discard exactly two cards from their hand face-down to remove **one persistent Action card in front of themselves**.

Examples:

```text
Broken Tool
Trapped
Theft
```

Afterward:

```text
draw 1 card if deck is non-empty
```

This intentionally reduces their hand size by one net card.

Validate that a removable effect exists before allowing the action.

---

# 32. Passing

Player may discard:

```text
1, 2 or 3 cards
```

face-down.

Then draw the same number, limited by cards remaining in draw deck.

The identities of passed/discarded cards must remain hidden publicly.

Do not put private discard identities in the public game log.

---

# 33. Round end

Round ends immediately when:

```text
Start becomes connected to the GOLD goal
```

or when:

```text
all players have no playable hand cards remaining
```

At round end:

```text
1. reveal all current roles
2. determine role winners / Gold allocations
3. award Geologist crystal Gold
4. resolve Theft cards
5. show round summary
6. preserve cumulative Gold
7. set up next round or final result
```

---

# 34. Colored-team victory algorithm

This is one of the most important engine rules.

At the moment the GOLD goal is reached:

```ts
connectorUid
connectorRole
blueCanReachGold
 greenCanReachGold
```

must be captured/recomputed.

`blueCanReachGold` means there exists at least one Start→Gold tunnel route that Blue can traverse without crossing a Green Door.

`greenCanReachGold` means there exists at least one Start→Gold route Green can traverse without crossing a Blue Door.

Do not choose a single "shortest path". If any valid route exists for a team, that team is considered able to reach the treasure for door-access purposes.

Then apply connector-role rules.

## Connector is BLUE_DIGGER

```text
if blueCanReachGold:
    Blue team wins
    Green does not win merely because it can also physically reach
else if greenCanReachGold:
    Green team wins (special case: connector's own team is blocked)
```

## Connector is GREEN_DIGGER

Mirror the above.

## Connector is BOSS / PROFITEER / GEOLOGIST / SABOTEUR

Each colored team that can reach the Gold qualifies.

So:

```text
no blocking doors → Blue + Green
only Green Door blocks Blue → Green
only Blue Door blocks Green → Blue
both teams blocked → neither colored team
```

Keep this logic in one pure function:

```ts
resolveColoredTeamsAtTreasure(state): {
  blueWins: boolean;
  greenWins: boolean;
}
```

---

# 35. Saboteur role

Saboteurs win the round if:

```text
no Start→Gold connection exists when the round ends
```

They lose if Gold is reached.

Only Saboteurs who are **not Trapped** at round end participate in normal winner count / Gold distribution.

---

# 36. Boss / 工頭

Boss is aligned with successful Gold-Digger teams.

Normally:

```text
if Blue and/or Green team wins
→ Boss also wins
```

Boss receives:

```text
base winning share - 1 Gold
```

minimum 0.

Special both-door case:

If Gold is reached and both Blue and Green are blocked:

- Boss remains eligible;
- if Boss is the only standard eligible winner, award 4 Gold;
- see the deterministic Boss+Profiteer rule below.

A Trapped Boss receives 0 and does not count toward winner count.

---

# 37. Profiteer / 奸商

Profiteer benefits from whichever standard side succeeds:

```text
Gold-Digger success
or
Saboteur success
```

Normal share:

```text
base winning share - 2 Gold
```

minimum 0.

Special cases:

1. If Gold is reached, neither colored team can reach it, Profiteer is the only eligible standard winner, award **3 Gold**.
2. If round ends without Gold and there are **no Saboteurs in play**, an untrapped Profiteer is the sole standard winner and receives **3 Gold**.

A Trapped Profiteer receives 0 and does not count.

---

# 38. Deterministic Boss + Profiteer both-door edge case

The physical rule history has had wording ambiguities around this rare situation.

For this digital implementation, use this explicit rule:

```text
Gold is reached
Blue cannot reach
Green cannot reach
Boss is active/untrapped
Profiteer is active/untrapped
```

Then:

```text
winning-group size = 2
base share = 4
Boss gets 3
Profiteer gets 2
```

If only Boss is eligible:

```text
Boss gets 4
```

If only Profiteer is eligible:

```text
Profiteer gets 3
```

If neither exists:

```text
no standard treasure winner
```

Geologists are resolved separately.

Put this edge case under unit tests so it never depends on UI behavior.

---

# 39. Geologist / 地質學家

Geologists are scored separately from the standard winner group.

At round end:

```text
crystalGold = number of visible crystal icons on all Path cards still on board
```

Connectivity to Start is irrelevant.

If exactly one untrapped Geologist is currently in play:

```text
that player receives crystalGold
```

If two untrapped Geologists are in play:

```text
each receives floor(crystalGold / 2)
```

Any remainder is lost.

Geologists:

- do not count toward standard winner count;
- may receive crystal Gold even when Saboteurs succeeded;
- receive 0 if Trapped at round end.

Because Change Hats exists, determine Geologists by **current role at round end**, not original round role.

---

# 40. Standard winner share table

After excluding Trapped players and Geologists, determine the number of eligible standard winners.

```text
1 winner   → base 5 Gold
2 winners  → base 4 Gold each
3 winners  → base 3 Gold each
4 winners  → base 2 Gold each
5+ winners → base 1 Gold each
```

Then apply role modifiers:

```text
Blue / Green Digger / Saboteur → full base share
Boss                           → base - 1
Profiteer                      → base - 2
```

Clamp at 0.

Special sole-winner rules override where specified above.

Required function:

```ts
calculateRoundGoldAwards(state): Record<string, number>
```

---

# 41. Theft resolution after scoring

After all normal and Geologist Gold awards are committed:

```text
resolve Theft
```

Each eligible Theft player selects one other player with at least 1 Gold.

Transfer:

```text
1 Gold
```

atomically.

Gold is cumulative match score, so Theft may steal Gold earned in earlier rounds as well.

Theft target choice is public after resolution, but exact target total need not be revealed.

---

# 42. Gold visibility

For official-style fidelity:

```text
exact cumulative Gold total is private during the match
```

The owner may see their own total.

Other players may see a generic status such as:

```text
有金塊
```

if needed for Theft targeting, but should not see exact score until final game reveal.

At `GAME_OVER`:

```text
reveal all total Gold scores
```

If the project owner later prefers the common house-rule/public-score UX, implement it behind a room option; do not mix both behaviors in core scoring logic.

---

# 43. Final match winner

After Round 3 Theft resolution:

```text
reveal cumulative Gold totals
```

Highest total wins.

If tied:

```text
all tied highest players share victory
```

Required:

```ts
determineMatchWinners(players): string[]
```

---

# 44. Private hand model

Hands are private.

```ts
export interface PrivateSaboteur2PlayerState {
  role: Saboteur2Role;
  hand: PlayingCardInstance[];
  goldTotal: number;
  privateGoalKnowledge: Record<string, GoalIdentity>;
  inspectedRoles: Array<{
    targetUid: string;
    observedRole: Saboteur2Role;
    observedAtStateVersion: number;
  }>;
}
```

Other clients may know:

```text
hand size
```

but not identities.

Swap Hands must swap exact private arrays server-side.

---

# 45. Public player status

Public player panel can show:

```text
nickname
current hand count
broken tools
Trapped status
Theft status
connection status
revealed role only after round end
```

Do not expose role mid-round except privately through Inspection.

Example:

```text
Tony
🃏 5 cards
⛏️ broken
🪤 trapped
💰 has Gold
Role: ???
```

---

# 46. Firebase authoritative operations

Recommended server/trusted actions:

```text
startSaboteur2Match
setupSaboteur2Round
playPathCard
playBreakTool
playRepair
playRockfall
playMap
playTheft
playHandsOff
playSwapHands
playInspection
playChangeHats
playTrapped
playFreedom
discardTwoAndRemoveEffect
passAndRedraw
resolveGoalReveal
resolveRoundScoring
chooseTheftTarget
startNextRound
```

Every action must validate:

```text
authenticated uid
room membership
game id
phase
current player
stateVersion
card ownership
card type
legal target
board placement
rotation
persistent-effect duplication
hand size
draw-deck availability
```

Never allow a client to submit a replacement board/hand/score object.

---

# 47. Transaction and race protection

Potential races:

```text
double-click card play
same account open in two tabs
simultaneous reconnect
stale board coordinate
stale target action
repeated Theft resolution
```

Use:

```ts
stateVersion: number;
lastActionId?: string;
```

Trusted commands should:

```text
read current state
validate expected version / active player
apply exactly once
increment version
```

Make command retries idempotent where practical.

---

# 48. No-information-leak requirements

Never expose publicly before appropriate reveal:

```text
player role
unused role deck
Change Hats new/old role
player hand contents
10 cards removed before round
face-down discard identities
Map result
Inspection result
exact cumulative Gold total
goal-card identities before reveal
```

Public logs must not accidentally include secret payloads.

Bad:

```text
Tony discarded Green Door and Inspection
Kevin inspected Amy and saw SABOTEUR
```

Good:

```text
Tony passed and exchanged 2 cards
Kevin used Inspection
```

---

# 49. Public action log

Safe examples:

```text
Tony 放置了一張道路牌
Kevin 破壞了 Amy 的十字鎬
Amy 修好了十字鎬
Jack 使用了地圖
Mary 使用了偵查
Peter 交換了手牌
Lisa 更換了一名玩家的身份
Tony 被困住了
Kevin 跳過並交換了 3 張手牌
發現岩石目標，遊戲繼續
找到金礦！本回合結束
```

At round reveal, role identities and round Gold awards may be shown as appropriate.

---

# 50. Board UX

Desktop concept:

```text
┌────────────────────────────────────────────────────────┐
│ 矮人礦坑 2     Round 2/3       Tony 的回合            │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Start ──┬──┬─────────────── ? Goal                    │
│         │  └─◇ crystal                                │
│         ├──[Blue Door]────── ? Goal                    │
│         │                                              │
│         └──── ladder ──────── ? Goal                    │
│                                                        │
├────────────────────────────────────────────────────────┤
│ Players                                                │
│ Tony  🃏6       Kevin 🃏5 🔧broken                     │
│ Amy   🃏4 🪤    Jack  🃏6                              │
├────────────────────────────────────────────────────────┤
│ My hand                                                │
│ [Path] [Path] [Map] [Trap] [Repair] [Theft]           │
└────────────────────────────────────────────────────────┘
```

Board must support:

- pan;
- zoom;
- centering on Start;
- centering on Goals;
- highlighting legal placement coordinates;
- 0°/180° card rotation preview;
- visible doors/crystals/ladders;
- mobile touch interaction.

Do not implement tunnel placement using arbitrary HTML absolute positions without grid coordinates.

---

# 51. Mobile UX

Mobile is required.

Recommended:

```text
Top bar:
Round / current player / deck count

Main:
pinch/drag mine board

Bottom sticky drawer:
My role
My hand
Current effects
```

Path placement:

```text
tap Path card
→ legal coordinates highlight
→ tap coordinate
→ rotate 0° / 180°
→ preview
→ confirm
```

Action cards:

```text
tap action
→ show only legal targets
→ confirm
```

Do not rely on drag-and-drop as the only interaction.

---

# 52. Private role UX

Use privacy-conscious reveal:

```text
[ 按住查看我的身份 ]
```

or:

```text
tap → blurred modal → confirm reveal
```

Role help should describe only the current player's role.

Example:

```text
藍隊挖金矮人

讓你的隊伍通往黃金。
綠色門會阻擋你。
若由藍隊玩家完成黃金連線，藍隊具有優先勝利判定。
```

Do not show a full list of who could currently win based on hidden roles.

---

# 53. Map / Inspection private-result UX

Map:

```text
你查看了上方目標：
🪨 岩石

[記住並關閉]
```

Inspection:

```text
你查看 Kevin 的目前身份：
🟩 綠隊挖金矮人

此資訊可能因「交換身份」而在之後失效。
```

Only acting player's client receives these values.

---

# 54. Change Hats UX

Public animation:

```text
Kevin 的身份被交換了！
```

Target privately receives:

```text
你的身份已改變

[ 按住查看新身份 ]
```

Do not reveal old/new roles publicly.

Inspection history should continue displaying what the inspector saw **at that time**, not silently mutate to the new role.

---

# 55. Round result UX

Round-end panel should reveal roles and summarize scoring.

Example:

```text
ROUND 2 RESULT

找到黃金
Winning Team: Blue

Tony   藍隊       +3
Kevin  工頭       +2
Amy    奸商       +1
Jack   地質學家   +4 (4 crystals)
Mary   綠隊        0
Peter  破壞者      0

⚠ Lisa remained Trapped → 0

接著處理偷竊牌……
```

Do not reveal exact previous cumulative totals unless configured public.

---

# 56. Theft UX

When multiple Theft owners exist, resolve one at a time in correct order.

Eligible player sees:

```text
你可以偷取 1 金塊

選擇玩家：
Tony   有金塊
Kevin  無金塊
Amy    有金塊
```

After selection:

```text
你從 Amy 偷走 1 金塊
```

This transfer must be authoritative and atomic.

---

# 57. Reconnect behavior

A reconnecting player must recover:

```text
current round
current turn
board
hand
current private role
private Map knowledge
Inspection observations
their own exact Gold
persistent effects
pending private action/target selection
```

Do not skip required private decisions due to disconnect.

If reconnect occurs after a role changed:

```text
restore new role, not old role
```

---

# 58. Disconnection policy

Friend-only default:

```text
temporary disconnect → keep seat
```

Do not automatically play/discard strategic cards for the disconnected player.

Allow reconnect.

Host may later have a manual terminate-match option.

Do not transfer a player's role or hand to another player.

---

# 59. Base-engine tests — topology

At minimum test:

- card must be adjacent to existing board;
- all touching edges match;
- 90° placement rejected;
- 180° placement supported;
- ordinary card requires Start connectivity;
- disconnected card placement rejected;
- Bridge channels do not connect internally;
- Double Bend channels do not connect internally;
- Bridge placement requires at least one Start-connected channel;
- Ladder obtains virtual Start connectivity;
- Ladder cannot be adjacent to Goal;
- door does not block physical tunnel placement;
- crystal has no connectivity effect;
- Rockfall disconnects graph correctly;
- removed crystal stops scoring;
- multiple possible Start→Goal routes are handled.

---

# 60. Goal tests

At minimum:

- all three goals begin hidden;
- Map does not publicly reveal goal;
- reaching rock reveals rock and round continues;
- reaching gold ends round immediately;
- goal may use placement exception for unmatched neighboring edge;
- treasure connector UID recorded;
- Ladder that reconnects a remote network can trigger goal reveal;
- goal identity never readable by unauthorized client before reveal.

---

# 61. Action tests

Base actions:

- break tool prevents Path play;
- different broken tools can coexist;
- duplicate same broken tool rejected;
- matching repair removes one break;
- dual repair removes only one effect;
- repair without matching break rejected;
- Rockfall cannot remove Start/Goal;
- Map is private.

Expansion actions:

- Theft remains in front of self;
- duplicate Theft on same player rejected;
- Hands Off removes Theft;
- Swap Hands swaps full private hands;
- Swap Hands target receives one draw;
- Inspection result private;
- Change Hats allows self target;
- Change Hats old role goes under unused-role deck;
- Change Hats new role applies immediately;
- Trapped prevents Path play;
- Freedom removes Trapped;
- discard-two removes one self effect and draws one;
- pass accepts 1–3 cards;
- passed card identities stay private.

---

# 62. Role/scoring tests

At minimum test:

## Colored miners

- Blue connector + Blue can reach → Blue wins only;
- Blue connector + Blue blocked + Green can reach → Green wins;
- Green mirror cases;
- neutral connector + no doors → both teams win;
- neutral connector + Green door → Green only;
- neutral connector + Blue door → Blue only;
- multiple paths: one unblocked path is enough for that team;
- both colors blocked → neither colored team.

## Boss / Profiteer

- Boss joins successful miner side and loses 1 from base share;
- Profiteer joins successful side and loses 2;
- Boss sole both-door case → 4;
- Profiteer sole case → 3;
- Boss + Profiteer both-door edge → 3 / 2;
- no treasure + Saboteurs present → Profiteer joins Saboteur result;
- no treasure + no Saboteurs + Profiteer → 3.

## Geologists

- count all visible crystals, connected or not;
- one Geologist gets full crystal count;
- two split with floor;
- Geologists do not count toward normal winner table;
- Trapped Geologist gets 0.

## Trapped

- trapped player excluded from winner count;
- trapped Digger gets 0;
- trapped Saboteur gets 0;
- trapped Boss/Profiteer gets 0;
- trapped player cannot Theft.

---

# 63. Gold / Theft tests

- standard table 1→5, 2→4, 3→3, 4→2, 5+→1;
- Boss modifier clamps to 0;
- Profiteer modifier clamps to 0;
- Gold persists between rounds;
- exact totals hidden mid-match;
- eligible Theft transfers exactly 1;
- Theft cannot run while Trapped;
- most recently played Theft resolves first;
- remaining Theft owners resolve clockwise;
- Theft target with 0 Gold cannot lose Gold;
- Round 3 Theft completes before final winner calculation;
- final highest total wins;
- ties produce co-winners.

---

# 64. Firebase security tests

Use Firebase Emulator / Rules tests where practical.

Must verify:

```text
A cannot read B's hand
A cannot read B's role
A cannot read unused-role deck
A cannot read removed-10 deck cards
A cannot read Map result belonging to B
A cannot read Inspection result belonging to B
A cannot read exact B Gold total mid-match
A cannot inspect face-down discard identities
A cannot mutate board directly
A cannot act out of turn
A cannot submit a card not in own hand
```

Do not mark feature complete until secret-state tests pass.

---

# 65. Visual direction

Recommended original visual theme:

```text
underground dwarf mine
warm lantern light
rough stone
wooden supports
blue / green faction accents
crystal glow
gold sparkle
```

Use CSS/SVG/project-owned assets.

Do not copy official card illustration composition.

Cards should clearly communicate:

```text
tunnel topology
open / blocked edges
blue/green door
crystal
ladder
special bridge/double-bend structure
```

Clarity is more important than decorative art.

---

# 66. Motion

Use Motion for:

- Path card placement;
- 180° rotation;
- goal flip;
- Rockfall removal;
- tool break/repair;
- Trapped/Freedom;
- Change Hats;
- Gold award;
- Theft transfer;
- round result;
- final winner.

Animations must not delay the game unnecessarily.

Respect:

```css
prefers-reduced-motion
```

---

# 67. Optional sound

Optional only:

```text
pickaxe / rock placement
goal flip
crystal chime
gold discovery
tool break
gold theft
```

Include mute control.

Do not block MVP on sound.

---

# 68. Error messages

Traditional Chinese examples:

```text
目前不是你的回合
你的手牌中沒有這張牌
這個位置不能放置道路牌
道路的邊緣無法與相鄰卡牌連接
道路牌必須保持直向
這張牌目前沒有連回入口
你的工具已被破壞，無法放置道路牌
你目前被困住，無法放置道路牌
這個玩家已經有相同效果
沒有可以修復的工具
梯子道路不能放在目標牌旁邊
只能丟棄 1～3 張牌來跳過回合
交換身份時遊戲狀態已改變，請重試
此操作已過期，已同步最新狀態
```

On stale transaction:

```text
resync
show concise error
keep player in match
```

---

# 69. Anti-cheat requirements

Never trust client-provided:

```text
role
hand
card definition
legal coordinate
rotation legality
goal identity
winner group
crystal count
Gold award
Gold total
Theft amount
current player
```

A malicious client must not be able to:

```text
see other hands
see other roles
peek goals for free
inspect roles for free
place illegal tunnel topology
play while not active
play card not owned
ignore broken tools / Trapped
change team outcome
forge Gold
repeat Theft
force Change Hats role
```

---

# 70. Implementation milestones

## S2-1 — Game registration and board skeleton

Implement:

- game catalog entry;
- 2–12 player room constraint;
- route/module;
- board grid;
- Start + three hidden Goals;
- pan/zoom;
- private hand placeholder;
- role privacy placeholder.

Acceptance:

```text
create room
→ choose 矮人礦坑 2
→ 2–12 players ready
→ start
→ board + hands render
```

---

## S2-2 — Tunnel topology engine

Implement:

- grid coordinates;
- channels/ports;
- 0°/180° rotations;
- ordinary placement legality;
- reachability graph;
- goal reachability;
- unit tests.

Do not start complex Firebase gameplay until this engine is reliable.

---

## S2-3 — Base Saboteur mechanics

Implement:

- base Path dataset;
- broken tools;
- repair;
- Rockfall;
- Map;
- goal reveal;
- private hands;
- draw/discard.

Acceptance:

A local deterministic test can build a valid tunnel from Start to Gold.

---

## S2-4 — Saboteur 2 path/action mechanics

Implement:

- Bridge;
- Double Bend;
- Ladder;
- Doors;
- Crystals;
- Theft;
- Hands Off;
- Swap Hands;
- Inspection;
- Change Hats;
- Trapped;
- Freedom;
- discard-two cleanup;
- 1–3 card pass.

Acceptance:

Pure engine tests for every new mechanic pass.

---

## S2-5 — Roles and scoring

Implement:

- all 15 roles;
- role swaps;
- colored-team connector logic;
- door accessibility;
- Saboteur ending;
- Boss;
- Profiteer;
- Geologist;
- Trapped exclusions;
- Gold share table;
- Theft resolution;
- three-round match scoring.

Acceptance:

All role/scoring edge-case tests pass.

---

## S2-6 — Firebase realtime / secrecy

Implement authoritative multiplayer state:

```text
turns
hands
board
private roles
unused roles
goals
private Map/Inspection
Gold
```

Acceptance with multiple browsers:

```text
Tony places Path
→ everyone sees it
→ Kevin plays Inspection
→ only Kevin sees target role
→ Amy swaps roles
→ only Amy sees new role
→ no unauthorized browser can read secrets
```

---

## S2-7 — Complete round UX

Implement:

- hand UI;
- legal placement highlighting;
- action target dialogs;
- Map/Inspection privacy screens;
- Trapped/tool status;
- goal flip;
- round role reveal;
- scoring breakdown;
- Theft selection.

Acceptance:

A group can complete one full round without DB/manual intervention.

---

## S2-8 — Complete 3-round game

Implement:

- next-round setup;
- previous-round final-player starting rule;
- persistent Gold;
- fresh roles;
- fresh hidden 10-card removal;
- Round 3 final scoring;
- tie winners;
- rematch.

Acceptance:

2–12 browser sessions can complete an entire match.

---

## S2-9 — Mobile/reconnect/polish

Implement:

- responsive board;
- touch pan/zoom;
- bottom hand drawer;
- reconnect;
- stale action handling;
- reduced motion;
- final visual polish;
- safe public game log.

---

# 71. Definition of Done

The feature is complete when:

- `矮人礦坑 2` appears in the existing game catalog;
- 2–12 players are supported;
- three rounds work;
- every player starts each round with 6 cards;
- 10 random playing cards are secretly removed each round;
- all 15 expansion roles are supported;
- roles remain private during play;
- tunnel placement is topology-correct;
- Bridge/Double Bend independent paths work;
- Ladder virtual connectivity works;
- Blue/Green doors affect winner reachability correctly;
- Crystals score correctly;
- base broken-tool / repair / Rockfall / Map actions work;
- Theft / Hands Off / Swap Hands / Inspection / Change Hats / Trapped / Freedom work;
- discard-two cleanup works;
- 1–3 card pass works;
- Goal reveal works;
- colored-team connector rules work;
- Saboteur/Boss/Profiteer/Geologist scoring works;
- Trapped exclusions work;
- Theft resolves in correct order;
- Gold persists across rounds;
- final highest Gold wins;
- exact private state is protected by Firebase rules;
- reconnect works;
- mobile board is usable;
- tests pass;
- lint passes;
- production build passes;
- README documents this game.

---

# 72. Non-goals for first release

Do not spend initial development time on:

```text
Saboteur World Championship promo cards
20th Anniversary mini expansions
Tunnel Toll
Costume Department
Tunnel Party
New Goals
Treasure Chests
AI bots
public matchmaking
ranked ladder
spectator mode
voice chat
```

Those may be separate future specs.

---

# 73. Priority order

When tradeoffs are necessary:

```text
tunnel topology correctness
>
secret-information security
>
role/scoring correctness
>
transaction integrity
>
realtime synchronization
>
mobile usability
>
visual polish
```

---

# 74. Codex instructions

Before editing:

1. Read this file completely.
2. Inspect the current repository and existing game architecture.
3. Reuse platform Auth/Room/Firebase utilities.
4. Do not initialize a second Firebase app.
5. Do not create another standalone React project.
6. Preserve all existing games.
7. Check whether generic card/room/private-state components already exist before creating duplicates.

Implement sequentially:

```text
S2-1
→ S2-2
→ S2-3
→ S2-4
→ S2-5
→ S2-6
→ S2-7
→ S2-8
→ S2-9
```

**Do not skip S2-2.** The mine topology engine is the foundation of this game and must be unit-tested before UI/Firebase complexity is layered on top.

After every major milestone:

```text
run tests
run lint
run build
inspect git diff
```

Fix failures before proceeding.

If Firebase deployment or Console configuration requires credentials unavailable to the coding environment:

- complete all repository-side work possible;
- do not invent credentials;
- report the exact remaining manual action.

Do not stop after scaffolding.

Begin implementation.
