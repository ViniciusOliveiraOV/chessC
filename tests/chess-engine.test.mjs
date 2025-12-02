import test from "node:test";
import assert from "node:assert/strict";
import ChessModule from "../dist/chess.js";

const engine = await ChessModule({
  locateFile: (file) => new URL(`../dist/${file}`, import.meta.url).href
});

const api = {
  reset: engine.cwrap("chess_reset", null, []),
  getBoardPtr: engine.cwrap("chess_get_board", "number", []),
  generateMoves: engine.cwrap("chess_generate_moves", "number", ["number"]),
  getMovesPtr: engine.cwrap("chess_get_moves", "number", []),
  applyMove: engine.cwrap("chess_apply_move", "number", ["number", "number"])
};

function boardFromRows(rows) {
  if (rows.length !== 8) {
    throw new Error("Board requires 8 rows");
  }
  return rows.join("");
}

function loadPosition(rows) {
  const layout = boardFromRows(rows);
  const ptr = api.getBoardPtr();
  for (let i = 0; i < 64; i++) {
    engine.setValue(ptr + i, layout.charCodeAt(i), "i8");
  }
}

function readBoard() {
  const ptr = api.getBoardPtr();
  const chars = [];
  for (let offset = 0; offset < 64; offset++) {
    const code = (engine.getValue(ptr + offset, "i8") + 256) % 256;
    chars.push(String.fromCodePoint(code));
  }
  return chars;
}

function movesFor(color) {
  const isWhite = color === "white" ? 1 : 0;
  const count = api.generateMoves(isWhite);
  const ptr = api.getMovesPtr();
  const moves = [];
  for (let i = 0; i < count; i++) {
    const base = i * 3;
    moves.push({
      from: (engine.getValue(ptr + base, "i8") + 256) % 256,
      to: (engine.getValue(ptr + base + 1, "i8") + 256) % 256,
      captured: String.fromCodePoint((engine.getValue(ptr + base + 2, "i8") + 256) % 256 || 46)
    });
  }
  return moves;
}

function squareName(idx) {
  const files = "abcdefgh";
  const file = files[idx % 8];
  const rank = 8 - Math.floor(idx / 8);
  return `${file}${rank}`;
}

function squareIndex(square) {
  const files = "abcdefgh";
  const file = files.indexOf(square[0]);
  const rank = Number(square[1]);
  return (8 - rank) * 8 + file;
}

function boardToFenPieces(board) {
  const ranks = [];
  for (let rank = 0; rank < 8; rank++) {
    let empty = 0;
    const row = [];
    for (let file = 0; file < 8; file++) {
      const piece = board[rank * 8 + file];
      if (piece === ".") {
        empty += 1;
      } else {
        if (empty > 0) {
          row.push(String(empty));
          empty = 0;
        }
        row.push(piece);
      }
    }
    if (empty > 0) row.push(String(empty));
    ranks.push(row.join(""));
  }
  return ranks.join("/");
}

test("engine resets to initial board", () => {
  api.reset();
  const board = readBoard();
  const fen = boardToFenPieces(board);
  assert.equal(
    fen,
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
    "starting position should match classic chess"
  );
});

test("white has 12 legal moves from the opening (pawns + knights)", () => {
  api.reset();
  const moves = movesFor("white");
  assert.equal(moves.length, 12, "engine currently generates pawn pushes + knight moves");
});

test("applying a move updates board state", () => {
  api.reset();
  const moves = movesFor("white");
  const pawnAdvance = moves.find((mv) => squareName(mv.from) === "e2" && squareName(mv.to) === "e3");
  assert.ok(pawnAdvance, "should find e2e3 move");
  api.applyMove(pawnAdvance.from, pawnAdvance.to);
  const board = readBoard();
  const e3Idx = (8 - 3) * 8 + ("e".charCodeAt(0) - 97);
  const e2Idx = (8 - 2) * 8 + ("e".charCodeAt(0) - 97);
  assert.equal(board[e3Idx], "P", "white pawn should land on e3");
  assert.equal(board[e2Idx], ".", "origin square should be empty");
});

test("king moves cover all adjacent squares and captures", () => {
  loadPosition([
    "........",
    "........",
    "........",
    "...pr...",
    "....KP..",
    "...B....",
    "........",
    "........"
  ]);
  const kingIdx = squareIndex("e4");
  const moves = movesFor("white").filter((mv) => mv.from === kingIdx).map((mv) => squareName(mv.to));
  assert.deepEqual(moves.sort(), ["d4", "d5", "e3", "e5", "f3", "f5"].sort());
});

test("rook slides horizontally and vertically with captures", () => {
  loadPosition([
    "........",
    "........",
    "...N....",
    "........",
    ".P.R..b.",
    "........",
    "...p....",
    "........"
  ]);
  const rookIdx = squareIndex("d4");
  const moves = movesFor("white").filter((mv) => mv.from === rookIdx).map((mv) => squareName(mv.to));
  assert.deepEqual(moves.sort(), ["c4", "d3", "d5", "d2", "e4", "f4", "g4"].sort());
});

test("bishop slides diagonally and captures enemies", () => {
  loadPosition([
    "........",
    ".....r..",
    "........",
    "........",
    "..B.....",
    "........",
    "p...P...",
    "........"
  ]);
  const bishopIdx = squareIndex("c4");
  const moves = movesFor("white").filter((mv) => mv.from === bishopIdx).map((mv) => squareName(mv.to));
  assert.deepEqual(moves.sort(), ["a2", "a6", "b3", "b5", "d3", "d5", "e6", "f7"].sort());
});
