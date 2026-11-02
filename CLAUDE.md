# Buzzline

Multiplayer quiz game. npm workspaces: shared/ (types), server/ (Express + ws), web/ (Vite + React).
web/src/host/ is the host's screen, web/src/player/ is the player's screen, and web/src/lib/ is used by both.

## Commands
- `npm install`: run this first in every fresh worktree
- `npm run check`: typecheck and tests. Must pass before you finish
- `npm run dev`: server on :4000, web on :5173

## Rules
- docs/CONTRACT.md is the source of truth for messages and game rules. Never change it unless the task says so
- Types live in shared/src/index.ts. Never redefine them in server/ or web/
- Game logic takes an injected clock, so tests never wait for real time
- Tests never bind a fixed port
- Commit to your current branch when done. Merge into main only when the task says so