# Specification: Full Platform Flow Implementation

## Overview
This track implements the full user flow for the board game online platform, from character creation to gameplay in "TIME BOMB EVOLUTION". The user interface will be in Traditional Chinese.

## Functional Requirements

### 1. Character Creation
-   Users must be able to enter a nickname.
-   Users must be able to select an avatar from a pre-selected set of 10-15 generic avatars.

### 2. Platform Lobby
-   A list of currently active game rooms will be displayed, showing player counts.
-   A global chat window will be available for all players in the lobby.
-   A "Create Room" button will allow users to create a new game room.

### 3. Game Selection Menu
-   The menu will be presented as a grid of game posters with game titles.
-   Users can select "TIME BOMB EVOLUTION" to proceed to a game room.

### 4. Game Room ("TIME BOMB EVOLUTION")
-   **Game Logic (Backend):**
    -   The room will support 4-6 players.
    -   Implement card dealing logic for vision cards (Success, Fail) and bomb cards based on player count.
    -   Implement faction assignment logic (好人 (Good) vs. 壞人 (Bad)) based on player count and game rules.
    -   Implement the "bomb defusal" logic to determine the outcome of a round.
-   **Game State Display (Frontend):**
    -   Game state changes will be displayed visually through card animations.
    -   Player status (e.g., role, bomb carrier) will be shown with visual indicators on a game board representation.

## Non-Functional Requirements
-   All UI text and prompt messages will be in Traditional Chinese.

## Out of Scope for this Track
-   User account registration and login (character creation is session-based).
-   Support for games other than "TIME BOMB EVOLUTION".
-   AI players (bots).
-   Persistent storage of game history or user profiles.
