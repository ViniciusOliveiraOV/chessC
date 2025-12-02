const PIECE_EMOJI = {
  p: "♟",
  r: "♜",
  n: "♞",
  b: "♝",
  q: "♛",
  k: "♚",
  P: "♙",
  R: "♖",
  N: "♘",
  B: "♗",
  Q: "♕",
  K: "♔",
  ".": ""
};

class ChessWasmBridge {
  static async create() {
    const instance = new ChessWasmBridge();
    await instance.init();
    return instance;
  }

  async init() {
    let factory;
    try {
      const moduleRef = await import("../chess/chess.js");
      factory = moduleRef.default ?? moduleRef;
    } catch (error) {
      throw new Error("chess.js não encontrado. Execute chessC/ build-wasm.ps1 antes de carregar a página.", { cause: error });
    }

    this.module = await factory();
    this.wrapFunctions();
    this.reset();
  }

  wrapFunctions() {
    const mod = this.module;
    this.fn = {
      reset: mod.cwrap("chess_reset", null, []),
      generateMoves: mod.cwrap("chess_generate_moves", "number", ["number"]),
      getMovesPtr: mod.cwrap("chess_get_moves", "number", []),
      randomAi: mod.cwrap("chess_random_ai", "number", ["number"]),
      applyMove: mod.cwrap("chess_apply_move", "number", ["number", "number"]),
      getBoardPtr: mod.cwrap("chess_get_board", "number", [])
    };
  }

  reset() {
    this.fn.reset();
  }

  getBoard() {
    const ptr = this.fn.getBoardPtr();
    const chars = [];
    for (let offset = 0; offset < 64; offset++) {
      chars.push(String.fromCodePoint(this.readByte(ptr, offset)));
    }
    return chars;
  }

  getMoves(color) {
    const isWhite = color === "white" ? 1 : 0;
    const count = this.fn.generateMoves(isWhite);
    const ptr = this.fn.getMovesPtr();
    const moves = [];
    for (let i = 0; i < count; i++) {
      const base = i * 3;
      const from = this.readByte(ptr, base);
      const to = this.readByte(ptr, base + 1);
      const captured = this.readByte(ptr, base + 2) || 46;
      moves.push({
        from,
        to,
        captured: String.fromCodePoint(captured)
      });
    }
    return moves;
  }

  readByte(ptr, offset = 0) {
    const raw = this.module.getValue(ptr + offset, "i8");
    return (raw + 256) % 256;
  }

  findMove(color, from, to) {
    return this.getMoves(color).find((mv) => mv.from === from && mv.to === to) ?? null;
  }

  applyMove(from, to) {
    return this.fn.applyMove(from, to);
  }

  randomMove(color) {
    const isWhite = color === "white" ? 1 : 0;
    return this.fn.randomAi(isWhite);
  }
}

class ChessDemo {
  constructor(root) {
    this.root = root;
    this.boardEl = root.querySelector("[data-role='chess-board']");
    this.statusEl = root.querySelector("[data-role='chess-status']");
    this.turnEl = root.querySelector("[data-role='chess-turn']");
    this.aiBtn = root.querySelector("[data-action='ai-move']");
    this.resetBtn = root.querySelector("[data-action='reset-board']");
    this.selectedSquare = null;
    this.currentTurn = "white";
  }

  async init() {
    if (!this.root) return;
    try {
      this.bridge = await ChessWasmBridge.create();
      this.renderBoard();
      this.updateTurnLabel();
      this.status("Módulo WebAssembly carregado.");
      this.bindEvents();
    } catch (error) {
      console.error("Falha ao carregar o módulo de xadrez", error);
      this.status("Não foi possível carregar o módulo WASM. Rode chessC/ build-wasm.ps1.");
      this.root.classList.add("chess-demo--error");
    }
  }

  bindEvents() {
    this.boardEl.addEventListener("click", (event) => {
      const target = event.target.closest(".chess-square");
      if (!target || !this.bridge) return;
      const idx = Number(target.dataset.index);
      this.handleSquareClick(idx);
    });

    this.resetBtn.addEventListener("click", () => {
      this.bridge.reset();
      this.currentTurn = "white";
      this.selectedSquare = null;
      this.renderBoard();
      this.updateTurnLabel();
      this.status("Tabuleiro reiniciado.");
    });

    this.aiBtn.addEventListener("click", () => {
      this.runAiTurn();
    });
  }

  runAiTurn() {
    if (!this.bridge) return;
    const movingSide = this.currentTurn;
    const moves = this.bridge.randomMove(movingSide);
    if (moves === 0) {
      this.status("Nenhum movimento disponível para " + movingSide + ".");
      return;
    }
    this.toggleTurn();
    this.selectedSquare = null;
    this.renderBoard();
    this.updateTurnLabel();
    this.status("IA realizou um movimento para " + (movingSide === "white" ? "brancas" : "negras") + ".");
  }

  handleSquareClick(idx) {
    const board = this.bridge.getBoard();
    const piece = board[idx];
    const pieceIsCurrent = this.isPieceOfCurrentTurn(piece);

    if (this.selectedSquare === null) {
      if (pieceIsCurrent) {
        this.selectedSquare = idx;
        this.highlightSelection();
        this.status("Casa selecionada.");
      } else {
        this.status("Selecione uma peça das " + (this.currentTurn === "white" ? "brancas" : "negras") + ".");
      }
      return;
    }

    if (this.selectedSquare === idx) {
      this.selectedSquare = null;
      this.highlightSelection();
      this.status("Seleção cancelada.");
      return;
    }

    if (pieceIsCurrent) {
      this.selectedSquare = idx;
      this.highlightSelection();
      this.status("Casa selecionada.");
      return;
    }

    const move = this.bridge.findMove(this.currentTurn, this.selectedSquare, idx);
    if (!move) {
      this.status("Movimento inválido para esta peça.");
      return;
    }

    this.bridge.applyMove(move.from, move.to);
    this.selectedSquare = null;
    this.toggleTurn();
    this.renderBoard();
    this.highlightSelection();
    this.updateTurnLabel();
    this.status("Movimento aplicado.");
  }

  highlightSelection() {
    for (const el of this.boardEl.querySelectorAll(".chess-square")) {
      if (Number(el.dataset.index) === this.selectedSquare) {
        el.classList.add("selected");
      } else {
        el.classList.remove("selected");
      }
    }
  }

  renderBoard() {
    const board = this.bridge.getBoard();
    this.boardEl.innerHTML = "";
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const idx = rank * 8 + file;
        const square = document.createElement("button");
        square.type = "button";
        square.dataset.index = String(idx);
        square.className = "chess-square " + ((rank + file) % 2 === 0 ? "light" : "dark");
        const char = board[idx];
        square.textContent = PIECE_EMOJI[char] ?? "";
        const baseTitle = "Casa " + this.squareName(idx);
        const pieceSuffix = char !== "." ? " — " + char : "";
        square.title = baseTitle + pieceSuffix;
            if (char === ".") {
              square.removeAttribute("data-piece-color");
            } else {
              const isWhite = char === char.toUpperCase();
              square.dataset.pieceColor = isWhite ? "white" : "black";
            }
        this.boardEl.appendChild(square);
      }
    }
  }

  squareName(idx) {
    const files = "abcdefgh";
    const file = files[idx % 8];
    const rank = 8 - Math.floor(idx / 8);
    return `${file}${rank}`;
  }

  isPieceOfCurrentTurn(piece) {
    if (piece === ".") return false;
    return this.currentTurn === "white" ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
  }

  toggleTurn() {
    this.currentTurn = this.currentTurn === "white" ? "black" : "white";
  }

  updateTurnLabel() {
    if (!this.turnEl) return;
    this.turnEl.textContent = this.currentTurn === "white" ? "Brancas" : "Negras";
  }

  status(message) {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("chessDemo");
  if (!root) return;
  const demo = new ChessDemo(root);
  demo.init();
});
