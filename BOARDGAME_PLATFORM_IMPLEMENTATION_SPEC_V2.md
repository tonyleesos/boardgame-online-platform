# Boardgame Online Platform --- Implementation Spec

> Target repository: `tonyleesos/boardgame-online-platform`
>
> Purpose: This document is an **implementation instruction for a coding
> agent working directly in VS Code**.\
> Do not merely explain what should be done. Inspect the existing
> repository, implement the changes, run the project, fix
> build/lint/runtime errors, and leave the repository in a runnable
> state.

------------------------------------------------------------------------

## 0. Primary instruction to the coding agent

Continue development **inside the existing repository**. Do not create a
separate replacement project.

Before changing code:

1.  Inspect the entire repository and current branch.
2.  Read the existing `client/`, `server/`, `conductor/`, `.gitignore`,
    package files, and existing game logic.
3.  Preserve useful existing work and assets.
4.  Do not delete the existing Time Bomb implementation or rulebook
    merely because Avalon is being added.
5.  Make incremental, reviewable changes.
6.  Never commit secrets, Firebase service-account files, `.env`
    contents, generated build output, or `node_modules`.
7.  After each meaningful milestone, run relevant build/lint/tests and
    fix errors before proceeding.
8.  Prefer maintainable architecture over putting new logic into
    `App.tsx`.
9.  If an implementation detail in this spec conflicts with the actual
    current repository, adapt intelligently while preserving the product
    requirements.
10. Do not stop after scaffolding. The requested milestone is a
    **working multiplayer platform foundation plus a playable Avalon
    MVP**.

------------------------------------------------------------------------

# 1. Product goal

Build a mobile-friendly web platform where friends can remotely play
social deduction / party board games.

Initial games:

-   **Avalon** --- primary implementation target.
-   **Time Bomb Evolution** --- preserve existing work and make the
    architecture capable of supporting it later.

The application should feel like a game rather than an admin website:

-   responsive on phones;
-   fast transitions;
-   animated cards/modals/player changes;
-   clear game phases;
-   visually strong role reveal;
-   obvious feedback after votes and missions;
-   no page refresh required during normal gameplay.

The platform architecture must support adding more games later without
rewriting the lobby/room infrastructure.

------------------------------------------------------------------------

# 2. Existing project direction

Continue using the current frontend technology:

-   React
-   TypeScript
-   Vite

Replace the current multiplayer dependency on a locally hosted Socket.IO
server with Firebase for the MVP.

Target stack:

``` text
Frontend
├ React
├ TypeScript
├ Vite
├ React Router
├ Tailwind CSS
├ Motion / Framer Motion
└ Lucide React

Backend / realtime platform
├ Firebase Authentication — anonymous auth
├ Firebase Realtime Database
├ Firebase Hosting
└ Firebase Cloud Functions — only when server-authoritative/private logic is needed
```

The existing Express/Socket.IO server is **legacy/reference code for
now**.

Do not immediately delete `server/`. Remove the frontend's runtime
dependency on `http://localhost:3001`, but preserve old server/game
logic until the new implementation is stable.


------------------------------------------------------------------------

# 2.1 Current Firebase setup status (IMPORTANT — do not redo completed work)

The Firebase project has already been created manually in Firebase
Console.

Current known state:

```text
Firebase project
├ Project ID: boardgame-online-platform
├ Web application: already registered
├ Web SDK registration: completed
├ Package-manager choice: npm
├ Firebase Web config: already obtained by the project owner
├ Realtime Database: NOT created yet / databaseURL not available yet
├ Authentication Anonymous provider: NOT confirmed enabled yet
├ Firebase Hosting: NOT configured yet
└ Cloud Functions: NOT configured yet
```

Known non-secret Web App metadata:

```text
authDomain: boardgame-online-platform.firebaseapp.com
projectId: boardgame-online-platform
storageBucket: boardgame-online-platform.firebasestorage.app
messagingSenderId: 769265872941
appId: 1:769265872941:web:02f295d845103fbd5a48a4
measurementId: G-ENLHJNH4H4
```

The project owner has the generated Firebase Web `apiKey` locally. Do
not invent a different Firebase project and do not create a second Web
App unless explicitly requested.

Important configuration guidance:

- Firebase Web App configuration values are client-side identifiers, not
  server credentials or service-account secrets.
- Access control must rely on Firebase Authentication and Security Rules,
  not on hiding the Firebase Web API key.
- Nevertheless, keep the actual local `.env` file out of Git to avoid
  configuration drift and accidental inclusion of unrelated secrets in
  the future.
- Never place service-account JSON, Admin SDK private keys, OAuth client
  secrets, or server-only credentials in the React/Vite client.
- Do not add Analytics unless it becomes a product requirement. The
  generated Firebase setup snippet includes `getAnalytics`, but this MVP
  does not need Firebase Analytics.

### Expected local environment variables

Create and commit:

```text
client/.env.example
```

with:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=boardgame-online-platform.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=boardgame-online-platform
VITE_FIREBASE_STORAGE_BUCKET=boardgame-online-platform.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=769265872941
VITE_FIREBASE_APP_ID=1:769265872941:web:02f295d845103fbd5a48a4
```

Do NOT put the real API key into `.env.example`.

Use a local ignored file such as:

```text
client/.env.local
```

for the owner's actual values.

`VITE_FIREBASE_DATABASE_URL` is intentionally blank until Realtime
Database is created in Firebase Console.

The implementation must work gracefully when configuration is
incomplete. If `databaseURL` is missing, show a useful development error
rather than crashing obscurely.

### Remaining manual Firebase Console steps

These are still expected to be performed by the project owner. The
coding agent should prepare the repository/configuration for them, but
must not fabricate completion:

1. Create **Realtime Database**.
2. Prefer an Asia-region database location appropriate for users in
   Taiwan, subject to the options actually offered by Firebase Console.
3. Start with locked/restricted security rather than a permanently open
   test database.
4. Enable **Authentication → Anonymous** sign-in provider.
5. Copy the resulting Realtime Database URL into
   `VITE_FIREBASE_DATABASE_URL`.
6. Later configure Firebase Hosting.
7. Configure Cloud Functions only when the server-authoritative Avalon
   operations are implemented and the required Firebase billing/deploy
   conditions have been reviewed.

If Firebase CLI is available, the coding agent may prepare
`firebase.json`, database rules, indexes/config, Hosting configuration,
and Functions source. It must clearly distinguish between repository
work completed locally and Firebase Console/deployment steps still
requiring the project owner.

------------------------------------------------------------------------

# 3. Architecture requirements

Refactor the frontend away from a single large `App.tsx`.

Recommended structure:

``` text
client/src/
├ app/
│  ├ App.tsx
│  └ router.tsx
├ pages/
│  ├ HomePage.tsx
│  ├ GameSelectPage.tsx
│  ├ CreateRoomPage.tsx
│  ├ JoinRoomPage.tsx
│  ├ RoomPage.tsx
│  ├ AvalonGamePage.tsx
│  └ ResultPage.tsx
├ components/
│  ├ ui/
│  ├ GameCard/
│  ├ PlayerAvatar/
│  ├ RoomCode/
│  ├ PlayerList/
│  └ ConnectionStatus/
├ games/
│  ├ avalon/
│  │  ├ components/
│  │  ├ engine/
│  │  ├ constants.ts
│  │  ├ types.ts
│  │  └ rules.ts
│  └ timebomb/
├ firebase/
│  ├ config.ts
│  ├ auth.ts
│  ├ rooms.ts
│  └ game.ts
├ hooks/
│  ├ useAuth.ts
│  ├ useRoom.ts
│  └ useGame.ts
├ types/
├ utils/
└ assets/
```

This structure is a guideline, not a requirement to create empty files.
Create only files that have a real responsibility.

### Separation rules

**Platform layer owns:**

-   authentication;
-   nickname;
-   game catalog;
-   create/join/leave room;
-   room code;
-   host;
-   player presence/status;
-   ready state;
-   starting a selected game;
-   reconnect/reload behavior.

**Game module owns:**

-   player-count rules;
-   role configuration;
-   role assignment;
-   phase/state machine;
-   team selection;
-   votes;
-   missions;
-   victory calculation;
-   role-specific UI.

Do not put Avalon rules into generic room components.

------------------------------------------------------------------------

# 4. Configuration and Firebase

Use Vite environment variables.

The Firebase project and Web App already exist; see **Section 2.1**.
Do not create a second Firebase project as part of implementation.

Create an example file such as:

``` text
client/.env.example
```

using the known project metadata and leaving environment-specific values
blank where appropriate:

``` env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=boardgame-online-platform.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=boardgame-online-platform
VITE_FIREBASE_STORAGE_BUCKET=boardgame-online-platform.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=769265872941
VITE_FIREBASE_APP_ID=1:769265872941:web:02f295d845103fbd5a48a4
```

Ensure real `.env` files are ignored by Git.

Firebase initialization must fail gracefully with a useful development
error if configuration is missing.

Use **Anonymous Authentication** for the initial version. A player
should not need registration/email/password.

After anonymous authentication, associate:

``` ts
type Player = {
  uid: string;
  nickname: string;
  joinedAt: number;
  ready: boolean;
};
```

Do not use nickname as the database identity. `uid` is the identity.

------------------------------------------------------------------------

# 5. Game catalog

Create a reusable game definition model.

Example:

``` ts
export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  enabled: boolean;
  coverImage?: string;
}
```

Initial catalog should contain:

``` text
Avalon
Time Bomb Evolution
```

Avalon should be enabled.

Time Bomb may be displayed as "Coming Soon" until migrated.

Do not hardcode the entire application flow around Avalon.

------------------------------------------------------------------------

# 6. Navigation / user flow

Target flow:

``` text
Open website
   ↓
Anonymous Firebase sign-in
   ↓
Enter nickname
   ↓
Game selection
   ↓
Select Avalon
   ↓
Create room OR join room
   ↓
Waiting room
   ↓
Players join in realtime
   ↓
Ready
   ↓
Host starts
   ↓
Role reveal
   ↓
Avalon gameplay
   ↓
Game result
   ↓
Play again / return to game selection
```

Nickname may be cached locally for convenience.

A refresh should not unnecessarily generate a new player identity while
Firebase auth remains valid.

------------------------------------------------------------------------

# 7. Room requirements

Generate easy-to-share room codes, for example six uppercase
alphanumeric characters.

Example:

``` text
A7K3QX
```

Avoid ambiguous characters if practical (`0/O`, `1/I`).

Room model should conceptually support:

``` ts
interface Room {
  code: string;
  gameId: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  players: Record<string, Player>;
}
```

Required behavior:

-   Create room.
-   Join existing room by code.
-   Reject nonexistent room.
-   Reject joining after game start unless reconnecting as an existing
    participant.
-   Enforce max player count.
-   Show realtime player list.
-   Host badge.
-   Ready/unready state.
-   Only host can start.
-   Start button disabled until minimum player count and readiness
    requirements are satisfied.
-   Copy room code button.
-   Leave room.
-   Handle host leaving: transfer host to another current player or
    close the room. Choose one deterministic policy and document it.
-   Handle refresh/reconnection sensibly.
-   Avoid duplicate player entries for the same Firebase uid.
-   Display useful errors instead of failing silently.

Presence/disconnection behavior does not need to be perfect for the
first commit, but stale players must not make rooms permanently
unusable.

------------------------------------------------------------------------

# 8. Firebase data design

A reasonable conceptual model:

``` text
rooms/
  {roomCode}/
    gameId
    hostId
    status
    createdAt

    players/
      {uid}/
        nickname
        ready
        joinedAt
        connected

    game/
      phase
      round
      leaderId
      selectedPlayers
      proposalAttempt
      missionResults
      publicState...
```

Sensitive/private data must **not** be stored in publicly readable room
state.

Conceptually:

``` text
privateGameData/
  {roomCode}/
    {uid}/
      role
      knowledge
```

Important security rule:

> A player must not be able to read another player's hidden role simply
> by inspecting Firebase network traffic or the browser devtools.

If Realtime Database security rules alone cannot safely deliver
role-specific private data with the chosen structure, implement the
sensitive operations with callable/HTTP Cloud Functions or another
server-authoritative Firebase mechanism.

Do **not** solve secrecy by merely hiding role information in React.

------------------------------------------------------------------------

# 9. Firebase security rules

Provide database rules as part of the repository.

Minimum goals:

-   unauthenticated users cannot access rooms;
-   authenticated users can access appropriate room data;
-   players cannot arbitrarily overwrite host/game state;
-   one user cannot write another user's private role data;
-   private role data is readable only by the corresponding
    authenticated uid;
-   only authorized operations can start/advance a game.

For game-critical state, prefer server-authoritative writes where
client-side rules become too complex.

Document any security limitation that remains in the MVP.

------------------------------------------------------------------------

# 10. Avalon MVP rules

Implement standard **The Resistance: Avalon** gameplay for **5--10
players**.

For the first playable MVP, support these roles:

Good: - Merlin - Percival - Loyal Servant of Arthur

Evil: - Assassin - Morgana - Minion of Mordred

Optional roles such as Mordred and Oberon can be added later unless
already easy to support through configuration.

Role counts must be configuration-driven rather than scattered through
UI code.

Use the standard good/evil team counts:

    Players   Good   Evil
  --------- ------ ------
          5      3      2
          6      4      2
          7      4      3
          8      5      3
          9      6      3
         10      6      4

Mission team sizes:

    Players   M1   M2   M3   M4   M5
  --------- ---- ---- ---- ---- ----
          5    2    3    2    3    3
          6    2    3    4    3    4
          7    2    3    3    4    4
          8    3    4    4    5    5
          9    3    4    4    5    5
         10    3    4    4    5    5

For **7+ players, mission 4 requires two Fail cards to fail**.

Five consecutive rejected team proposals cause the evil side to win
according to the standard rules.

Good wins three successful missions **unless Assassin correctly
identifies Merlin** during the assassination phase.

Evil wins if:

-   three missions fail;
-   five consecutive team proposals are rejected;
-   or Assassin correctly assassinates Merlin after Good achieves three
    successful missions.

------------------------------------------------------------------------

# 11. Avalon role knowledge

Implement role information correctly.

At minimum:

-   Merlin knows the evil players represented by the supported base evil
    roles.
-   Percival sees Merlin and Morgana as possible Merlin candidates
    without knowing which is which.
-   Evil players know their evil teammates for the supported base roles.
-   Loyal Servants receive no special knowledge.
-   Assassin has the final Merlin assassination action when Good
    completes three successful missions.

If Mordred/Oberon are later enabled, their special visibility rules must
be implemented explicitly.

------------------------------------------------------------------------

# 12. Avalon state machine

Do not implement gameplay as loosely connected booleans.

Use an explicit phase model, for example:

``` ts
export type AvalonPhase =
  | 'WAITING'
  | 'ROLE_REVEAL'
  | 'TEAM_SELECTION'
  | 'TEAM_VOTE'
  | 'MISSION_VOTE'
  | 'MISSION_RESULT'
  | 'ASSASSINATION'
  | 'GAME_OVER';
```

Recommended public game state:

``` ts
interface AvalonPublicState {
  phase: AvalonPhase;
  round: number;
  leaderId: string;
  selectedPlayerIds: string[];
  proposalAttempt: number;
  teamVotes?: Record<string, 'approve' | 'reject'>;
  missionResults: Array<'success' | 'fail'>;
  winner?: 'good' | 'evil';
  winReason?: string;
}
```

Do not expose mission votes while voting is in progress if doing so
would leak information.

Advance phases only when all required actions are complete.

Use Firebase transactions / atomic updates where race conditions are
possible.

------------------------------------------------------------------------

# 13. Avalon gameplay flow

## Role reveal

After host starts:

1.  Validate player count.
2.  Generate role assignment.
3.  Persist private roles securely.
4.  Select initial leader.
5.  Each client receives only its own role/knowledge.
6.  Show a role reveal card with animation.
7.  Player confirms "I understand my role".
8.  When all players are ready, proceed.

## Team selection

-   Current leader selects exactly the required number of players.
-   Other players can see the proposed team.
-   Only leader can submit the team.
-   Validate selected count.

## Team vote

Every player votes:

``` text
Approve / Reject
```

Requirements:

-   one vote per player;
-   player can change vote until submitted only if implementation
    intentionally supports it;
-   do not reveal individual votes before everyone submits;
-   after completion show the vote result;
-   accepted if approvals are strictly greater than half;
-   rejected proposal increments rejection/proposal count and rotates
    leader;
-   fifth consecutive rejection causes evil victory.

## Mission vote

Only selected mission members vote.

Good players may submit only:

``` text
Success
```

Evil players may submit:

``` text
Success
Fail
```

Votes must be anonymous in the result. Never reveal which player
submitted Fail.

Determine mission success/failure using standard rules, including the
two-fail requirement for mission 4 with 7+ players.

After mission resolution:

-   append result;
-   reset proposal rejection count;
-   rotate leader;
-   check victory;
-   otherwise proceed to next mission/team selection.

## Assassination

If Good reaches three successful missions:

-   transition to `ASSASSINATION`;
-   Assassin chooses one player as Merlin;
-   if correct: Evil wins;
-   otherwise: Good wins.

## Game over

Show:

-   winning faction;
-   reason;
-   actual player roles;
-   mission history;
-   buttons for rematch / return to lobby or game selection.

A rematch should create/reset state safely without mixing previous-game
private data.

------------------------------------------------------------------------

# 14. Server-authoritative game operations

Security matters because Avalon relies on hidden information.

The following operations should **not** be trusted solely to arbitrary
browser writes:

-   generating/shuffling roles;
-   assigning private roles;
-   starting the game;
-   resolving votes;
-   resolving missions;
-   advancing phases;
-   determining winner;
-   assassination resolution.

Preferred implementation:

``` text
React client
   ↓ action request
Firebase Cloud Function
   ↓ validates user + room + phase
Realtime Database transaction/update
   ↓
all clients receive updated state
```

For the earliest platform milestone, create/join/ready may be
client-driven with security rules. For Avalon game-critical actions,
server authority is strongly preferred.

Never send all roles to every client and then rely on the UI to hide
them.

------------------------------------------------------------------------

# 15. UI/UX direction

Visual direction:

-   dark fantasy / medieval table-game atmosphere;
-   clean enough for mobile;
-   large touch targets;
-   readable Traditional Chinese UI;
-   subtle gradients, glow, glass/card effects;
-   avoid excessive animation that delays gameplay.

Suggested primary language: **Traditional Chinese**.

Example labels:

``` text
建立房間
加入房間
準備
取消準備
開始遊戲
你的身份
確認身份
選擇任務成員
贊成
反對
任務成功
任務失敗
刺殺梅林
再玩一局
```

Use Motion for:

-   page transitions;
-   modal enter/exit;
-   player join/leave;
-   ready state;
-   role card reveal;
-   vote result;
-   mission result;
-   winner screen.

Respect `prefers-reduced-motion`.

Use Lucide icons instead of emoji as functional UI icons when suitable.

Do not block functionality waiting for perfect artwork. Use tasteful
placeholders/assets first.

------------------------------------------------------------------------

# 16. Responsive requirements

Primary target: mobile browser.

Test at minimum around:

``` text
360px
390px
430px
768px
desktop
```

No horizontal scrolling during normal gameplay.

Critical buttons must remain reachable without tiny tap targets.

Room code should be easy to copy/share.

Player selection must remain usable with 10 players.

------------------------------------------------------------------------

# 17. Error/loading states

Implement visible states for:

-   Firebase initializing;
-   authentication failure;
-   missing Firebase config;
-   creating room;
-   joining room;
-   invalid room code;
-   room full;
-   game already started;
-   network/realtime disconnect;
-   unauthorized action;
-   host-only action;
-   invalid game phase;
-   unexpected backend error.

Avoid raw unhandled promise rejections.

------------------------------------------------------------------------

# 18. Code quality

Use strict TypeScript where practical.

Avoid `any` unless genuinely necessary.

Prefer:

-   discriminated unions;
-   typed Firebase models;
-   pure rule/engine functions;
-   small reusable components;
-   hooks for subscriptions;
-   centralized constants;
-   explicit validation.

Game-rule functions should be testable without React/Firebase.

Example pure functions:

``` ts
getTeamCounts(playerCount)
getMissionTeamSize(playerCount, missionIndex)
requiresTwoFails(playerCount, missionIndex)
calculateTeamVote(...)
calculateMissionResult(...)
getWinner(...)
```

------------------------------------------------------------------------

# 19. Tests

Add automated tests for Avalon rule logic.

At minimum cover:

-   5--10 player team counts;
-   mission team sizes;
-   mission 4 two-fail rule for 7+ players;
-   majority team approval;
-   rejected proposal counter;
-   five rejected teams -\> evil win;
-   three failed missions -\> evil win;
-   three successful missions -\> assassination phase;
-   correct assassination -\> evil;
-   incorrect assassination -\> good;
-   good player cannot submit Fail;
-   invalid team size rejected.

Use a lightweight test runner appropriate to the Vite/TypeScript project
(e.g. Vitest).

------------------------------------------------------------------------

# 20. Repository cleanup

Inspect Git tracking.

`node_modules` and build output must not be committed.

Ensure root/client/server ignore rules cover at least:

``` gitignore
node_modules/
dist/
.env
.env.*
!.env.example
.firebase/
firebase-debug.log
```

If `node_modules` is already tracked, remove it from Git tracking
without deleting the developer's required local install unnecessarily.

Do not make destructive history rewrites.

------------------------------------------------------------------------

# 21. Scripts / developer experience

Provide convenient scripts.

Desired outcome from repository root, if practical:

``` bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

If the monorepo structure makes root orchestration unnecessarily
disruptive, document the exact commands instead.

The final README must explain:

1.  prerequisites;
2.  installation;
3.  Firebase project setup;
4.  environment variables;
5.  enabling Anonymous Authentication;
6.  creating Realtime Database;
7.  deploying database rules;
8.  local development;
9.  build;
10. tests;
11. Firebase Hosting deployment;
12. Cloud Functions deployment if used.

------------------------------------------------------------------------

# 22. Implementation milestones

Implement in this order.

## Milestone 1 --- repository cleanup/refactor

-   Inspect current project.
-   Fix Git ignore/tracked dependency issues.
-   Refactor `App.tsx`.
-   Add routing.
-   Add Tailwind.
-   Add Motion.
-   Add reusable UI foundation.
-   Preserve Time Bomb files/work.

**Acceptance:** frontend builds and old prototype is no longer a
monolithic `App.tsx`.

## Milestone 2 --- Firebase platform foundation

-   Firebase configuration.
-   Anonymous auth.
-   nickname flow.
-   game catalog.
-   create room.
-   join room.
-   realtime player list.
-   host.
-   ready state.
-   leave/reconnect behavior.

**Acceptance test:**

Open two browser sessions.

``` text
Browser A: Tony creates room ABC123
Browser B: Kevin joins ABC123
Browser A immediately displays Kevin
Browser B immediately displays Tony
Ready states synchronize in realtime
Only host can start
```

## Milestone 3 --- Avalon engine

-   typed state machine;
-   player count config;
-   mission config;
-   roles;
-   role knowledge;
-   pure rule functions;
-   tests.

**Acceptance:** rule tests pass independently from UI.

## Milestone 4 --- secure game start / private roles

-   server-authoritative role shuffle;
-   private per-user role data;
-   role reveal;
-   no cross-player role leakage.

**Acceptance:** inspecting a normal player's browser/network access must
not expose every player's role.

## Milestone 5 --- playable Avalon

Implement:

``` text
role reveal
→ team selection
→ team vote
→ mission vote
→ mission result
→ next leader/mission
→ victory checks
→ assassination
→ result
```

**Acceptance:** 5+ browser sessions can complete an entire game without
manual database edits.

## Milestone 6 --- polish

-   animations;
-   responsive fixes;
-   reconnect handling;
-   error states;
-   loading states;
-   final README;
-   Firebase deployment configuration.

------------------------------------------------------------------------

# 23. Definition of Done

Do not report the task as complete merely because files were created.

The implementation is considered complete for this spec when:

-   existing repo is reused;
-   React/TypeScript/Vite remain the frontend;
-   frontend no longer requires local Socket.IO server;
-   Firebase anonymous authentication works;
-   rooms work realtime across multiple browser sessions;
-   Avalon supports 5--10 players;
-   private roles are protected from other clients;
-   standard mission/team voting works;
-   standard Avalon victory flow works;
-   Assassin/Merlin endgame works;
-   game logic has automated tests;
-   mobile layout is usable;
-   production build succeeds;
-   lint succeeds or remaining warnings are documented;
-   tests succeed;
-   README contains complete setup/deployment instructions;
-   no secrets or `node_modules` are committed.

------------------------------------------------------------------------

# 24. Non-goals for the first complete version

Do not delay the MVP for:

-   user account registration;
-   social login;
-   persistent player statistics;
-   ranking/ELO;
-   public matchmaking;
-   spectators;
-   voice/video chat;
-   text chat;
-   AI players;
-   monetization;
-   native Android/iOS app;
-   Unity/Cocos migration;
-   full Time Bomb migration;
-   every optional Avalon role.

Architect so these can be added later, but do not implement them unless
they are trivial and do not delay the required scope.

------------------------------------------------------------------------

# 25. Final instruction to the coding agent

Start by inspecting the repository rather than blindly replacing it.

Then execute the milestones sequentially.

When making architectural decisions, prioritize:

``` text
correct hidden-information security
> correct game rules
> realtime reliability
> maintainability
> UI polish
```

Do not ask for confirmation for routine implementation decisions. Make
reasonable choices, implement them, and document them.

If Firebase credentials/configuration are unavailable locally, still
implement everything possible, provide `.env.example`, Firebase
rules/configuration, tests, and clear setup instructions. Do not invent
credentials.

The Firebase project itself already exists. Missing `databaseURL`,
Anonymous Authentication enablement, Hosting initialization, or
Functions deployment are **manual setup/deployment prerequisites**, not
reasons to replace Firebase or create another project.

At the end:

1.  run build;
2.  run lint;
3.  run tests;
4.  review `git diff`;
5.  verify no secrets/dependencies/build artifacts were accidentally
    added;
6.  summarize changed files and architecture;
7.  state any remaining manual Firebase Console steps;
8.  state any known limitations.

**Begin implementation now.**
