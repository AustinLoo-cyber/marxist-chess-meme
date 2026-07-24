// Bot logic for Pawns & Crowns.
//
// A simple material-aware random bot: captures are favored, and bigger
// captures (a Crowned Pawn is worth more than a plain Pawn) are favored
// a little more. There's no King to hunt in this variant — the game is
// won by wiping out the opponent's whole army, so the bot just plays
// reasonably greedy captures and otherwise moves at random.

const PIECE_WEIGHT = { P: 1, C: 3 };

function getBotMove(game, color) {
  const moves = game.getAllLegalMoves(color);
  if (moves.length === 0) return null;

  const weighted = [];
  for (const move of moves) {
    let copies = 1;
    if (move.isCapture) {
      const capturedPiece = game.board[move.to.r][move.to.c];
      const value = capturedPiece ? (PIECE_WEIGHT[capturedPiece.type] || 1) : 1;
      copies = 2 + value; // captures always favored, bigger captures more so
    }
    for (let i = 0; i < copies; i++) weighted.push(move);
  }
  const move = weighted[Math.floor(Math.random() * weighted.length)];
  return { move };
}
