# Implementation Plan: Implement Core Game Logic for 'TIME BOMB EVOLUTION'

This plan outlines the steps to implement the core game logic for "TIME BOMB EVOLUTION".

## Phase 1: Basic Game Setup and Role Assignment
- [ ] Task: Design Game State Data Structure
    - [ ] Write Tests: Define tests for initial game state creation and manipulation.
    - [ ] Implement Feature: Create data structures to represent game state (players, roles, cards, rounds, etc.).
- [ ] Task: Implement Player Management
    - [ ] Write Tests: Create tests for adding players and assigning unique IDs.
    - [ ] Implement Feature: Develop functions to add/remove players from the game.
- [ ] Task: Implement Role Assignment
    - [ ] Write Tests: Write tests to ensure correct number of Agents, Master Spy, and other roles are assigned based on player count.
    - [ ] Implement Feature: Develop logic to randomly assign roles to players.
- [ ] Task: Conductor - User Manual Verification 'Basic Game Setup and Role Assignment' (Protocol in workflow.md)

## Phase 2: Card Distribution and Round Mechanics
- [ ] Task: Implement Vision Card Distribution
    - [ ] Write Tests: Create tests for distributing Success and Fail cards to players according to game rules.
    - [ ] Implement Feature: Develop logic for random and fair distribution of vision cards.
- [ ] Task: Implement Bomb Card Distribution
    - [ ] Write Tests: Write tests to ensure the correct number of bomb cards are distributed.
    - [ ] Implement Feature: Develop logic for distributing bomb cards.
- [ ] Task: Implement Round Initialization
    - [ ] Write Tests: Write tests for starting a new round, including resetting relevant round-specific states.
    - [ ] Implement Feature: Develop functions to initialize a new round of the game.
- [ ] Task: Conductor - User Manual Verification 'Card Distribution and Round Mechanics' (Protocol in workflow.md)

## Phase 3: Bomb/Defuse Actions and Game Progression
- [ ] Task: Implement Player Action (Pass/Defuse)
    - [ ] Write Tests: Create tests for validating player choices (pass/defuse) and their impact on game state.
    - [ ] Implement Feature: Develop logic for handling player's bomb pass or defuse actions.
- [ ] Task: Implement Round End Logic
    - [ ] Write Tests: Write tests for determining if a round has ended and processing its outcome.
    - [ ] Implement Feature: Develop logic to check round completion conditions and update game state accordingly.
- [ ] Task: Conductor - User Manual Verification 'Bomb/Defuse Actions and Game Progression' (Protocol in workflow.md)

## Phase 4: Win Conditions and Game End
- [ ] Task: Implement Agent Win Condition
    - [ ] Write Tests: Write tests for detecting when Agents win (all bombs defused).
    - [ ] Implement Feature: Develop logic to check for Agent win conditions.
- [ ] Task: Implement Master Spy Win Condition
    - [ ] Write Tests: Write tests for detecting when the Master Spy wins (bombs explode).
    - [ ] Implement Feature: Develop logic to check for Master Spy win conditions.
- [ ] Task: Implement Game End Processing
    - [ ] Write Tests: Write tests for finalizing the game, declaring winner, and resetting for a new game.
    - [ ] Implement Feature: Develop functions to conclude a game session.
- [ ] Task: Conductor - User Manual Verification 'Win Conditions and Game End' (Protocol in workflow.md)
