# Tech Stack

## Current platform (2026-09-09, V2)

- React / TypeScript / Vite with React Router, Tailwind CSS, Motion, Lucide.
- Firebase Anonymous Authentication, Realtime Database, Hosting.
- Node.js 22 callable Cloud Functions for room authority, private Avalon / Time Bomb Evolution logic, and knowledge-limited AI players.
- npm workspaces: `client`, `functions`; Vitest plus Firebase Emulator and Playwright checks.
- See [V2 implementation status](../IMPLEMENTATION_STATUS.md) and [setup](../README.md).

The original stack below is retained as the Time Bomb prototype's history.

## Frontend
-   **Framework:** React
-   **Language:** TypeScript
-   **Build Tool/Dev Server:** Vite (using rolldown-vite)
-   **Real-time Communication:** Socket.IO Client

## Backend
-   **Runtime:** Node.js
-   **Framework:** Express.js
-   **Real-time Communication:** Socket.IO
