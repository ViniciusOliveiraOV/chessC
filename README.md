# ChessC — WASM demo

Small WebAssembly experiment that compiles the pawn/knight portion of a chess engine written in C and exposes it to a vanilla HTML/JS demo. The repo now contains everything you need to build the WASM binary, preview the UI, and run smoke tests without relying on any legacy projects.

## Project map

```
index.html            ← standalone UI that loads the WASM bridge
build-wasm.ps1        ← wraps the emcc invocation (outputs dist/ & chess/)
src/chess.c|h         ← chess engine logic (pawns, knights, RNG AI)
scripts/chess-demo.js ← browser controller + DOM view
dist/                 ← latest wasm/js artifacts (rebuilt every run)
chess/                ← copy of the artifacts served to the browser
tests/                ← Node-based integration tests against the wasm build
```

## Prerequisites

1. **Node.js 18+** (for `npm install`, dev server, and tests).
2. **Emscripten SDK** (provides `emcc`).
  ```powershell
  git clone https://github.com/emscripten-core/emsdk.git C:\emsdk
  cd C:\emsdk
  .\emsdk install latest
  .\emsdk activate latest
  ```
3. **Before every build/test session**, load the toolchain in the same PowerShell window:
  ```powershell
  & "C:\emsdk\emsdk_env.ps1"
  ```
4. Install JS dependencies in the repo root once:
  ```powershell
  cd path\to\chessC
  npm install
  ```

## Building the WASM module

All build scripts call PowerShell underneath, so run them from a PowerShell prompt that already sourced `emsdk_env.ps1`.

```powershell
# one-off build
npm run build:wasm

# rebuild automatically when src/*.c changes
npm run watch:wasm
```

`build-wasm.ps1` performs the following:

1. Invokes `emcc` with `-Os`, `-s MODULARIZE=1`, `-s EXPORT_ES6=1`, etc.
2. Writes `dist/chess.js` + `dist/chess.wasm`.
3. Copies the pair into `chess/` so the browser demo can import them with a relative path.

## Running the browser demo

```powershell
npm run dev
# serve listens on http://localhost:4173 by default
```

Visit `/` and you should see the 8×8 board, turn indicator, status labels, and buttons for “IA move” + “Reset”. The page lives in `index.html`, and all behavior is in `scripts/chess-demo.js`.

## Tests

The `tests/chess-engine.test.mjs` suite loads the freshly built WASM module inside Node and asserts a few invariants (starting FEN, move counts, board mutations).

```powershell
npm test   # automatically runs npm run build:wasm first
```

Feel free to expand the suite as more pieces/logic are implemented.

## Exported C API (current state)

| Function | Notes |
| --- | --- |
| `chess_reset()` | Fills the board with the standard opening position. |
| `chess_generate_moves(isWhite)` | Generates pseudo-legal pawn pushes + knight jumps for the requested side and returns the count. |
| `chess_get_moves()` | Returns a pointer to the internal move buffer (`from`, `to`, `captured`). |
| `chess_random_ai(isWhite)` | Picks a random generated move, applies it, and returns the number of moves considered. |
| `chess_apply_move(from, to)` | Applies a move (no legality checks beyond bounds). |
| `chess_get_board()` | Pointer to the 64-byte board array (ASCII pieces or `.` for empty). |

Everything is marked with `EMSCRIPTEN_KEEPALIVE`, so it remains exported even with aggressive optimizations.

## Roadmap ideas

- Extend the engine with sliding pieces, castling, and check detection.
- Add richer UI (highlight legal moves, PGN list, move history).
- Replace the ad-hoc PowerShell watcher with a cross-platform solution once Linux/macOS dev is required.
