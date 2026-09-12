# 教父風雲：危情古巴（Mafia de Cuba）Web Game — Codex Implementation Spec

> Target repository: `tonyleesos/boardgame-online-platform`
>
> Target platform: the existing React + TypeScript + Vite + Firebase multiplayer boardgame platform.
>
> This file is an implementation instruction for Codex / coding agents working directly in VS Code.
>
> **Directive:** extend the existing platform. Do not create a second application, do not duplicate Firebase initialization, and do not break existing Avalon / Time Bomb / 同房異夢 / 璀璨寶石 functionality.

---

# 0. Scope

Implement the **base game of《教父風雲：危情古巴》 / Mafia de Cuba** as a realtime multiplayer game.

Primary supported player count:

```text
6–12 players
```

Typical game flow:

```text
Choose Godfather
    ↓
Godfather secretly prepares the cigar box
    ↓
Pass cigar box player-by-player
    ↓
Each player secretly takes diamonds OR a role
    ↓
Godfather receives the box back
    ↓
Open discussion / interrogation
    ↓
Godfather accuses players
    ↓
Roles / stolen diamonds are revealed as required
    ↓
Resolve winner
```

The core digital experience must preserve:

```text
hidden box information
+ human memory
+ bluffing
+ free-form interrogation
+ asymmetric role goals
+ dramatic accusations
```

The base game is the priority. The **Cleaner** may be implemented as an optional advanced base-game role. `Revolución` is only an extension hook in this specification and is **not** required for the first playable release.

---

# 1. Copyright / asset boundary

Implement game mechanics and state flow, but do not copy commercial artwork, official box graphics, token illustrations, logo treatments, or large portions of rulebook wording.

Use original project-owned visual assets.

Recommended visual direction:

```text
1950s Havana noir
dark mahogany
cigar-box texture
gold / amber accents
diamond highlights
art-deco typography feeling
```

Do not use official scanned cards/tokens/images.

Rules should be encoded as engine logic and concise original help text.

---

# 2. Game metadata

```ts
export const mafiaDeCubaGame = {
  id: 'mafia-de-cuba',
  name: '教父風雲：危情古巴',
  minPlayers: 6,
  maxPlayers: 12,
  type: 'social-deduction',
};
```

Recommended catalog card:

```text
┌──────────────────────────────┐
│      教父風雲：危情古巴       │
│        MAFIA DE CUBA         │
│                              │
│  6–12 人 · 說謊 · 推理        │
│                              │
│       [ 建立房間 ]            │
└──────────────────────────────┘
```

Reuse existing:

- Firebase Anonymous Auth;
- nickname;
- create / join room;
- room code;
- host;
- ready state;
- presence and reconnect;
- common game router;
- common loading/error/toast UI;
- platform player seating/order utilities where possible.

---

# 3. Source structure

Recommended:

```text
client/src/games/mafia-de-cuba/
├─ components/
│  ├─ MafiaDeCubaBoard.tsx
│  ├─ CigarBox.tsx
│  ├─ CigarBoxPrivateView.tsx
│  ├─ GodfatherPanel.tsx
│  ├─ PlayerCircle.tsx
│  ├─ PlayerSeat.tsx
│  ├─ RoleHelp.tsx
│  ├─ DiamondTakeDialog.tsx
│  ├─ RoleTakeDialog.tsx
│  ├─ GodfatherSetupDialog.tsx
│  ├─ AccusationDialog.tsx
│  ├─ CleanerInterruptDialog.tsx
│  ├─ RevealDialog.tsx
│  └─ ResultDialog.tsx
│
├─ engine/
│  ├─ setup.ts
│  ├─ cigarBox.ts
│  ├─ theft.ts
│  ├─ investigation.ts
│  ├─ accusation.ts
│  ├─ cleaner.ts
│  ├─ winners.ts
│  ├─ validation.ts
│  └─ selectors.ts
│
├─ types.ts
├─ constants.ts
├─ rules.ts
└─ index.ts
```

Keep game-rule functions pure and independent from React/Firebase wherever possible.

---

# 4. Components / physical concepts represented digitally

The base implementation needs these concepts:

```text
15 diamonds
role tokens
Godfather
Joker / apology tokens
cigar box
hidden first-player discard
player seating order
```

Role-token pool can include:

```text
Loyal Henchman
Agent (FBI/CIA)
Driver
Cleaner (optional advanced role)
```

These are **not role tokens**:

```text
Thief
Street Urchin
Godfather
```

Those roles are created by game state / player action.

---

# 5. Role types

```ts
export type MafiaRole =
  | 'GODFATHER'
  | 'THIEF'
  | 'LOYAL_HENCHMAN'
  | 'AGENT_FBI'
  | 'AGENT_CIA'
  | 'DRIVER'
  | 'STREET_URCHIN'
  | 'CLEANER';
```

UI labels:

```text
GODFATHER       → 教父
THIEF           → 竊賊
LOYAL_HENCHMAN  → 忠誠手下
AGENT_FBI       → FBI 探員
AGENT_CIA       → CIA 探員
DRIVER          → 司機
STREET_URCHIN   → 街頭小子
CLEANER         → 清道夫 / Cleaner
```

Use one consistent Traditional Chinese translation throughout the app.

---

# 6. Player-count setup table

Use the standard base setup below. The count includes the Godfather.

| Players | Loyal Henchmen | Agents | Drivers | Jokers |
|---:|---:|---:|---:|---:|
| 6 | 1 | 1 | 1 | 0 |
| 7 | 2 | 1 | 1 | 0 |
| 8 | 3 | 1 | 1 | 1 |
| 9 | 4 | 1 | 1 | 1 |
| 10 | 4 | 2 | 1 | 1 |
| 11 | 4 | 2 | 2 | 2 |
| 12 | 5 | 2 | 2 | 2 |

Always start with:

```text
15 diamonds
```

When `Agents = 1`, use one agent token. When `Agents = 2`, use both FBI and CIA as distinct token identities with the same base trigger.

When Cleaner mode is enabled:

```text
replace 1 Loyal Henchman token with Cleaner
```

Do not increase the total role-token count.

Recommended config:

```ts
interface MafiaDeCubaConfig {
  cleanerEnabled: boolean;       // default false
  expertFivePlayerMode: boolean; // default false
  godfatherSelection: 'HOST_SELECTS' | 'RANDOM';
}
```

The normal UI should advertise **6–12** players.

---

# 7. Seating order is gameplay state

Seat order matters. Persist a stable circular order including the Godfather.

```ts
interface MafiaSeat {
  uid: string;
  seatIndex: number;
}
```

The cigar box passes from the Godfather to the first non-Godfather player and continues around the table until the last non-Godfather player returns it.

The Driver's victory condition depends on the player physically seated to the Driver's **right**.

Implement helpers:

```ts
getLeftNeighbor(uid, seating): string
getRightNeighbor(uid, seating): string
getBoxPassOrder(godfatherUid, seating): string[]
```

Do not infer Driver relationships from join order after the match has started.

---

# 8. Authoritative state model

Conceptual public state:

```ts
export interface MafiaDeCubaPublicState {
  phase: MafiaPhase;
  godfatherUid: string;
  seating: MafiaSeat[];
  currentBoxHolderUid?: string;
  jokersRemaining: number;
  players: Record<string, PublicMafiaPlayerState>;
  currentAccusation?: {
    accusedUid: string;
    status: 'PENDING' | 'RESOLVING';
  };
  lastReveal?: PublicReveal;
  winnerUids?: string[];
  endReason?: MafiaEndReason;
}
```

Private/server state:

```ts
export interface MafiaDeCubaSecretState {
  cigarBox: {
    diamonds: number;
    roleTokens: RoleTokenInstance[];
  };
  godfatherHiddenDiamonds: number;
  firstPlayerHiddenDiscard?: {
    token: RoleTokenInstance;
    playerUid: string;
  };
  privatePlayers: Record<string, PrivateMafiaPlayerState>;
  initialBoxDiamondCount: number;
  stolenDiamondsTotal: number;
  recoveredStolenDiamonds: number;
}
```

Private player state:

```ts
export interface PrivateMafiaPlayerState {
  role?: MafiaRole;
  stolenDiamonds: number;
  selectedRoleTokenId?: string;
  isAlive: boolean;
  isRevealed: boolean;
  currentBoxView?: PrivateBoxView;
}
```

`currentBoxView` must only exist while that player is actively holding the box.

---

# 9. Firebase visibility rules — critical

Public Firebase state may contain:

```text
phase
seat order
Godfather identity
current box holder
Jokers remaining
alive / eliminated / revealed status
public accusation history
publicly revealed roles
publicly recovered diamonds
winner
```

Public state must **not** contain:

```text
current cigar-box contents
Godfather's secretly removed diamond count
what a player took
unrevealed player roles
stolen-diamond counts
first player's secretly removed role token
previous private box snapshots
```

Conceptual storage:

```text
rooms/{roomCode}/game/public/...
privateGameData/{roomCode}/{uid}/...
serverGameData/{roomCode}/mafiaDeCuba/...
```

Only the current cigar-box holder may receive a temporary view of the current box. The Godfather receives the final box view when it returns.

Do not solve secrecy by merely hiding DOM elements.

---

# 10. Preserve memory and bluffing

When a player opens the cigar box they may see the current diamond count and remaining role tokens **only during their turn**.

After they confirm their take and pass the box:

```text
REMOVE the box snapshot from that player's readable private state
```

They must not be able to reopen a history panel and inspect what was in the box earlier.

Do not create a log containing previous private snapshots.

If a player disconnects **while currently holding the box**, reconnect should restore the current private box view. If they already passed, reconnect must not restore the previous snapshot.

---

# 11. State machine

```ts
export type MafiaPhase =
  | 'SETUP'
  | 'GODFATHER_PREPARE_BOX'
  | 'BOX_PASS'
  | 'BOX_PLAYER_DECISION'
  | 'INVESTIGATION'
  | 'ACCUSATION_PENDING'
  | 'CLEANER_INTERRUPT'
  | 'ACCUSATION_REVEAL'
  | 'GAME_OVER';
```

The server/trusted engine owns phase transitions.

---

# 12. Choosing the Godfather

For the first match, allow either:

```text
host selects
OR
random selection
```

The Godfather does not participate in normal cigar-box taking.

Future rematches may allow winners/host to choose the next Godfather.

---

# 13. Godfather box preparation

Create the role-token pool according to player count.

Initially:

```text
diamonds = 15
```

The Godfather privately chooses **0–5 diamonds** to remove from the box and keep hidden.

Example:

```text
Godfather removes 3
→ box starts with 12 diamonds
```

Only the Godfather and trusted server know this number.

```ts
godfatherHiddenDiamonds = selectedAmount;
cigarBox.diamonds = 15 - selectedAmount;
initialBoxDiamondCount = cigarBox.diamonds;
```

Validate `0 <= selectedAmount <= 5`.

---

# 14. Passing the cigar box

The public UI only shows who currently holds the box:

```text
Tony 正在查看雪茄盒……
```

Do not reveal how many diamonds remain, what role they select, whether they steal, or whether the first player uses their hidden discard.

Only one player can hold/open the box at a time.

---

# 15. Box-holder private UI

Example:

```text
┌───────────────────────────────────┐
│          只有你看得到              │
│                                   │
│        雪茄盒目前內容              │
│                                   │
│         💎 × 10                   │
│                                   │
│ [忠誠手下] [CIA] [司機]            │
│                                   │
│      [ 偷取鑽石 ]                  │
│                                   │
│      或選擇一枚角色標記            │
└───────────────────────────────────┘
```

Use original artwork. No observer-side sound or animation may leak box size or selected item type.

---

# 16. Standard box decision

A non-Godfather player normally chooses exactly one:

```text
A. Take 1 or more diamonds
OR
B. Take exactly 1 role token
```

They cannot normally take both.

Taking diamonds makes the player a `THIEF`; store the amount privately.

Taking a role removes exactly that role token from the box and assigns it privately.

---

# 17. First-player special action

The **first player after the Godfather** may secretly remove **0 or 1 role token** from the game before their normal take.

They may not remove diamonds with this special action.

After the optional hidden discard they must still:

```text
steal diamonds
OR
take another role token
```

The discarded token:

- is known to the first player and trusted server;
- is not public;
- is not the first player's role;
- is unavailable to later players;
- may be revealed at game end.

Store it separately as `firstPlayerHiddenDiscard`.

---

# 18. Empty-box rule

If a player receives a completely empty box:

```text
0 diamonds
AND
0 role tokens
```

that player automatically becomes `STREET_URCHIN`.

---

# 19. Last-player Street Urchin option

The final non-Godfather player may intentionally take nothing even if the box still contains something. They become `STREET_URCHIN`.

Only the final player has this voluntary no-take option.

---

# 20. Returning the box to the Godfather

After the final player's decision:

```text
currentBoxHolder = Godfather
phase = INVESTIGATION
```

The Godfather privately receives the final box contents.

The Godfather may privately see a helper summary such as:

```text
失竊鑽石：X
目前追回：Y
尚未追回：Z
```

Do not expose those values publicly unless the Godfather says them aloud.

---

# 21. Investigation phase

Investigation is human-driven. Players may tell the truth, lie, keep quiet, volunteer information, or accuse each other socially.

Do not validate spoken claims and do not build an automated contradiction detector.

MVP assumption:

```text
players are co-located
OR
use Discord / LINE / another voice channel
```

The web app is the secret-information game table.

---

# 22. Public player status

During investigation, public player cards may show nickname, seat, alive/eliminated state, and only legitimately revealed role information.

Before reveal:

```text
Role: ???
```

Never show hidden stolen-diamond amount or what they saw in the box.

---

# 23. Godfather accusation

Only the Godfather may issue the formal accusation.

Suggested button:

```text
[ 命令他掏出口袋 ]
```

Flow:

```text
Godfather selects target
→ confirmation
→ ACCUSATION_PENDING
→ optional Cleaner interrupt
→ reveal / resolve
```

Server/trusted state determines the actual target result.

---

# 24. Accusing a Thief

If the target is a Thief:

```text
reveal stolen diamond count
return those diamonds to Godfather
mark Thief eliminated
```

The eliminated Thief cannot continue participating in game actions.

After recovery, check whether all stolen diamonds have been recovered. If yes, end with Godfather-side victory.

---

# 25. Wrong accusation and Jokers

If the target is not a Thief and not an Agent, it is a false accusation.

If at least one Joker remains:

```text
consume 1 Joker
reveal target's role/status
target remains in play
investigation continues
```

If no Joker remains when one is required:

```text
Godfather is eliminated
investigation ends
resolve Thief-side winners
```

Joker count is public.

Recommended invariant: an already formally revealed innocent cannot be accused again.

---

# 26. Accusing an Agent

If the Godfather formally accuses an unrevealed FBI or CIA Agent, the game ends immediately.

Default digital rule:

```text
AGENT_ACCUSED = accused Agent wins alone
```

The other Agent, if any, does not automatically share the direct victory. Do not spend a Joker.

---

# 27. Loyal Henchman

A Loyal Henchman wins if the Godfather recovers all stolen diamonds.

If falsely accused while a Joker remains, reveal them, consume one Joker, and let them remain in play.

---

# 28. Driver

A Driver wins if the player directly to that Driver's **right** wins.

Use the persisted original seat order, not filtered/alive order.

For normal non-solo endings, resolve Driver winners after the direct winner set. If Drivers form a chain, resolve to a fixed point.

Example:

```text
Driver A's passenger = Driver B
Driver B's passenger = winning Thief
→ Driver B wins
→ Driver A then wins
```

For explicitly solo endings (`AGENT_ACCUSED`, `CLEANER_SHOT_AGENT`), do not add Driver co-winners unless the project owner later chooses a house-rule interpretation. Keep this decision isolated in `winners.ts`.

---

# 29. Street Urchin

A player becomes Street Urchin when the box is completely empty when received, or when the final player legally chooses to take nothing.

Street Urchin wins when the Thief side wins.

If falsely accused while Jokers remain, reveal them, consume one Joker, and keep them in play.

---

# 30. Optional advanced Cleaner role

Cleaner is disabled by default.

When enabled, replace one Loyal Henchman token with Cleaner.

After the Godfather chooses an accusation target but before reveal, an alive Cleaner owner may privately choose:

```text
POW
or
PASS
```

Do not publicly announce that the game is waiting for Cleaner. Use a neutral resolving state to avoid information leaks.

---

# 31. Cleaner shoots an Agent

If Cleaner chooses POW and the target is an Agent:

```text
Cleaner wins immediately
endReason = CLEANER_SHOT_AGENT
```

Default implementation: Cleaner is sole winner.

---

# 32. Cleaner shoots a non-Agent

If Cleaner shoots a non-Agent:

```text
Cleaner is eliminated
target is eliminated
```

If target is a Thief, return that Thief's stolen diamonds and immediately re-check Godfather victory.

If target is a non-Thief, no Joker is spent for the Cleaner resolution.

An eliminated Cleaner cannot later win with the Godfather.

---

# 33. Cleaner secrecy

Cleaner may be taken, left in the box, or secretly discarded by the first player. Therefore only a valid alive Cleaner owner gets the interrupt UI.

Other players see only a neutral message such as:

```text
正在處理指控……
```

---

# 34. Elimination

Eliminated players stay visually seated and appear in final results, but cannot perform further game actions. If the platform later provides in-app chat, disable it for eliminated players during the current investigation.

External voice compliance is honor-based.

---

# 35. Winner resolution

```ts
export type MafiaEndReason =
  | 'GODFATHER_RECOVERED_ALL'
  | 'GODFATHER_OUT_OF_JOKERS'
  | 'AGENT_ACCUSED'
  | 'CLEANER_SHOT_AGENT';
```

## Godfather recovers all stolen diamonds

Direct winners:

```text
Godfather
eligible Loyal Henchmen
eligible alive Cleaner acting as loyal-side role
```

Then resolve Driver conditions.

## Godfather runs out of Jokers on a false accusation

Among Thieves still in play, the highest stolen-diamond count wins. Ties share the Thief victory. Eligible Street Urchins also win. Then resolve Driver conditions.

## Godfather accuses Agent

Accused Agent wins alone.

## Cleaner shoots Agent

Cleaner wins alone.

---

# 36. Thief-side winner calculation

```ts
export function getWinningThieves(
  players: Record<string, PrivateMafiaPlayerState>
): string[]
```

Requirements:

```text
role = THIEF
still alive/in play
highest stolenDiamonds
return all ties
```

Previously caught Thieves cannot win.

---

# 37. Public result reveal

At `GAME_OVER`, reveal hidden information.

Example:

```text
🏆 本局勝利者

Kevin — 竊賊 — 偷走 5 顆
Amy   — 街頭小子
Jack  — 司機

完整身份
Tony  — 教父
Kevin — 竊賊 / 5 💎
Amy   — 街頭小子
Jack  — 司機
Mary  — 忠誠手下
Peter — CIA

教父起始藏起：3 💎
第一位玩家秘密移除：FBI
```

Do not reveal these secrets before game end.

---

# 38. No-information-leak logging

Allowed public logs:

```text
教父已準備好雪茄盒
雪茄盒交給 Tony
Tony 已完成選擇
進入調查階段
教父要求 Amy 掏出口袋
Amy 被揭露為忠誠手下
教父支付 1 個 Joker
Kevin 被揭露為竊賊並歸還 4 顆鑽石
```

Never log secret take/box contents before game end.

---

# 39. Trusted operations

Recommended authoritative operations:

```text
startMafiaDeCuba
selectGodfather
prepareCigarBox
viewCigarBox
discardFirstPlayerRoleToken
takeDiamonds
takeRoleToken
chooseStreetUrchinAsLastPlayer
confirmEmptyBoxStreetUrchin
passCigarBox
beginInvestigation
accusePlayer
submitCleanerDecision
resolveAccusation
requestRematch
```

Every operation validates authenticated UID, room membership, game id, phase, seat, current box holder, permissions, available contents, role/action legality, and winner transitions.

Use transactions / atomic trusted writes for secret box changes.

---

# 40. Concurrency requirements

Protect against:

```text
double click
multiple browser tabs
reconnect during action
late Cleaner response
Godfather double accusation
```

Use `stateVersion` and/or `actionId` guards. Make actions idempotent where practical.

---

# 41. Reconnect

If the current player disconnects while holding the box, retain their seat and private turn. Reconnecting as the same UID restores the current private view.

If they already passed, do not restore the historical box snapshot.

During investigation, reconnect restores public state plus only that player's own private role/take.

---

# 42. Multi-tab protection

Server-side validation must ensure the same UID cannot take twice, discard twice, issue duplicate Cleaner decisions, or resolve multiple accusations.

Reading one's own current secret state from another authenticated tab is acceptable; another UID's private state is not.

---

# 43. Main game UI — box phase

Desktop concept:

```text
┌────────────────────────────────────────────────────┐
│ 教父風雲：危情古巴            8 Players            │
├────────────────────────────────────────────────────┤
│                                                    │
│  Tony       Kevin       Amy        Jack            │
│   ●           ●          ●           ●             │
│                                                    │
│              [ 雪 茄 盒 ]                          │
│                                                    │
│     「Kevin 正在查看雪茄盒……」                     │
│                                                    │
│  Mary       Peter       Lisa      👑 Godfather     │
│   ●           ●          ●           ●             │
│                                                    │
├────────────────────────────────────────────────────┤
│  Joker: 🍾 ×1                                      │
└────────────────────────────────────────────────────┘
```

The private box dialog is shown only to the holder.

---

# 44. Mobile UI

Mobile-first is mandatory.

Recommended hierarchy:

```text
Top: phase / current holder
Middle: compact player circle + cigar box
Bottom: my private role panel + context action
```

Before secret content appears:

```text
輪到你了
請確認只有你能看到螢幕
[ 顯示雪茄盒 ]
```

No hover-only interactions.

---

# 45. Investigation UI

Example:

```text
┌────────────────────────────────────┐
│            調查階段                │
│                                    │
│ 教父：Tony                         │
│ 尚有 Joker：1                      │
│                                    │
│ Kevin    未揭露     [指控]          │
│ Amy      忠誠手下                   │
│ Jack     未揭露     [指控]          │
│ Mary     竊賊・已淘汰・4💎          │
│ Peter    未揭露     [指控]          │
│                                    │
│       自由討論 / 說謊 / 推理        │
└────────────────────────────────────┘
```

Only the Godfather sees enabled formal accusation controls.

---

# 46. Accusation UX

Use two-step confirmation:

```text
你確定要指控 Kevin？
錯誤指控可能消耗 Joker，甚至直接讓教父落敗。

[取消] [命令掏出口袋]
```

Run a short suspense animation, but keep it skippable/reduced-motion compatible.

---

# 47. No deduction assistant

Do not automatically tell players that statements conflict, infer who is lying, or calculate likely thieves. The application is the game table, not a detective assistant.

---

# 48. Optional host settings

```ts
interface MafiaDeCubaRoomOptions {
  cleanerEnabled: boolean;
  godfatherSelection: 'HOST_SELECTS' | 'RANDOM';
  showRoleHelp: boolean;
  expertFivePlayerMode: boolean;
}
```

Do not expose arbitrary custom role counts in the first release.

---

# 49. Optional expert 5-player variant

Not required for MVP.

If implemented later:

```text
5 total players
role tokens:
- 1 Loyal Henchman
- 1 Agent
Godfather Jokers:
- 0
```

Mark it clearly as an advanced variant.

---

# 50. Revolución expansion hook

The official `Revolución` expansion adds new secret agendas/roles and a fake diamond. Do **not** guess detailed expansion rules here.

Prepare only extensibility:

```ts
type MafiaExpansion = 'NONE' | 'REVOLUCION';
```

Possible extension points:

```ts
modifySetup(...)
validateBoxTake(...)
resolveAccusation(...)
resolveWinner(...)
```

Create a separate verified expansion spec before implementing it.

---

# 51. Pure engine functions

At minimum:

```ts
getSetupForPlayerCount(...)
buildInitialRolePool(...)
getBoxPassOrder(...)
getRightNeighbor(...)
canGodfatherRemoveDiamonds(...)
prepareBox(...)
canFirstPlayerDiscardRole(...)
discardRoleToken(...)
canTakeDiamonds(...)
takeDiamonds(...)
canTakeRole(...)
takeRole(...)
isBoxEmpty(...)
canChooseStreetUrchin(...)
advanceBoxHolder(...)
getMissingDiamondCount(...)
canAccuse(...)
resolveAccusation(...)
canCleanerInterrupt(...)
resolveCleanerShot(...)
allStolenDiamondsRecovered(...)
getWinningThieves(...)
resolveDrivers(...)
determineWinners(...)
```

React should not reimplement these rules.

---

# 52. Base setup tests

Expected setup:

```text
6 → H1 A1 D1 J0
7 → H2 A1 D1 J0
8 → H3 A1 D1 J1
9 → H4 A1 D1 J1
10 → H4 A2 D1 J1
11 → H4 A2 D2 J2
12 → H5 A2 D2 J2
```

Also test:

```text
15 diamonds initially
Godfather may hide 0
Godfather may hide 5
Godfather may not hide -1
Godfather may not hide 6
Cleaner replaces, not adds to, one Henchman
```

---

# 53. Box-pass tests

At minimum:

- only current holder can act;
- take 1 or all remaining diamonds;
- cannot take 0 as a normal diamond action;
- cannot exceed box diamond count;
- may take exactly one available role token;
- cannot take role + diamonds in same normal take;
- taken token leaves box;
- first player may discard at most one role token;
- hidden discard does not become their role;
- first player must still make normal take;
- non-first player cannot discard;
- empty-box player becomes Street Urchin;
- only final player may voluntarily take nothing;
- final voluntary no-take becomes Street Urchin;
- box returns to Godfather after final player.

---

# 54. Secrecy tests

These are critical. With Firebase emulator/rules where possible, verify:

```text
Player A cannot read Player B private role
Player A cannot read Player B stolen diamond count
Player A cannot read current box while B holds it
Godfather cannot read current box while it is circulating
observer cannot read first-player hidden discard
past holder cannot reread old box snapshot after passing
current holder can recover current snapshot after reconnect
Godfather can read final returned box
```

Do not call the feature complete until these pass.

---

# 55. Investigation tests

At minimum:

- Godfather can accuse eligible unrevealed player;
- non-Godfather cannot accuse;
- caught Thief returns diamonds and is eliminated;
- recovered diamond count updates;
- all stolen diamonds recovered ends with Godfather-side victory;
- false accusation with Joker consumes exactly one;
- innocent remains alive after compensated false accusation;
- false accusation with zero Jokers eliminates Godfather and ends game;
- Agent accusation ends game immediately;
- unaccused second Agent is not a direct winner;
- eliminated Thief cannot win Thief-side ending;
- highest surviving Thief count wins;
- top tie yields multiple Thief winners;
- Street Urchin joins Thief-side victory;
- Driver relationship uses original seat order.

---

# 56. Cleaner tests

When Cleaner is enabled:

- Cleaner replaces one Henchman;
- only Cleaner owner gets private interrupt;
- PASS works;
- POW works before reveal;
- shooting Agent produces Cleaner solo win;
- shooting Thief eliminates both and returns diamonds;
- shooting non-Agent role eliminates both without Joker cost;
- eliminated Cleaner cannot later win with Godfather;
- Cleaner left in box has no owner;
- secretly discarded Cleaner cannot act;
- public timing/state does not leak Cleaner ownership.

---

# 57. Winner tests

Test Godfather victory, Thief victory, Agent solo victory, Cleaner solo victory, Driver chains, tied top Thieves, Street Urchin co-wins, and ineligible eliminated roles.

---

# 58. Error messages

Traditional Chinese examples:

```text
目前不是你的回合
你現在不是雪茄盒持有人
雪茄盒內沒有這麼多鑽石
這個角色已不在雪茄盒內
你必須選擇鑽石或一個角色
只有第一位玩家可以秘密移除角色
只有最後一位玩家可以主動選擇什麼都不拿
目前不是調查階段
只有教父可以正式指控
這名玩家已被揭露，不能再次指控
你的操作已過期，遊戲狀態已更新
```

On stale state: resync, keep player in match, show concise message.

---

# 59. Security requirements

Never trust client-provided role, stolen-diamond count, box contents, hidden discard, winner, Cleaner eligibility, seating relationship, or Joker count.

A malicious client must not be able to inspect another player's secrets, inspect the box out of turn, revisit historical box contents, take twice, fake Street Urchin, fake Cleaner, accuse as non-Godfather, forge returned diamonds, or forge winner state.

---

# 60. Visual direction

Secret theft phase:

```text
closed cigar box
spotlight on current player
dim other seats
subtle diamond glint
```

Investigation phase:

```text
interrogation-room mood
player portraits
Godfather spotlight
red accusation highlight
public role badges
```

Result phase: sequentially reveal Godfather stash, first-player hidden discard, roles/takes, and winner banner. Reveal animation must be skippable.

---

# 61. Accessibility

Required:

- no information only by color;
- text/ARIA labels;
- keyboard-operable dialogs;
- mobile touch targets;
- reduced-motion support;
- readable contrast;
- secret roles always have readable text labels.

---

# 62. In-game role help

Show concise help for the current player's own role only.

Examples:

```text
忠誠手下
幫助教父找回所有失竊鑽石。

竊賊
避免被抓。若教父落敗，仍在場且偷得最多鑽石的竊賊勝利。

司機
你的右手邊玩家獲勝時，你也可能獲勝。
```

Before role selection, show only general rules.

---

# 63. Implementation milestones

## M1 — Game registration / room integration

Add catalog entry, 6–12 validation, route/module, Cleaner option, seat model, placeholder board.

Acceptance:

```text
create room
→ select 教父風雲：危情古巴
→ 6+ players ready
→ choose/random Godfather
→ game screen renders
```

## M2 — Setup engine

Implement setup table, diamonds, role pool, Jokers, Godfather secret 0–5 preparation, server-only box state.

## M3 — Secret cigar-box pass

Implement private box view, take diamonds, take role, first-player hidden discard, Street Urchin rules, pass order, and no historical reread.

Acceptance: only active player sees box contents; after pass the snapshot disappears; next player sees the updated box.

## M4 — Investigation

Implement returned box to Godfather, interrogation phase, accusations, Thief recovery, false accusations/Jokers, Agent ending, and eliminations.

## M5 — Winner engine

Implement Godfather side, surviving top Thief logic, ties, Street Urchin, Driver positional victory, and result reveal.

## M6 — Firebase security / reconnect

Implement private paths, authoritative actions, rules/emulator tests, reconnect while holding box, multi-tab protection, state version/idempotency.

## M7 — Complete responsive UI

Implement cigar box dialog, seat circle, Godfather setup, investigation board, accusation animation, result reveal, mobile UI, loading/error/reconnect.

Acceptance: 6–12 friends can complete a full base game on mixed devices without DB edits.

## M8 — Cleaner advanced role

Implement Cleaner only after base game is stable.

## M9 — Polish / rematch

Rematch, next Godfather selection, optional stats, optional sound/mute, animation/rule-help polish.

---

# 64. Definition of Done — Base Game

Base game is complete when:

- game appears in catalog;
- 6–12 players supported;
- existing auth/room infrastructure reused;
- Godfather can secretly remove 0–5 diamonds;
- box passes in correct order;
- each player sees box only on their turn;
- first-player secret role removal works;
- players can take diamonds or one role;
- empty-box Street Urchin works;
- last-player voluntary Street Urchin works;
- past box snapshots cannot be revisited;
- Godfather receives final box;
- interrogation phase works;
- accusations work;
- Thief recovery works;
- Joker mistakes work;
- Agent win works;
- Loyal Henchman win works;
- Driver win works;
- Street Urchin win works;
- eliminated Thieves cannot win;
- secrets reveal only at game end;
- reconnect works;
- Firebase rules protect secrets;
- mobile UI works;
- tests pass;
- lint passes;
- production build passes.

Cleaner is not required for Base Game DoD if scheduled separately as M8.

---

# 65. Definition of Done — Advanced Base Game

Additionally:

- Cleaner replaces one Loyal Henchman;
- Cleaner interrupt remains secret;
- POW/PASS works;
- Cleaner-vs-Agent resolution works;
- non-Agent shot works;
- no Joker is incorrectly consumed;
- Cleaner security tests pass.

---

# 66. Non-goals for first release

```text
AI bots
public matchmaking
ranked ladder
spectator mode
voice chat
automatic lie detection
testimony transcript
Revolución expansion
arbitrary role distributions
tournament scoring
```

---

# 67. Priority order

```text
secret-information security
>
rule correctness
>
transaction integrity
>
no-information-leak UX
>
reconnect reliability
>
mobile usability
>
visual polish
```

---

# 68. Codex instructions

Before editing:

1. Read this file completely.
2. Inspect the current repository.
3. Inspect existing platform/game registration patterns.
4. Reuse existing Firebase/Auth/room utilities.
5. Preserve every existing game.
6. Do not create another Firebase project.
7. Do not create another standalone React app.

Implement in order:

```text
M1 → M2 → M3 → M4 → M5 → M6 → M7
```

Only after base game is stable:

```text
M8 Cleaner → M9 Polish
```

After every major milestone:

```text
run tests
run lint
run build
inspect git diff
```

Fix failures before proceeding.

If Firebase Console/deployment requires unavailable credentials, complete all repository-side work possible, do not invent credentials, and report the exact manual action required.

Do not stop after scaffolding. Begin implementation.

---

# 69. Rule-source notes for developers

This implementation spec was prepared from publicly available Mafia de Cuba rule references, including the Asmodee Taiwan product description, the published English rulebook/rule summaries, and BoardGameGeek game/rules information.

If implementation details conflict with this specification, treat this file as the digital product contract unless the project owner explicitly requests a rule revision.

For the `Revolución` expansion, do not infer detailed mechanics from marketing descriptions. Create a separate verified spec before implementation.
