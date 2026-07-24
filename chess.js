// Pawns & Crowns engine.
//
// RULES SUMMARY:
//   - Each side starts with NOTHING but 16 Pawns: two full back rows
//     (rows 1-2 for White, rows 7-8 for Black). No Rooks, Knights,
//     Bishops, Queens, or Kings exist in this variant at all.
//   - Pawns move and capture by completely standard chess Pawn rules
//     (one step forward, an optional two-step from its own starting
//     row, diagonal capture one square forward). Because the back-row
//     Pawn starts out blocked by the Pawn directly in front of it, it
//     naturally can't move until that front Pawn steps aside — and even
//     then it only ever gets the single-step (never the double-step,
//     since it isn't sitting on the row this variant treats as "start").
//   - The moment a Pawn reaches the opposite back rank, it instantly
//     becomes a Crowned Pawn: still visually a Pawn, but wearing a
//     crown, and from then on it moves and captures exactly like a
//     King — one square in any of the 8 directions. It is no longer a
//     Pawn, so it can never promote again no matter how many times it
//     later lands back on a back rank.
//   - There is no King to protect and no check/checkmate. The ONLY way
//     to win is to capture every single one of the opponent's pieces.
//   - If a player has zero legal moves on their turn, that's a stalemate
//     — same as standard chess, the game ends immediately as a draw.
//
// Board convention: row 0 = rank 1 (White's back rank), row 7 = rank 8
// (Black's back rank), col 0 = file a, col 7 = file h.
// board[r][c] is null (empty) or { type: 'P'|'C', color: 'w'|'b' }.

const FILES = 'abcdefgh';
const PIECE_LETTER = { P: '', C: '' }; // both render with blank notation letters, like standard Pawn notation
const PIECE_NAME = { P: 'Pawn', C: 'Crowned Pawn' };
const PIECE_VALUE = { P: 1, C: 3 };

class PawnsAndCrownsGame {
  constructor() {
    this.board = this.buildInitialBoard();
    this.turn = 'w';
    this.moveHistoryAlgebraic = [];
    this.isGameOverFlag = false;
    this.statusMessage = 'White to move.';
    this.resultReason = null; // 'annihilation' | 'stalemate' | null
    this.winner = null; // 'w' | 'b' | null
  }

  buildInitialBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: 'P', color: 'w' };
      board[1][c] = { type: 'P', color: 'w' };
      board[6][c] = { type: 'P', color: 'b' };
      board[7][c] = { type: 'P', color: 'b' };
    }
    return board;
  }

  clone() {
    const g = new PawnsAndCrownsGame();
    g.board = this.board.map(row => row.map(cell => (cell ? { ...cell } : null)));
    g.turn = this.turn;
    g.moveHistoryAlgebraic = [...this.moveHistoryAlgebraic];
    g.isGameOverFlag = this.isGameOverFlag;
    g.statusMessage = this.statusMessage;
    g.resultReason = this.resultReason;
    g.winner = this.winner;
    return g;
  }

  inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  squareName(r, c) {
    return FILES[c] + (r + 1);
  }

  countPieces(color, board = this.board) {
    let n = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color) n++;
      }
    }
    return n;
  }

  static kingDeltas() {
    return [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  }

  // Standard Pawn destinations: forward one, forward two from its own
  // starting row, diagonal capture.
  rawPawnMoves(r, c, board = this.board) {
    const piece = board[r][c];
    const moves = [];
    const dir = piece.color === 'w' ? 1 : -1;
    const startRow = piece.color === 'w' ? 1 : 6;
    const oneAhead = { r: r + dir, c };
    if (this.inBounds(oneAhead.r, oneAhead.c) && !board[oneAhead.r][oneAhead.c]) {
      moves.push(oneAhead);
      const twoAhead = { r: r + dir * 2, c };
      if (r === startRow && this.inBounds(twoAhead.r, twoAhead.c) && !board[twoAhead.r][twoAhead.c]) {
        moves.push(twoAhead);
      }
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (!this.inBounds(nr, nc)) continue;
      const occ = board[nr][nc];
      if (occ && occ.color !== piece.color) moves.push({ r: nr, c: nc });
    }
    return moves;
  }

  // Crowned Pawn destinations: one square, any of the 8 directions,
  // onto an empty square or a capture — exactly a King's move.
  rawCrownedMoves(r, c, board = this.board) {
    const piece = board[r][c];
    const moves = [];
    for (const [dr, dc] of PawnsAndCrownsGame.kingDeltas()) {
      const nr = r + dr, nc = c + dc;
      if (!this.inBounds(nr, nc)) continue;
      const occ = board[nr][nc];
      if (!occ || occ.color !== piece.color) moves.push({ r: nr, c: nc });
    }
    return moves;
  }

  rawMoves(r, c, board = this.board) {
    const piece = board[r][c];
    if (!piece) return [];
    return piece.type === 'C' ? this.rawCrownedMoves(r, c, board) : this.rawPawnMoves(r, c, board);
  }

  getLegalMoves(r, c, board = this.board) {
    const piece = board[r][c];
    if (!piece) return [];
    return this.rawMoves(r, c, board).map(d => ({
      from: { r, c },
      to: d,
      isCapture: !!board[d.r][d.c],
    }));
  }

  getAllLegalMoves(color, board = this.board) {
    const all = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.color === color) all.push(...this.getLegalMoves(r, c, board));
      }
    }
    return all;
  }

  makeMove(fromR, fromC, toR, toC) {
    if (this.isGameOverFlag) {
      this.statusMessage = 'Game is over!';
      return false;
    }
    const piece = this.board[fromR][fromC];
    if (!piece || piece.color !== this.turn) {
      this.statusMessage = "It's not your turn to move that piece!";
      return false;
    }
    const legal = this.getLegalMoves(fromR, fromC);
    const move = legal.find(m => m.to.r === toR && m.to.c === toC);
    if (!move) {
      this.statusMessage = 'Invalid move for that piece.';
      return false;
    }

    const capturedPiece = this.board[toR][toC];
    // A Pawn (never a Crowned Pawn — it's a different type by then)
    // reaching the far back rank promotes automatically. There's only
    // one thing to promote into here, so no choice is needed.
    const isPromotion = piece.type === 'P' && toR === (piece.color === 'w' ? 7 : 0);
    const pieceLetter = PIECE_LETTER[piece.type];

    this.board[toR][toC] = piece;
    this.board[fromR][fromC] = null;
    if (isPromotion) piece.type = 'C';

    let notation = `${pieceLetter}${this.squareName(fromR, fromC)}${capturedPiece ? 'x' : '-'}${this.squareName(toR, toC)}`;
    if (isPromotion) notation += '=C';

    this.moveHistoryAlgebraic.push(notation);

    if (capturedPiece) {
      const remaining = this.countPieces(capturedPiece.color);
      if (remaining === 0) {
        this.isGameOverFlag = true;
        this.resultReason = 'annihilation';
        this.winner = piece.color;
        this.statusMessage = `${capturedPiece.color === 'w' ? "White's" : "Black's"} army has been wiped out! ${this.winner === 'w' ? 'White' : 'Black'} wins.`;
        this.moveHistoryAlgebraic[this.moveHistoryAlgebraic.length - 1] += ` \u2014 ${this.winner === 'w' ? 'White' : 'Black'} wins!`;
        return true;
      }
    }

    this.turn = piece.color === 'w' ? 'b' : 'w';
    this.advanceTurnState();
    if (isPromotion) {
      this.statusMessage = `${piece.color === 'w' ? "White's" : "Black's"} Pawn reached the back rank and was crowned! ${this.statusMessage}`;
    }
    return true;
  }

  advanceTurnState() {
    const nextMoves = this.getAllLegalMoves(this.turn);
    if (nextMoves.length === 0) {
      // Standard chess stalemate: a player with zero legal moves on their
      // own turn ends the game immediately as a draw. No passing.
      this.isGameOverFlag = true;
      this.resultReason = 'stalemate';
      this.winner = null;
      const stuckColor = this.turn;
      this.moveHistoryAlgebraic.push(`${stuckColor === 'w' ? 'White' : 'Black'} has no legal moves — stalemate`);
      this.statusMessage = `${stuckColor === 'w' ? 'White' : 'Black'} has no legal moves. Stalemate — the game is a draw.`;
      return;
    }
    this.statusMessage = `${this.turn === 'w' ? 'White' : 'Black'} to move`;
  }
}

function evaluateMaterial(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const v = PIECE_VALUE[piece.type] || 0;
      score += piece.color === 'w' ? v : -v;
    }
  }
  return score;
}

// eslint-disable-next-line no-unused-vars
const ChessExports = { PawnsAndCrownsGame, evaluateMaterial, FILES, PIECE_LETTER, PIECE_NAME, PIECE_VALUE };
