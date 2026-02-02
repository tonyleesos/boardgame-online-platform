# Specification: Implement Core Game Logic for 'TIME BOMB EVOLUTION'

## Overview
This track focuses on developing the fundamental game mechanics and logic required to play "TIME BOMB EVOLUTION" on the online platform. This includes player roles, card distribution, game phases, scoring, and win/loss conditions. The goal is to establish a functional backend game engine that can facilitate a complete game session.

## Features
-   **Player Management:**
    -   Assign roles (e.g., Agents, Master Spy, Bomb Carrier, etc.) to players.
    -   Track player status (active, eliminated, role revealed).
-   **Card Distribution:**
    -   Handle the dealing of vision cards (Success, Fail) based on player count and roles.
    -   Ensure correct distribution of bomb cards.
-   **Game Phases:**
    -   Implement distinct game phases: Role Assignment, Vision Card Distribution, Round Start, Bomb/Defuse Selection, Round End, Game End.
    -   Manage turn order and phase transitions.
-   **Bomb/Defuse Mechanics:**
    -   Allow players to choose to "pass" or "defuse" the bomb.
    -   Determine the outcome of bomb/defuse attempts.
-   **Scoring & Win Conditions:**
    -   Implement scoring rules for both sides (Agents and Master Spy).
    -   Define win conditions for Agents (defuse all bombs) and Master Spy (bombs explode).
-   **Game State Management:**
    -   Maintain and update the current game state (e.g., active player, current round, bomb status).
    -   Validate player actions based on the current game state.

## Non-Functional Requirements
-   **Performance:** Game logic should be efficient to ensure real-time responsiveness.
-   **Reliability:** The game state should be consistent and resilient to unexpected events.
-   **Security:** Prevent cheating or unauthorized manipulation of game state.

## Out of Scope for this Track
-   User Interface (UI) development for the game.
-   Multiplayer lobby and matchmaking.
-   Persistent game state storage (e.g., saving game history).
-   Advanced AI for bots.
