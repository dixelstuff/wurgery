import {newGame, transplant, excise, undoExcision, textOf} from './model.mjs';

const $ = id => document.getElementById(id);
const board = $('word-board');
let puzzles = [], current = 0, state, selection = null, gesture = null, drag = null;
let solved = new Set();
let message = '', messageKind = '';
try { solved = new Set(JSON.parse(localStorage.getItem('wurgery-solved-v1') || '[]')); } catch {}

function saveProgress() {
  try { localStorage.setItem('wurgery-solved-v1', JSON.stringify([...solved])); } catch {}
}

function loadPuzzle(index) {
  cancelGesture();
  current = Math.max(0, Math.min(puzzles.length - 1, index));
  state = newGame(puzzles[current]); selection = null; message = ''; messageKind = '';
  render();
}

function setMessage(text, kind = '') { message = text; messageKind = kind; }
function selectedChunk() { return selection ? state.tokens.slice(selection.start, selection.end) : []; }

function availableMove(destination) {
  if (!selection || state.phase !== 'transplant') return false;
  try { transplant(state, selection.start, selection.end, destination); return true; } catch { return false; }
}

function renderBoard() {
  board.replaceChildren();
  board.className = `word-board phase-${state.phase}${drag ? ' dragging' : ''}`;
  const cutAway = drag && state.phase === 'transplant';
  const tokens = cutAway ? state.tokens.filter((_, i) => i < selection.start || i >= selection.end) : state.tokens;
  for (let i = 0; i <= tokens.length; i++) {
    const gap = document.createElement('button'); gap.type = 'button'; gap.className = 'gap';
    let destination = i;
    if (selection && !cutAway) {
      if (i > selection.start && i < selection.end) destination = -1;
      else if (i >= selection.end) destination = i - (selection.end - selection.start);
    }
    gap.dataset.destination = destination;
    gap.setAttribute('aria-label', `Insert selected chunk at gap ${destination} in the remainder`);
    const available = destination >= 0 && availableMove(destination);
    gap.disabled = !available;
    if (available) gap.classList.add('available');
    if (drag?.destination === destination && available) gap.classList.add('drop-here');
    gap.addEventListener('click', () => { if (!gesture && available) commitMove(destination); });
    board.append(gap);
    if (i === tokens.length) continue;
    const token = tokens[i];
    const index = cutAway ? state.tokens.findIndex(t => t.id === token.id) : i;
    const letter = document.createElement('button'); letter.type = 'button';
    letter.className = 'letter'; letter.textContent = token.letter; letter.dataset.index = index;
    letter.setAttribute('aria-label', `Letter ${token.letter}, position ${index + 1}${token.moved ? ', transplanted' : ''}`);
    const selected = !cutAway && selection && index >= selection.start && index < selection.end;
    letter.setAttribute('aria-pressed', String(Boolean(selected)));
    if (token.moved) letter.classList.add('moved');
    if (selected) letter.classList.add('selected');
    letter.disabled = !['transplant','excision'].includes(state.phase);
    // Keyboard-generated clicks have detail 0; pointer selection is handled below.
    letter.addEventListener('click', event => { if (event.detail === 0) selectByClick(index); });
    letter.addEventListener('keydown', event => {
      if (event.key === 'Escape') { selection = null; render(); }
      if (event.shiftKey && ['ArrowLeft','ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const next = Math.max(0, Math.min(state.tokens.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
        const anchor = selection?.anchor ?? index;
        selection = {start: Math.min(anchor,next), end: Math.max(anchor,next)+1, anchor};
        render(); board.querySelector(`[data-index="${next}"]`)?.focus();
      }
    });
    board.append(letter);
  }
}

function selectByClick(index) {
  if (!['transplant','excision'].includes(state.phase)) return;
  const anchor = selection?.anchor ?? index;
  selection = {start: Math.min(anchor,index), end: Math.max(anchor,index)+1, anchor};
  setMessage(''); render();
  board.querySelector(`[data-index="${index}"]`)?.focus();
}

function render() {
  renderBoard();
  const cutting = state.phase === 'excision', finished = ['solved','incorrect'].includes(state.phase);
  $('case-label').textContent = `PUZZLE ${String(current + 1).padStart(2,'0')} / ${puzzles.length}`;
  $('progress').textContent = `${puzzles.filter(p => solved.has(p.id)).length} / ${puzzles.length} solved`;
  $('step-transplant').className = `step ${state.phase === 'transplant' ? 'active' : 'done'}`;
  $('step-excision').className = `step ${cutting || state.phase === 'incorrect' ? 'cut-active' : state.phase === 'solved' ? 'done' : ''}`;
  $('clue').textContent = state.puzzle.clue;
  $('answer-slots').replaceChildren(...Array.from({length: state.puzzle.target.length}, () => {
    const slot = document.createElement('span'); slot.className = 'answer-slot'; return slot;
  }));
  $('answer-slots').setAttribute('aria-label', `${state.puzzle.target.length} letter answer`);
  $('answer-length').textContent = `${state.puzzle.target.length} LETTERS`;
  $('selection-copy').replaceChildren();
  if (selection) {
    const strong = document.createElement('strong'); strong.textContent = `“${textOf(selectedChunk())}”`;
    $('selection-copy').append(strong, cutting ? ' ready for the scalpel' : ' ready to move');
  } else $('selection-copy').textContent = finished ? 'Your two operations are complete.' : cutting ? 'Highlight the chunk you want to remove.' : 'Highlight a chunk to begin.';
  $('clear-selection').hidden = !selection;
  $('instruction').textContent = state.phase === 'solved' ? 'Beautiful work. A completely different word.' : state.phase === 'incorrect' ? 'Not quite the word in the clue. Try another cut or reset.' : cutting ? 'Now highlight a chunk and drag it down to the red scalpel.' : 'Highlight neighboring letters. Then drag the green chunk into a new gap.';
  $('fallback-tip').textContent = finished ? 'Reset is always here if you want to start again.' : cutting ? 'You can also click the scalpel to cut your selection.' : 'You can also click a green gap to move your selection.';
  $('scalpel').className = `scalpel${cutting ? '' : ' locked'}`;
  $('scalpel').setAttribute('aria-disabled', String(!cutting || !selection));
  $('scalpel-title').textContent = state.phase === 'solved' ? 'Operation complete' : 'The excision tray';
  $('scalpel-copy').textContent = cutting ? 'Drop your red chunk here to snip it away.' : state.phase === 'incorrect' ? 'Try another cut, or reset to change your transplant.' : finished ? 'Two small operations. A brand-new word.' : 'First, give those letters a green transplant.';
  $('status').textContent = message;
  $('status').className = `status ${messageKind}`;
  const log = $('operation-log'); log.replaceChildren();
  if (state.transplant) {
    const row = document.createElement('p'); row.textContent = `🧩 Moved “${state.transplant.chunk}” → `;
    const word = document.createElement('b'); word.textContent = state.transplant.after; row.append(word); log.append(row);
  }
  if (state.excision) {
    const row = document.createElement('p'); row.textContent = `✂️ Removed “${state.excision.chunk}” → `;
    const word = document.createElement('b'); word.textContent = state.excision.after; row.append(word); log.append(row);
  }
  $('try-cut').hidden = state.phase !== 'incorrect';
  $('next-solved').hidden = state.phase !== 'solved';
  $('next-solved').textContent = current === puzzles.length - 1 ? 'Back to the collection →' : 'Next puzzle →';
  $('previous').disabled = current === 0; $('next').disabled = current === puzzles.length - 1;
  const picker = $('puzzle-picker'); picker.replaceChildren(...puzzles.map((p,i) => {
    const option = document.createElement('option'); option.value = i;
    option.textContent = `${String(i+1).padStart(2,'0')}${solved.has(p.id) ? ' ✓' : ''}`; return option;
  })); picker.value = current;
}

function commitMove(destination) {
  if (!selection) return;
  try {
    state = transplant(state, selection.start, selection.end, destination);
    selection = null; setMessage('🧩 Transplant placed. The green underline marks the letters you moved.');
  } catch (error) { setMessage(error.message, 'error'); }
  render();
}

function commitExcision() {
  if (state.phase !== 'excision') return;
  if (!selection) { setMessage('Highlight a chunk of letters first, then bring it to the scalpel.', 'error'); render(); return; }
  try {
    state = excise(state, selection.start, selection.end); selection = null;
    if (state.phase === 'solved') {
      solved.add(state.puzzle.id); saveProgress();
      setMessage(puzzles.every(p => solved.has(p.id)) ? '🌿 Collection complete. Twenty lovely little transformations.' : '🌿 That’s it! A successful bit of word surgery.', 'success');
    } else setMessage('That word doesn’t match the clue. Try a different cut, or reset for a new transplant.', 'error');
  } catch (error) { setMessage(error.message, 'error'); }
  render();
}

function cancelGesture() {
  gesture = null; drag = null;
  $('drag-ghost').hidden = true; $('scalpel').classList.remove('drop-hover');
}

board.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !['transplant','excision'].includes(state?.phase)) return;
  const tile = event.target.closest('.letter'); if (!tile) return;
  event.preventDefault();
  const index = Number(tile.dataset.index);
  const inside = selection && index >= selection.start && index < selection.end;
  const anchor = selection?.anchor ?? index;
  gesture = {pointer: event.pointerId, mode: inside ? 'pending-drag' : 'select', x: event.clientX, y: event.clientY, anchor, index};
  board.setPointerCapture(event.pointerId);
  if (!inside) { selection = {start: Math.min(anchor,index), end: Math.max(anchor,index)+1, anchor}; setMessage(''); render(); }
});

board.addEventListener('pointermove', event => {
  if (!gesture || gesture.pointer !== event.pointerId) return;
  event.preventDefault();
  if (gesture.mode === 'select') {
    const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest('.letter');
    if (tile) {
      const index = Number(tile.dataset.index), anchor = gesture.anchor;
      if (selection.start !== Math.min(anchor,index) || selection.end !== Math.max(anchor,index)+1) {
        selection = {start: Math.min(anchor,index), end: Math.max(anchor,index)+1, anchor}; render();
      }
    }
    return;
  }
  if (!drag && Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y) < 7) return;
  if (!drag) {
    drag = {destination: null, overTray: false};
    const ghost = $('drag-ghost'); ghost.className = `drag-ghost${state.phase === 'excision' ? ' red' : ''}`;
    ghost.replaceChildren(...selectedChunk().map(token => {const span = document.createElement('span'); span.textContent = token.letter; return span;}));
    ghost.hidden = false; renderBoard();
  }
  const ghost = $('drag-ghost'); ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`;
  if (state.phase === 'transplant') {
    const rect = board.getBoundingClientRect();
    const within = event.clientY >= rect.top-30 && event.clientY <= rect.bottom+30 && event.clientX >= rect.left-20 && event.clientX <= rect.right+20;
    const tiles = [...board.querySelectorAll('.letter')];
    let destination = tiles.findIndex(tile => event.clientX < tile.getBoundingClientRect().left + tile.getBoundingClientRect().width/2);
    if (destination < 0) destination = tiles.length;
    drag.destination = within ? destination : null;
    board.querySelectorAll('.gap').forEach(gap => gap.classList.toggle('drop-here', within && Number(gap.dataset.destination) === destination && availableMove(destination)));
  } else {
    const rect = $('scalpel').getBoundingClientRect();
    drag.overTray = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    $('scalpel').classList.toggle('drop-hover', drag.overTray);
  }
});

board.addEventListener('pointerup', event => {
  if (!gesture || gesture.pointer !== event.pointerId) return;
  const moveDestination = drag?.destination, cut = drag?.overTray, wasDragging = Boolean(drag);
  cancelGesture();
  if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
  if (wasDragging && state.phase === 'transplant' && moveDestination !== null) commitMove(moveDestination);
  else if (wasDragging && state.phase === 'excision' && cut) commitExcision();
  else render();
});
board.addEventListener('pointercancel', () => {cancelGesture(); render();});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && state) {cancelGesture(); selection = null; render();} });
$('clear-selection').addEventListener('click', () => {selection = null; render();});
$('reset').addEventListener('click', () => loadPuzzle(current));
$('scalpel').addEventListener('click', () => commitExcision());
$('try-cut').addEventListener('click', () => {state = undoExcision(state); selection = null; setMessage('Choose a different chunk to excise. Your transplant is still in place.'); render();});
$('previous').addEventListener('click', () => loadPuzzle(current-1));
$('next').addEventListener('click', () => loadPuzzle(current+1));
$('next-solved').addEventListener('click', () => loadPuzzle((current+1)%puzzles.length));
$('puzzle-picker').addEventListener('change', event => loadPuzzle(Number(event.target.value)));

try {
  const response = await fetch('./puzzles.json');
  if (!response.ok) throw new Error('The puzzle collection could not be loaded.');
  puzzles = await response.json();
  if (!puzzles.length) throw new Error('The puzzle collection is empty.');
  loadPuzzle(0);
} catch (error) {
  $('clue').textContent = 'The operating room is taking a moment.';
  $('status').textContent = `Could not load the puzzles. Refresh to try again. ${error.message}`;
  $('status').className = 'status error';
}
