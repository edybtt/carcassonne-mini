# 🏰 Carcassonne Mini

A simple 2D Carcassonne game that runs right in your browser – on a computer or a phone.

**▶ Play here: https://edybtt.github.io/carcassonne-mini/**

## Features

- 2–8 players, each either a human (on the same device) or the computer, with 8 distinct player colors.
- **Online lobby:** create a lobby, send the code or the link to your friends, they join from their own phone or computer and you play together (you can add computer players too).
- All 72 tiles of the base set: roads, cities (with pennants) and monasteries.
- Meeples on roads, cities and monasteries, with automatic scoring.
- Settings for local games and in the online lobby:
  - tiles: **Small** (36) · **Normal** (72) · **Large** (108) · **Custom** (any number from 10 to 10,000)
  - meeples per player: **Few** (5) · **Normal** (7) · **Many** (10) · **Custom** (1 to 100)
  - time per turn: 15–90 seconds or no limit (30 by default)
  - animations: **On** or **Off** – the game never waits for animations either way (the computer plays instantly); Off just hides them
  - the **Classic settings** button goes back to Normal / Normal / 30 s / animations on.
- Place a tile with a single click, then choose from the bottom bar: a meeple or no meeple.
- Meeples fly onto the board and, when they score, fly back off to the right.
- An **Undo** button after you place a tile.
- Drag to move the board; zoom with the mouse wheel or a pinch. On big maps you can zoom out until the whole map fits, and even maps with thousands of tiles stay smooth.

## Rules in short

1. Draw a tile and place it next to the existing ones; the edges must match.
2. You may put a meeple on the tile you just placed, as long as that structure isn't already taken.
3. Completed road: 1 point per tile. Completed city: 2 points per tile + 2 per pennant. Surrounded monastery: 9 points.
4. At the end, unfinished structures are worth 1 point per tile (+1 per pennant); a monastery 1 + its neighbors.

Simplified version: no farmers.

## How online play works

The site is static (GitHub Pages), so the players' browsers connect directly to each other over WebRTC, using [PeerJS](https://peerjs.com/). Whoever creates the lobby is the host: the game runs on their device and the others only send their moves. If the host closes the page, the game ends.

## Keys

Click a gold spot to place the tile; click the tile to rotate it, click another spot to move it.

`R` rotate · `Enter` / `Space` no meeple · `Esc` undo (take the tile back) · `C` center the board

## Running locally

Open `index.html` in a browser. No installation or server needed.
