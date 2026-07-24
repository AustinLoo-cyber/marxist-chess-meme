(function () {
  const CROWN_GLYPH = '\u265A';
  const BLACK_PAWN_IMG = 'assets/black_chess_pawn.png';

  // Every piece in this variant is, visually, a Pawn: White always
  // renders as the FreeSerif Pawn glyph, Black always renders as the
  // pawn photo — Crowned Pawns of either color use the exact same base
  // look, just with a crown badge added on top in renderBoard().
  function isImagePiece(piece) {
    return piece.color === 'b';
  }
  function glyphClassesFor(piece) {
    return 'piece-qichess-glyph ' + (piece.color === 'w' ? 'piece-white piece-white-pawn' : 'piece-black');
  }

  let game = new PawnsAndCrownsGame();
  let boardFlipped = false;
  let selected = null; // {r,c} of the currently picked-up piece
  let legalMovesForSelected = [];
  let lastMove = null; // {from:{r,c}, to:{r,c}} for highlighting
  let isBotThinking = false;
  let selfPlayActive = false;

  // Drag state — same pointerdown/move/up gesture as the sibling projects.
  let isDragging = false;
  let dragGhostEl = null;

  function snapshotNow() {
    return { board: game.board.map(row => row.map(cell => (cell ? { ...cell } : null))) };
  }
  let boardHistory = [snapshotNow()];
  let currentMoveIndex = 0;

  function isAtLatestMove() {
    return currentMoveIndex === boardHistory.length - 1;
  }
  function getDisplayBoard() {
    return isAtLatestMove() ? game.board : boardHistory[currentMoveIndex].board;
  }
  function recordMoveInHistory() {
    boardHistory = boardHistory.slice(0, currentMoveIndex + 1);
    boardHistory.push(snapshotNow());
    currentMoveIndex = boardHistory.length - 1;
  }
  function goToMoveIndex(index) {
    if (index < 0 || index > boardHistory.length - 1) return;
    currentMoveIndex = index;
    selected = null;
    legalMovesForSelected = [];
    renderBoard();
    updateMoveHistory();
  }

  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('statusMessage');
  const evalFillEl = document.getElementById('evalBarFill');
  const evalLabelEl = document.getElementById('evalScoreLabel');
  const moveHistoryListEl = document.getElementById('moveHistoryList');
  const botMoveBtnEl = document.getElementById('botMoveBtn');
  const botVsBotBtnEl = document.getElementById('botVsBotBtn');

  function toModel(visR, visC) {
    return boardFlipped ? { r: 7 - visR, c: 7 - visC } : { r: visR, c: visC };
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    const atLatest = isAtLatestMove();
    const displayBoard = getDisplayBoard();
    boardEl.classList.toggle('history-locked', !atLatest);

    for (let visR = 7; visR >= 0; visR--) {
      for (let visC = 0; visC < 8; visC++) {
        const { r, c } = toModel(visR, visC);
        const piece = displayBoard[r][c];
        const sq = document.createElement('div');
        const isLight = (r + c) % 2 === 1;
        sq.className = `square ${isLight ? 'light' : 'dark'}`;
        sq.dataset.r = r;
        sq.dataset.c = c;

        if (piece) {
          const pieceWrap = document.createElement('div');
          pieceWrap.className = 'piece-wrap';
          if (atLatest && selected && selected.r === r && selected.c === c && isDragging) {
            pieceWrap.classList.add('piece-lifted');
          }
          if (isImagePiece(piece)) {
            const img = document.createElement('img');
            img.src = BLACK_PAWN_IMG;
            img.className = 'piece-pawn-img';
            img.draggable = false;
            img.alt = 'black pawn';
            pieceWrap.appendChild(img);
          } else {
            const glyph = document.createElement('span');
            glyph.className = glyphClassesFor(piece);
            glyph.textContent = '\u265F';
            pieceWrap.appendChild(glyph);
          }

          if (piece.type === 'C') {
            const crown = document.createElement('span');
            crown.className = 'center-crown ' + (piece.color === 'w' ? 'center-crown-yellow' : 'center-crown-orange');
            crown.textContent = CROWN_GLYPH;
            pieceWrap.appendChild(crown);
          }
          sq.appendChild(pieceWrap);
        }

        if (visC === 0) {
          const rankLabel = document.createElement('span');
          rankLabel.className = 'coord-label coord-rank';
          rankLabel.textContent = r + 1;
          sq.appendChild(rankLabel);
        }
        if (visR === 0) {
          const fileLabel = document.createElement('span');
          fileLabel.className = 'coord-label coord-file';
          fileLabel.textContent = 'abcdefgh'[c];
          sq.appendChild(fileLabel);
        }

        if (atLatest) {
          if (selected && selected.r === r && selected.c === c) {
            sq.classList.add('selected');
          }
          if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
            sq.classList.add('last-move');
          }
          if (legalMovesForSelected.some(m => m.to.r === r && m.to.c === c)) {
            sq.classList.add(piece ? 'legal-capture' : 'legal-move');
          }
          sq.addEventListener('pointerdown', onSquarePointerDown);
        }
        boardEl.appendChild(sq);
      }
    }
  }

  function updateStatus() {
    statusEl.textContent = game.statusMessage;
  }

  function updateEvalBar() {
    const score = evaluateMaterial(game.board);
    const percent = 100 / (1 + Math.exp(-score / 6));
    evalFillEl.style.height = percent + '%';
    evalLabelEl.textContent = (score > 0 ? '+' : '') + score;
  }

  function updateMoveHistory() {
    moveHistoryListEl.innerHTML = '';
    const moves = game.moveHistoryAlgebraic;
    const activeEntryIndex = currentMoveIndex - 1;
    let activeEl = null;
    for (let i = 0; i < moves.length; i++) {
      const entryEl = document.createElement('div');
      entryEl.className = 'move-entry';
      if (i === activeEntryIndex) {
        entryEl.classList.add('active');
        activeEl = entryEl;
      }
      entryEl.textContent = `${i + 1}. ${moves[i]}`;
      entryEl.addEventListener('click', () => goToMoveIndex(i + 1));
      moveHistoryListEl.appendChild(entryEl);
    }
    if (isAtLatestMove()) {
      moveHistoryListEl.parentElement.scrollTop = moveHistoryListEl.parentElement.scrollHeight;
    } else if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderAll() {
    renderBoard();
    updateStatus();
    updateMoveHistory();
    updateBotButtonLabels();
    updateEvalBar();
  }

  // --- Drag-and-drop, matching the sibling projects' gesture ---

  function ensureDragGhost() {
    if (dragGhostEl) return dragGhostEl;
    dragGhostEl = document.createElement('div');
    dragGhostEl.className = 'drag-ghost';
    document.body.appendChild(dragGhostEl);
    return dragGhostEl;
  }

  function positionDragGhost(clientX, clientY, piece) {
    const ghost = ensureDragGhost();
    const size = boardEl.getBoundingClientRect().width / 8;
    ghost.style.width = size + 'px';
    ghost.style.height = size + 'px';
    ghost.style.left = (clientX - size / 2) + 'px';
    ghost.style.top = (clientY - size / 2) + 'px';
    ghost.innerHTML = '';
    if (isImagePiece(piece)) {
      ghost.className = 'drag-ghost';
      const img = document.createElement('img');
      img.src = BLACK_PAWN_IMG;
      img.style.width = (size * 0.62) + 'px';
      img.style.height = (size * 0.62) + 'px';
      ghost.appendChild(img);
    } else {
      ghost.className = 'drag-ghost ' + glyphClassesFor(piece);
      ghost.style.fontSize = (size * 0.62) + 'px';
      ghost.textContent = '\u265F';
    }
    if (piece.type === 'C') {
      const crown = document.createElement('span');
      crown.className = 'center-crown ' + (piece.color === 'w' ? 'center-crown-yellow' : 'center-crown-orange');
      crown.style.fontSize = (size * 0.5) + 'px';
      crown.textContent = CROWN_GLYPH;
      ghost.appendChild(crown);
    }
    ghost.style.display = 'flex';
  }

  function hideDragGhost() {
    if (dragGhostEl) dragGhostEl.style.display = 'none';
  }

  function setGrabbing(active) {
    document.body.style.cursor = active ? 'grabbing' : '';
  }

  function squareFromPointer(clientX, clientY) {
    const rect = boardEl.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }
    const sqSize = rect.width / 8;
    const visC = Math.min(7, Math.max(0, Math.floor((clientX - rect.left) / sqSize)));
    const visRowFromTop = Math.min(7, Math.max(0, Math.floor((clientY - rect.top) / sqSize)));
    const visR = 7 - visRowFromTop;
    return toModel(visR, visC);
  }

  function onSquarePointerDown(e) {
    if (isBotThinking || game.isGameOverFlag || !isAtLatestMove()) return;
    const r = parseInt(e.currentTarget.dataset.r, 10);
    const c = parseInt(e.currentTarget.dataset.c, 10);

    const piece = game.board[r][c];
    if (!piece || piece.color !== game.turn) {
      if (selected) attemptMove(selected.r, selected.c, r, c);
      return;
    }

    e.preventDefault();
    selected = { r, c };
    legalMovesForSelected = game.getLegalMoves(r, c);
    isDragging = true;
    setGrabbing(true);
    positionDragGhost(e.clientX, e.clientY, piece);
    renderBoard();
  }

  document.addEventListener('pointermove', (e) => {
    if (!isDragging || !selected) return;
    const piece = game.board[selected.r][selected.c];
    if (!piece) return;
    positionDragGhost(e.clientX, e.clientY, piece);
  });

  document.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    setGrabbing(false);
    hideDragGhost();
    const target = squareFromPointer(e.clientX, e.clientY);
    if (selected && target) {
      attemptMove(selected.r, selected.c, target.r, target.c);
    } else {
      selected = null;
      legalMovesForSelected = [];
      renderBoard();
    }
  });

  document.addEventListener('pointercancel', () => {
    isDragging = false;
    setGrabbing(false);
    hideDragGhost();
    selected = null;
    legalMovesForSelected = [];
    renderBoard();
  });

  function attemptMove(fromR, fromC, toR, toC) {
    selected = null;
    legalMovesForSelected = [];
    const moved = game.makeMove(fromR, fromC, toR, toC);
    if (moved) {
      lastMove = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };
      recordMoveInHistory();
    }
    renderAll();
  }

  // --- Buttons ---

  function resetGame() {
    selfPlayActive = false;
    isBotThinking = false;
    game = new PawnsAndCrownsGame();
    selected = null; legalMovesForSelected = []; lastMove = null;
    isDragging = false;
    setGrabbing(false);
    hideDragGhost();
    boardHistory = [snapshotNow()];
    currentMoveIndex = 0;
    renderAll();
  }

  document.getElementById('restartBtn').addEventListener('click', resetGame);
  document.getElementById('botMoveBtn').addEventListener('click', handleBotMove);
  document.getElementById('botVsBotBtn').addEventListener('click', handleSelfPlay);
  document.getElementById('pauseBtn').addEventListener('click', () => {
    selfPlayActive = false;
  });

  function setStatusText(text) {
    statusEl.textContent = text;
  }

  function updateBotButtonLabels() {
    const locked = isBotThinking || game.isGameOverFlag || !isAtLatestMove();
    botMoveBtnEl.disabled = locked;
    botMoveBtnEl.textContent = isBotThinking ? 'Bot is moving...' : 'Bot Move';
    botVsBotBtnEl.disabled = locked;
    botVsBotBtnEl.textContent = isBotThinking ? 'Bots are playing...' : 'Bot vs Bot';
  }

  function performBotMove() {
    if (game.isGameOverFlag) {
      return { moved: false, statusMessage: 'Game is over!' };
    }
    const botColor = game.turn;
    const result = getBotMove(game, botColor);
    if (!result || !result.move) {
      return { moved: false, statusMessage: 'Bot has no legal moves.' };
    }
    const { from, to } = result.move;
    const moved = game.makeMove(from.r, from.c, to.r, to.c);
    if (moved) {
      lastMove = { from, to };
      recordMoveInHistory();
      return { moved: true };
    }
    return { moved: false, statusMessage: 'Bot suggested an illegal move (engine rejected it).' };
  }

  async function handleBotMove() {
    if (isBotThinking || game.isGameOverFlag || !isAtLatestMove()) {
      setStatusText(isBotThinking ? 'Bot is already thinking...' : (!isAtLatestMove() ? 'Return to the latest move first.' : 'Game is over!'));
      return;
    }
    isBotThinking = true;
    setStatusText(`Bot is thinking for ${game.turn === 'w' ? 'White' : 'Black'}...`);
    updateBotButtonLabels();

    await new Promise((res) => setTimeout(res, 30));
    const { statusMessage } = performBotMove();

    isBotThinking = false;
    renderBoard();
    updateMoveHistory();
    updateEvalBar();
    setStatusText(statusMessage || game.statusMessage);
    updateBotButtonLabels();
  }

  async function handleSelfPlay() {
    if (game.isGameOverFlag) {
      setStatusText('Game over! Reset to watch again.');
      return;
    }
    if (!isAtLatestMove()) {
      setStatusText('Return to the latest move first.');
      return;
    }
    selfPlayActive = true;
    setStatusText('Bot vs Bot has started...');
    updateBotButtonLabels();

    while (!game.isGameOverFlag && selfPlayActive) {
      isBotThinking = true;
      updateBotButtonLabels();
      await new Promise((res) => setTimeout(res, 30));
      const { statusMessage } = performBotMove();

      renderBoard();
      updateMoveHistory();
      updateEvalBar();
      setStatusText(statusMessage || game.statusMessage);
      isBotThinking = false;
      updateBotButtonLabels();

      await new Promise((res) => setTimeout(res, 500));
    }

    isBotThinking = false;
    setStatusText(selfPlayActive ? 'Bot vs Bot finished!' : 'Bot vs Bot paused');
    updateBotButtonLabels();
  }

  // --- Move history navigation (arrow keys) ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      goToMoveIndex(currentMoveIndex - 1);
    } else if (e.key === 'ArrowRight') {
      goToMoveIndex(currentMoveIndex + 1);
    }
  });

  // --- Flip board ---
  document.getElementById('flipBoardBtn').addEventListener('click', () => {
    boardFlipped = !boardFlipped;
    renderBoard();
  });

  // --- Rules panel ---
  const rulesPanel = document.getElementById('rulesPanel');
  document.getElementById('rulesToggleBtn').addEventListener('click', () => {
    rulesPanel.classList.toggle('hidden');
  });
  document.getElementById('rulesCloseBtn').addEventListener('click', () => {
    rulesPanel.classList.add('hidden');
  });

  renderAll();
})();
