# 同房異夢（Décorum）Web Game --- Codex Implementation Spec

> Repository: `tonyleesos/boardgame-online-platform`
>
> This is an extension of the existing React + TypeScript + Vite +
> Firebase boardgame platform. Inspect the repository first and modify
> the existing workspace; do not create a replacement app.

## 0. Naming and content boundary

The researched commercial game is **《同房異夢》 / Décorum**
(not「同床異夢」). Use `同房異夢` as the in-app name unless the owner
explicitly renames the digital adaptation.

Implement the gameplay system/mechanics, but **do not copy the
commercial game's 30 scenario cards, scenario stories, condition
wording, illustrations, graphic design, or scans**. Build an extensible
engine and include only original demo scenarios/conditions written for
this project.

## 1. Product goal

Décorum is a 2--4 player cooperative hidden-information deduction/puzzle
game. Players share a house and win when the current house
simultaneously satisfies every player's secret decorating conditions.
Players normally cannot explain those conditions directly; instead,
after a house change they provide constrained positive/neutral/negative
feedback. Information-sharing meetings later reveal limited conditions.

Core experience:

``` text
shared mutable house
+ private conditions
+ constrained reactions
+ deduction/compromise
+ cooperative victory
```

Game metadata:

``` ts
export const decorumGame = {
  id: 'decorum',
  name: '同房異夢',
  minPlayers: 2,
  maxPlayers: 4,
  type: 'cooperative-hidden-information',
};
```

Reuse existing Firebase anonymous auth, nickname, room code, host, ready
state, presence/reconnect and game routing.

Recommended module:

``` text
client/src/games/decorum/
├ components/
├ engine/
├ scenarios/
├ constants.ts
├ types.ts
└ rules.ts
```

## 2. House model

Base house has four rooms. The 2-player layout is conceptually:

``` text
┌─────────────┬─────────────┐
│ Bathroom 浴室│ Bedroom 臥室│
├─────────────┼─────────────┤
│ Living 客廳  │ Kitchen 廚房│
└─────────────┴─────────────┘
```

Some 3/4-player scenarios use two bedrooms, so do not hardcode the
bathroom layout.

``` ts
type RoomType =
  | 'livingRoom'
  | 'kitchen'
  | 'bedroom'
  | 'bedroom2'
  | 'bathroom';

interface RoomState {
  id: string;
  type: RoomType;
  wallColor: DecorColor;
  objects: {
    lamp: DecorObject | null;
    curio: DecorObject | null;
    wallHanging: DecorObject | null;
  };
}
```

## 3. Decorations

Object types:

``` ts
type ObjectType = 'lamp' | 'curio' | 'wallHanging';
```

UI labels:

``` text
lamp → 燈具
curio → 擺飾
wallHanging → 壁飾
```

Colors:

``` ts
type DecorColor = 'red' | 'yellow' | 'blue' | 'green';
```

Styles:

``` ts
type DecorStyle = 'modern' | 'antique' | 'retro' | 'unusual';
```

Use Chinese labels 現代 / 古典 / 復古 / 奇特.

Objects contain type, color and style:

``` ts
interface DecorObject {
  id: string;
  type: ObjectType;
  color: DecorColor;
  style: DecorStyle;
}
```

Not every color/style combination exists. Define an explicit catalog
rather than assuming every combination is valid. Wall paint has color
but no style.

## 4. Scenario system

Use data-driven scenarios:

``` ts
interface DecorumScenario {
  id: string;
  name: string;
  playerCount: 2 | 3 | 4;
  difficulty: 1 | 2 | 3 | 4 | 5;
  description: string;
  rooms: RoomDefinition[];
  initialHouse: HouseState;
  playerConditions: Record<number, ConditionDefinition[]>;
  maxRounds: number;
  enableRoommateTokens?: boolean;
}
```

Do not reproduce official scenarios. Create at least:

-   2 original 2-player demo scenarios
-   1 original 3-player demo scenario
-   1 original 4-player demo scenario

Each bundled scenario must have at least one verified solution.

## 5. Condition engine --- critical subsystem

Conditions must be machine-evaluable, not just strings.

``` ts
interface ConditionDefinition {
  id: string;
  description: string;
  evaluator: ConditionExpression;
}
```

Build composable expressions such as:

``` ts
type ConditionExpression =
  | RoomHasObjectCondition
  | RoomHasNoObjectCondition
  | ObjectCountCondition
  | ColorCountCondition
  | StyleCountCondition
  | RoomColorCondition
  | EveryRoomCondition
  | SomeRoomCondition
  | LeftSideCondition
  | RightSideCondition
  | SameRoomCondition
  | DifferentRoomCondition
  | AndCondition
  | OrCondition
  | NotCondition;
```

The engine should be capable of original conditions such as:

``` text
客廳至少有一個藍色物件
廚房不能有燈具
房屋內恰好有三個復古物件
至少兩個房間是黃色牆壁
每個房間至少有一個物件
臥室與客廳的牆色不同
房屋左側不能出現奇特風格
```

Required pure APIs:

``` ts
evaluateCondition(condition, house, context?): boolean

evaluatePlayerConditions(conditions, house, context?): {
  fulfilled: boolean;
  results: Array<{ conditionId: string; fulfilled: boolean }>;
}
```

Keep these independent from React and Firebase.

## 6. Hidden information and Firebase

A player may read:

-   their own conditions;
-   conditions legitimately shared to them during a meeting.

They must not be able to fetch every player's hidden conditions via
Firebase/DevTools.

Conceptual storage:

``` text
rooms/{roomCode}/game/public/
  house
  phase
  currentPlayerId
  round
  heartsRemaining
  latestAction
  reactions
  fulfillmentStatus

privateGameData/{roomCode}/{uid}/
  conditions
  sharedConditionsReceived
```

Hiding data in React is not security. Update Firebase Security Rules and
use trusted/server-authoritative operations where needed.

Never trust client-supplied `isFulfilled`, `winner`, or
condition-evaluation results.

## 7. State machine

Use explicit phases:

``` ts
type DecorumPhase =
  | 'SETUP'
  | 'PLAYER_ACTION'
  | 'FULFILLMENT_CHECK'
  | 'REACTION'
  | 'ROUND_END'
  | 'HEART_TO_HEART'
  | 'HOUSE_MEETING'
  | 'GAME_OVER';
```

Suggested public state:

``` ts
interface DecorumPublicState {
  phase: DecorumPhase;
  scenarioId: string;
  playerOrder: string[];
  currentPlayerIndex: number;
  round: number;
  heartsRemaining: number;
  house: HouseState;
  playerFulfilled: Record<string, boolean>;
  latestAction?: DecorumAction;
  reactions?: Record<string, ReactionType>;
  winner?: 'players' | 'none';
  endReason?: 'all-fulfilled' | 'round-limit';
}
```

## 8. Turn flow

Each player's turn:

``` text
Perform one legal action
→ recompute fulfillment
→ other player(s) react
→ next player
→ after all players act, end round
```

Server/game engine must enforce current player and phase.

## 9. Legal actions

Support:

### Add Object

Add an object to an empty matching object-type slot.

### Remove Object

Remove an existing object.

### Swap Object

Replace an object with another object of the **same type**. A lamp may
become another lamp; it cannot become a wall hanging.

### Paint Room

Change one room's wall color.

### Pass

No house change. Standard implementation allows this only when the
active player is currently fulfilled. Validate in engine/server, not
only UI.

### Roommate Swap

Used only by scenarios enabling roommate tokens. A player moves their
own roommate token between bedrooms; destination occupancy/displacement
rules must be validated. This may follow after the complete 2-player
implementation, but types must support it.

## 10. Fulfillment

Immediately after every house-changing action, recompute all players'
conditions authoritatively.

A player's fulfillment is **not permanent**: another player's later
action may make them unfulfilled again.

Public UI may show:

``` text
Tony：滿意
Kevin：不滿意
```

without revealing why.

If all players are fulfilled simultaneously, the group wins immediately.

## 11. Reactions / communication restriction

After the active player's action, feedback is constrained to:

``` ts
type ReactionType = 'positive' | 'neutral' | 'negative';
```

UI concepts:

``` text
喜歡 / 沒意見 / 不喜歡
```

Do not add unrestricted game text chat in the MVP.

For 2 players, the other player submits a reaction before the turn
advances. For 3/4 players, allow the multiplayer reaction behavior and
provide a deterministic completion/continue rule so online play cannot
deadlock.

## 12. Two-player timing

Two-player mode lasts at most **30 rounds**. Each round consists of
Player 1's turn and Player 2's turn.

Structured Heart-to-Heart information sharing occurs at the equivalent
of rounds **15, 20 and 25**.

The game succeeds immediately when both players are fulfilled
simultaneously. If the final round is exhausted without satisfying all
conditions, the scenario fails.

## 13. Heart-to-Heart --- 2 players

At each Heart-to-Heart:

1.  Player A selects one of their own conditions to reveal.
2.  Player B selects one of their own conditions to reveal.
3.  Those conditions become visible to the other player.
4.  Consume one heart token.
5.  Resume play.

Track which conditions have been shared. Do not reveal all conditions.

An optional later feature may allow both players, before the first
Heart-to-Heart, to agree that they are stuck and advance early to the
first sharing opportunity.

## 14. Three/four-player mode

Use five House Meeting opportunities. A House Meeting occurs after each
five-round block.

Some scenarios may use roommate tokens and a two-bedroom layout.

At a House Meeting:

1.  Each player may give a broad overall status about the house.
2.  Each player selects one shareable condition.
3.  Each player selects one other player as recipient.
4.  Only that recipient learns the selected condition.
5.  Consume one meeting/heart token.
6.  Resume play.

Sharing can be asymmetric:

``` text
Tony → condition A → Kevin
Kevin knows A
Amy/Jack do not
```

A recipient does not need to share back. Design the data model so
previously shared conditions can later be reassigned/retracted according
to meeting rules.

Prioritize a complete 2-player game first, then 3-player, then 4-player,
while keeping architecture compatible with all.

## 15. End game and scoring

Victory:

``` text
all players' conditions are simultaneously fulfilled
```

Failure:

``` text
round/meeting limit exhausted
and not all conditions are fulfilled
```

At game end reveal all conditions and final status.

Result screen should show:

-   cooperative win/loss;
-   total rounds;
-   fulfilled condition count;
-   all player conditions;
-   final house.

Optional score:

``` text
+3 per fulfilled condition

If all conditions were fulfilled:
+2 per unused heart/meeting token
```

Score is not the win condition.

## 16. Trusted operations

Prefer centralized validation for operations such as:

``` text
startDecorumGame
performDecorumAction
submitReaction
shareCondition
requestEarlyMeeting
advanceDecorumTurn
```

Validate:

-   authenticated uid;
-   room membership;
-   game id;
-   phase;
-   current player;
-   action legality;
-   object catalog/slot;
-   scenario;
-   condition ownership;
-   sharing recipient.

Use Firebase transactions/atomic updates where races are possible.

## 17. UI / UX

Visual identity should differ from Avalon while sharing platform
quality:

``` text
cozy interior design
+ colorful furniture
+ doll-house / floor-plan
+ smooth animations
```

Mobile-first. Do not make precise drag-and-drop mandatory.

Preferred interaction:

``` text
tap room
→ tap object slot
→ action sheet
→ Add / Remove / Swap / Paint
→ choose object/color/style
→ preview
→ confirm
```

Desktop drag/drop can be added later.

Secret conditions should be accessible through a bottom sheet/drawer.

For the web MVP, show live ✓/✗ status for **the current player's own
conditions**. Never expose another player's hidden condition
status/details unless legitimately shared.

Use Motion for object placement/removal, swaps, repainting, reaction
bubbles, fulfillment, meetings and victory. Respect
`prefers-reduced-motion`.

## 18. Original demo scenarios

Author original development content only, for example:

``` ts
{
  id: 'demo-two-01',
  name: '第一次合租',
  playerCount: 2,
  difficulty: 1,
  ...
}
```

Conditions should exercise multiple evaluator primitives.

If known-solution fixtures are stored, add a test verifying each bundled
scenario's solution satisfies all player conditions. Never send known
solutions to clients.

## 19. Tests

Add/extend Vitest tests for at least:

-   add to empty slot;
-   reject add to occupied same-type slot;
-   remove;
-   swap preserves object type;
-   repaint;
-   pass only while fulfilled;
-   turn ownership;
-   condition primitives;
-   AND/OR/NOT;
-   fulfillment recalculation;
-   fulfilled player can become unfulfilled;
-   all fulfilled -\> victory;
-   round limit -\> failure;
-   2-player Heart-to-Heart timing;
-   private conditions inaccessible to another uid;
-   sharing grants access only to intended recipient;
-   3/4-player meeting progression;
-   every bundled demo scenario has a valid solution.

Engine tests must not require React rendering.

## 20. Implementation milestones

### D1 --- Registration and skeleton

Add `decorum` to game catalog, routes, module, types and a responsive
house board.

Acceptance: 2--4 player room can select/start 同房異夢 and render its
game page.

### D2 --- House engine

Implement room/object catalog and Add/Remove/Swap/Paint/Pass validation
with pure tests.

### D3 --- Condition engine

Implement composable machine-evaluable conditions and original demo
scenarios.

Acceptance: condition tests pass and demo scenarios have verified
solutions.

### D4 --- Firebase multiplayer

Synchronize current turn, house, action, reaction and rounds.

Acceptance with two browsers:

``` text
Tony changes living-room wall
→ Kevin sees it immediately
→ Kevin reacts
→ Tony sees reaction
→ turn advances
```

No refresh.

### D5 --- Hidden conditions

Implement secure private conditions, Firebase rules, authoritative
assignment/evaluation and no cross-player leakage.

### D6 --- Complete 2-player game

Implement scenario setup → conditions → alternating actions →
fulfillment → reactions → rounds → Heart-to-Heart → result/reveal.

Acceptance: two browser sessions complete a whole game without manual DB
edits.

### D7 --- 3/4-player game

Implement five House Meetings, selective sharing, multiplayer reactions
and roommate mechanics when scenario requires them.

Acceptance: three and four browser sessions can complete games.

### D8 --- Polish

Responsive mobile UI, action sheets, animations, condition drawer,
meetings, victory/failure, reconnect/loading/error handling.

## 21. Definition of Done

Feature is complete when:

-   同房異夢 appears in existing game catalog;
-   existing auth/room infrastructure is reused;
-   2--4 players work;
-   realtime house sync works;
-   turn authorization works;
-   conditions are machine-evaluable;
-   hidden conditions remain private;
-   reactions are constrained;
-   fulfillment recalculates correctly;
-   Heart-to-Heart works for 2 players;
-   House Meeting works for 3/4 players;
-   win/loss works;
-   original demo scenarios exist;
-   no official commercial scenario text/art was copied;
-   mobile UI is usable;
-   tests pass;
-   lint passes;
-   production build passes;
-   Firebase rules are updated;
-   README explains the feature.

## 22. Priority order

``` text
hidden-condition security
> condition correctness
> state/turn correctness
> realtime synchronization
> mobile usability
> animation/polish
```

## 23. Final instruction to Codex

Inspect the current repository before editing. This spec extends the
existing boardgame platform; do not replace working Avalon/platform
infrastructure.

Reuse shared components and Firebase infrastructure. Implement
milestones D1--D8 incrementally. Do not copy official Décorum scenario
cards, scenario text, art, or solutions.

After each major milestone:

``` text
run tests
run lint
run build
inspect git diff
```

Fix failures before proceeding.

If Firebase deployment requires a manual Console action or unavailable
credential, complete all repository-side work possible and report the
exact remaining manual step.

Do not stop after scaffolding. Begin implementation.
