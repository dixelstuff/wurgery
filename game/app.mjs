import {newGame, transplant, excise, textOf} from './model.mjs?v=chunks2';

const $ = id => document.getElementById(id);
const board = $('word-board');
let puzzles = [], current = 0, state, selection = null, gesture = null, drag = null;
let solved = new Set();
let message = '', messageKind = '';
try { solved = new Set(JSON.parse(localStorage.getItem('wurgery-solved-chunks2') || '[]')); } catch {}

function saveProgress() {
  try { localStorage.setItem('wurgery-solved-chunks2', JSON.stringify([...solved])); } catch {}
}

function loadPuzzle(index) {
  cancelGesture();
  current = Math.max(0, Math.min(puzzles.length - 1, index));
  state = newGame(puzzles[current]); selection = null; message = ''; messageKind = '';
  render();
}

function setMessage(text, kind = '') { message = text; messageKind = kind; }
function selectedChunk() { return selection ? state.tokens.slice(selection.start, selection.end) : []; }
function validSelection() { return selection && selection.end - selection.start >= 2; }

function availableMove(destination) {
  if (!selection || state.phase !== 'transplant') return false;
  try { transplant(state, selection.start, selection.end, destination); return true; } catch { return false; }
}

function renderBoard() {
  board.replaceChildren();
  board.className = `word-board phase-${state.phase}${drag ? ' dragging' : ''}`;
  board.style.setProperty('--count', state.puzzle.source.length);
  const moving = drag && state.phase === 'transplant';
  let tokens = state.tokens;
  if (moving) {
    tokens = state.tokens.filter((_, i) => i < selection.start || i >= selection.end);
    if (drag.destination !== null) {
      const preview = selectedChunk().map(token => ({...token, preview: true}));
      tokens = [...tokens.slice(0, drag.destination), ...preview, ...tokens.slice(drag.destination)];
    }
  }
  for (let i = 0; i <= tokens.length; i++) {
    const gap = document.createElement('button'); gap.type = 'button'; gap.className = 'gap';
    let destination = i;
    if (selection && !moving) {
      if (i > selection.start && i < selection.end) destination = -1;
      else if (i >= selection.end) destination = i - (selection.end - selection.start);
    }
    gap.dataset.destination = destination;
    gap.setAttribute('aria-label', `Insert selected chunk at gap ${destination} in the remainder`);
    const available = !moving && destination >= 0 && availableMove(destination);
    gap.disabled = !available;
    gap.addEventListener('click', () => { if (!gesture && available) commitMove(destination); });
    board.append(gap);
    if (i === tokens.length) continue;
    const token = tokens[i];
    if (token.preview) {
      const preview = document.createElement('span');
      preview.className = 'letter insertion-preview';
      preview.textContent = token.letter;
      preview.setAttribute('aria-hidden', 'true');
      board.append(preview);
      continue;
    }
    const index = moving ? state.tokens.findIndex(t => t.id === token.id) : i;
    const letter = document.createElement('button'); letter.type = 'button';
    letter.className = 'letter'; letter.textContent = token.letter; letter.dataset.index = index;
    letter.setAttribute('aria-label', `Letter ${token.letter}, position ${index + 1}`);
    const selected = !moving && selection && index >= selection.start && index < selection.end;
    letter.setAttribute('aria-pressed', String(Boolean(selected)));
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
  const cutting = state.phase === 'excision';
  const solvedCount = puzzles.filter(p => solved.has(p.id)).length;
  $('progress').textContent = `${solvedCount} / ${puzzles.length} solved`;
  const finished = ['solved', 'incorrect'].includes(state.phase);
  $('instruction').textContent = cutting ? 'excise a chunk ↓' : '← transplant a chunk →';
  $('instruction').className = `instruction ${cutting ? 'excision' : 'transplant'}`;
  $('instruction').style.visibility = finished || !validSelection() ? 'hidden' : 'visible';
  $('clue').textContent = state.puzzle.clue;
  $('selection-copy').textContent = selection ? `Selected ${textOf(selectedChunk())}` : '';
  $('scalpel').className = `scalpel${cutting ? '' : ' locked'}`;
  $('scalpel').setAttribute('aria-disabled', String(!cutting || !validSelection()));
  $('status').textContent = message;
  $('status').className = `status ${messageKind}`;
  $('next-solved').hidden = state.phase !== 'solved';
  $('next-solved').textContent = current === puzzles.length - 1 ? 'Back to start' : 'Next →';
  $('previous').disabled = current === 0;
  $('next').disabled = current === puzzles.length - 1;
  $('puzzle-total').textContent = `/ ${puzzles.length}`;
  const picker = $('puzzle-picker');
  picker.replaceChildren(...puzzles.map((p,i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${i+1}${solved.has(p.id) ? ' ✓' : ''}`;
    return option;
  }));
  picker.value = current;
}

function commitMove(destination) {
  if (!selection) return;
  try {
    state = transplant(state, selection.start, selection.end, destination);
    selection = null; setMessage('');
  } catch (error) { setMessage(error.message, 'error'); }
  render();
}

function commitExcision() {
  if (state.phase !== 'excision') return;
  if (!selection) { setMessage('Select a chunk first.', 'error'); render(); return; }
  try {
    state = excise(state, selection.start, selection.end); selection = null;
    if (state.phase === 'solved') {
      solved.add(state.puzzle.id); saveProgress();
      setMessage(puzzles.every(p => solved.has(p.id)) ? 'Collection complete! 🌿' : 'Nicely done! 🌿', 'success');
    } else setMessage('Not quite. Reset and try again.', 'error');
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
  const inside = validSelection() && index >= selection.start && index < selection.end;
  const anchor = selection?.anchor ?? index;
  const selectedTiles = [...board.querySelectorAll('.letter.selected')];
  const first = selectedTiles[0]?.getBoundingClientRect();
  const last = selectedTiles.at(-1)?.getBoundingClientRect();
  const grabOffset = first && last ? event.clientX - (first.left + last.right) / 2 : 0;
  gesture = {pointer: event.pointerId, mode: inside ? 'pending-drag' : 'select', x: event.clientX, y: event.clientY, anchor, index, grabOffset};
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
    const width = board.querySelector('.letter').getBoundingClientRect().width;
    const gap = board.querySelector('.gap').getBoundingClientRect().width;
    const first = board.querySelector('.letter').getBoundingClientRect();
    const count = selection.end - selection.start;
    drag = {destination: state.phase === 'transplant' ? selection.start : null, overTray: false,
      slotOrigin: first.left + (count * width + (count - 1) * gap) / 2,
      stride: width + gap, grabOffset: gesture.grabOffset};
    const ghost = $('drag-ghost'); ghost.className = `drag-ghost${state.phase === 'excision' ? ' red' : ''}`;
    ghost.replaceChildren(...selectedChunk().map(token => {const span = document.createElement('span'); span.textContent = token.letter; return span;}));
    ghost.hidden = false; renderBoard();
  }
  const ghost = $('drag-ghost'); ghost.style.left = `${event.clientX - (state.phase === 'transplant' ? drag.grabOffset : 0)}px`; ghost.style.top = `${event.clientY}px`;
  if (state.phase === 'transplant') {
    const rect = board.getBoundingClientRect();
    const within = event.clientY >= rect.top-30 && event.clientY <= rect.bottom+30 && event.clientX >= rect.left-20 && event.clientX <= rect.right+20;
    const maximum = state.tokens.length - (selection.end - selection.start);
    const candidate = Math.max(0, Math.min(maximum, Math.round((event.clientX - drag.grabOffset - drag.slotOrigin) / drag.stride)));
    const destination = within ? candidate : null;
    if (drag.destination !== destination) {
      drag.destination = destination;
      renderBoard();
    }
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
document.addEventListener('pointerdown', event => {
  if (!state || !selection || gesture || board.contains(event.target)) return;
  if (state.phase === 'excision' && event.target.closest('#scalpel')) return;
  cancelGesture();
  selection = null;
  render();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && state) {cancelGesture(); selection = null; render();} });
$('reset').addEventListener('click', () => loadPuzzle(current));
$('scalpel').addEventListener('click', () => { if (selection) commitExcision(); });
$('previous').addEventListener('click', () => loadPuzzle(current-1));
$('next').addEventListener('click', () => loadPuzzle(current+1));
$('next-solved').addEventListener('click', () => loadPuzzle((current+1)%puzzles.length));
$('puzzle-picker').addEventListener('change', event => loadPuzzle(Number(event.target.value)));


try {
  const response = await fetch('./puzzles.json?v=chunks2');
  if (!response.ok) throw new Error('The puzzle collection could not be loaded.');
  puzzles = await response.json();
  if (!puzzles.length) throw new Error('The puzzle collection is empty.');
  loadPuzzle(0);
} catch (error) {
  $('clue').textContent = '';
  $('status').textContent = 'Couldn’t load puzzles. Try refreshing.';
  $('status').className = 'status error';
}
