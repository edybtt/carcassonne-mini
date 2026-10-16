# Carcassonne Mini

A simple 2D Carcassonne game that runs right in the browser. Published on GitHub Pages.

- Repo: https://github.com/edybtt/carcassonne-mini
- Site: https://edybtt.github.io/carcassonne-mini/

## Structure

Static site, no build step. External dependencies: the Cinzel font (Google Fonts) and PeerJS 1.5.4 (jsDelivr) for online play.

- `index.html` – page layout (board + side panel + modal).
- `style.css` – styling; below 760px the panel moves to the bottom (phones).
- `game.js` – the whole game in a single IIFE, in sections:
  - **Constants / `TILE_DEFS`** – the 72 tiles of the base set (A–X). `e` = edges N,E,S,W (`C` city, `R` road, `F` field), `f` = features (`city` / `road` / `monastery`) with the sides they touch and `p` for a pennant. `PLAYER_COLORS` has 8 colors (`MAX_PLAYERS` = 8); `isDark(color)` gives dark colors a light outline (meeples, "+N" popups).
  - **Rules** – `fits`, `computeCandidates`, `structureOf` (BFS over a road/city, or a monastery's neighbors), `findCompletions`, `pointsFor`, `winnersOf`.
  - **Game flow** – `newGame` → `startTurn` → click a spot (`doPlace`, phase `meeple`: the tile can still be rotated / moved) → meeple (`doMeeple`, phase `end` while it lands) or "No meeple" → `finishTurn` → … → `endGame`.
  - **Game settings** – `{deck, meeples, time, deckN, meepleN}`: tiles `DECK_SIZES` (Small 36 / Normal 72 / Large 108 / Custom = `deckN`, 10–200), meeples `MEEPLE_COUNTS` (Few 5 / Normal 7 / Many 10 / Custom = `meepleN`, 1–20), time `TURN_TIMES`. `deckTotalFor(s)` / `meeplesFor(s)` resolve the numbers; `deckComposition(total)` scales the base set to any size (largest remainder, start tile always included, every tile type once there are at least 24 tiles; 72 = the exact base set). `DEFAULT_SETTINGS` = the classic settings; `cleanSettings` validates everything coming from localStorage or from the host. Shared UI: `settingsHTML` + `bindSettings` (local game and lobby); typing a custom number calls `onChange(false)` so the dialog is not redrawn and the input keeps focus.
  - **Turn timer** – `turnTime` (seconds, 0 = no limit, default 30); `startTurnTimer` / `onTimeout` (the tile is placed automatically, without a meeple). The host sends the time left to clients in `snapshot()`.
  - **Meeple animation** – `putMeeple` (or a new meeple seen in `applyState`) starts `startMeepleAnim`; `drawFlyingMeeple` brings it in on an arc from the right of the board, with a squash and dust on landing. Scoring happens after `MEEPLE_ANIM_MS`. When a meeple is scored, `applyScore` (or a meeple that disappeared in `applyState`) starts `startLeaveAnim`: `drawLeavingMeeple` makes it crouch, then sends it back on an arc to the right (several leave in a cascade; the final screen waits for `finalDelay()`).
  - **Undo** – in the `meeple` phase, "↶ Undo" / Esc (`undoAction` → `doUndo`) takes the tile back into the hand; online, the `undo` action.
  - **Computer player** – `aiChooseMove` tries every position/rotation/meeple option and picks one with `evaluate` (score + estimated value of occupied structures + meeples left, against the best opponent).
  - **Drawing** – everything on a `<canvas>`, tile coordinates from -0.5 to 0.5 (tiles are centered on integer board coordinates); cities are drawn in a canonical orientation and rotated.
  - **Interface** – panel (compact list with `.many` for 5–8 players; meeple icons capped at 10 + "+N"), log, main menu, local setup (2–8 players), rules, final screen.
  - **Online** – lobbies through PeerJS (WebRTC, no server of our own).

## Online mode

GitHub Pages has no backend, so the browsers connect directly (WebRTC). The public PeerJS server (`0.peerjs.com`) is only used so they can find each other by code.

- The host creates the peer `carcmini-<CODE>` (5-character code); the others join with the code or the link `?lobby=CODE`. Up to 8 seats (people + computers).
- There is no public lobby list – that would need a backend (e.g. Firebase).
- **The host is authoritative**: it holds the deck, applies the rules, runs the computer players and, after every `updateUI()`, sends the full state (`snapshot()`) plus the events (`emit` → log, "+N", flashes, toasts).
- Clients rebuild the state in `applyState()` and only send intents: `place` (place or move the tile) / `rotate` / `undo` / `meeple` / `skip`; the host validates them in `onRemoteAction()`.
- The host picks the settings (tiles, meeples, time) in the lobby (`net.settings`); clients see them in the lobby and in the log. `refreshHostLobby(redraw)` sends seats + settings to everyone.
- `players[i].owner` says who controls the player (`'local'`, `'host'` or the client's peer id); `isMine(i)` compares it with `net.myId`.
- If a client leaves during a game, the computer takes over their seat. If the host leaves, clients get a message and go back to the menu.
- Data from the other side is treated as untrusted: text goes through `esc`, colors through `safeColor`, settings through `cleanSettings`.

## Conventions

- Sides are indexed 0 = N, 1 = E, 2 = S, 3 = W; `rot` is in clockwise 90° steps. Original side `o` ends up at `(o + rot) % 4`.
- Everything is in English: UI text, code, comments and docs.
- Simplified rules: no farmers (fields are not scored). Completed cities score 2 points per tile regardless of size.
- Saved in localStorage (prefix `carcassonne-mini-`): `playerName`, `setup` (local players), `settings`.

## Running locally

Open `index.html` directly in a browser or serve the folder with any static server. To test online play on one computer, open two tabs: one creates the lobby, the other joins with the code.

In the console, `window.__carcassonne` exposes the state (`board`, `players`, `phase`, `net`, `candidates`, `spots`, `placed`, `leaving`, `cam`), `clickWorld(x, y)` for tests and `deckComposition(total)`.

## Publishing

Every push to `main` updates the site (GitHub Pages serves the root of the `main` branch).
