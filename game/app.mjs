import {newGame, transplant, excise, textOf} from './model.mjs?v=retained-transplant';

import {transplantPreview, excisionDropContains} from './interaction.mjs?v=caret-move';

const $ = id => document.getElementById(id);
const board = $('word-board');
let puzzles = [], current = 0, state, selection = null, gesture = null, drag = null;
let solved = new Set();
let pendingMove = null;
let message = '', messageKind = '';
try { solved = new Set(JSON.parse(localStorage.getItem('wurgery-solved-chunks2') || '[]')); } catch {}

function saveProgress() {
  try { localStorage.setItem('wurgery-solved-chunks2', JSON.stringify([...solved])); } catch {}
}

function loadPuzzle(index) {
  cancelGesture();
  current = Math.max(0, Math.min(puzzles.length - 1, index));
  state = newGame(puzzles[current]); pendingMove = null; selection = null; message = ''; messageKind = '';
  render();
}

function setMessage(text, kind = '') { message = text; messageKind = kind; }
function selectedChunk() { return selection ? state.tokens.slice(selection.start, selection.end) : []; }
function validSelection() { return selection && selection.end - selection.start >= 2; }

function availableMove(destination) {
  if (!selection || state.phase !== 'transplant') return false;
  try {
    const original = pendingMove?.original ?? state;
    transplant(original, pendingMove?.start ?? selection.start, pendingMove?.end ?? selection.end, destination);
    return true;
  } catch { return false; }
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
      if (event.key === 'Escape') { clearSelection(); }
      if (event.shiftKey && ['ArrowLeft','ArrowRight'].includes(event.key)) {
        event.preventDefault();
        if (pendingMove) return;
        const next = Math.max(0, Math.min(state.tokens.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
        const anchor = selection?.anchor ?? index;
        selection = {start: Math.min(anchor,next), end: Math.max(anchor,next)+1, anchor};
        setMessage('');
        render(); board.querySelector(`[data-index="${next}"]`)?.focus();
      }
    });
    board.append(letter);
  }
}

function selectByClick(index) {
  if (!['transplant','excision'].includes(state.phase)) return;
  if (pendingMove) {
    if (index >= selection.start && index < selection.end) return;
    const identity = state.tokens[index].id;
    state = pendingMove.original;
    pendingMove = null;
    selection = null;
    index = state.tokens.findIndex(token => token.id === identity);
  }
  const anchor = selection?.anchor ?? index;
  selection = {start: Math.min(anchor,index), end: Math.max(anchor,index)+1, anchor};
  setMessage(''); render();
  board.querySelector(`[data-index="${index}"]`)?.focus();
}

function render() {
  renderBoard();
  const solvedCount = puzzles.filter(p => solved.has(p.id)).length;
  $('progress').textContent = `${solvedCount} / ${puzzles.length} solved`;
  const finished = ['solved', 'incorrect'].includes(state.phase);
  $('clue').textContent = state.puzzle.clue;
  $('selection-copy').textContent = selection ? `Selected ${textOf(selectedChunk())}` : '';
  const transplanting = state.phase === 'transplant';
  const ready = Boolean(validSelection()) && !finished;
  $('operation-control').className = `operation-control ${transplanting ? 'transplant' : 'excision'}${ready ? ' ready' : ' locked'}`;
  $('transplant-indicator').hidden = !transplanting;
  $('transplant-indicator').setAttribute('aria-label', ready ? 'Transplant: move the chunk, then tap Transplant to place' : 'Transplant');
  document.querySelectorAll('.direction').forEach(arrow => { arrow.hidden = !transplanting || !ready; });
  $('move-left').disabled = !ready || selection.start <= 0;
  $('move-right').disabled = !ready || selection.end >= state.tokens.length;
  $('place-transplant').disabled = finished;
  $('place-transplant').classList.toggle('can-place', Boolean(pendingMove && ready && availableMove(selection.start)));
  $('scalpel').hidden = transplanting;
  $('scalpel').className = 'scalpel';
  $('scalpel').disabled = finished;
  $('status').textContent = state.phase === 'solved' ? 'Correct!' : state.phase === 'incorrect' ? 'NOPE' : message;
  $('status').className = `status ${messageKind}`;
  $('operation-control').classList.toggle('has-feedback', finished || Boolean(message));
  $('operation-control').classList.toggle('success', state.phase === 'solved');
  $('reset').textContent = state.phase === 'solved' ? 'Next' : 'Reset';
  $('reset').classList.toggle('primary', state.phase === 'solved');
  $('previous').disabled = current === 0;
  $('next').disabled = current === puzzles.length - 1;
  $('puzzle-total').textContent = `/ ${puzzles.length}`;
  $('puzzle-number').textContent = current + 1;
  $('puzzle-completed').hidden = !solved.has(state.puzzle.id);
}

function commitMove(destination) {
  if (!selection) return;
  if (!availableMove(destination)) { setMessage(''); render(); return; }
  try {
    state = transplant(pendingMove?.original ?? state, pendingMove?.start ?? selection.start, pendingMove?.end ?? selection.end, destination);
    pendingMove = null;
    selection = null; setMessage('');
  } catch (error) { setMessage(error.message, 'error'); }
  render();
}

function commitExcision() {
  if (state.phase !== 'excision') return;
  if (!validSelection()) { setMessage('Select 2 or more letters', 'guidance'); render(); return; }
  try {
    state = excise(state, selection.start, selection.end); selection = null;
    if (state.phase === 'solved') {
      solved.add(state.puzzle.id); saveProgress();
      setMessage('');
    } else setMessage('NOPE', 'error');
  } catch (error) { setMessage(error.message, 'error'); }
  render();
}

function clearSelection() {
  cancelGesture();
  if (pendingMove) state = pendingMove.original;
  pendingMove = null;
  selection = null;
  setMessage('');
  render();
}

function nudgeChunk(direction) {
  if (state.phase !== 'transplant' || !validSelection()) return;
  const destination = selection.start + direction;
  const width = selection.end - selection.start;
  if (destination < 0 || destination > state.tokens.length - width) return;
  pendingMove ??= {original: state, start: selection.start, end: selection.end};
  state = {...pendingMove.original, tokens: transplantPreview(pendingMove.original.tokens, pendingMove.start, pendingMove.end, destination)};
  selection = {start: destination, end: destination + width, anchor: destination};
  setMessage('');
  render();
}

function overExcisionTray(x, y) {
  return excisionDropContains(x, y, $('operation-control').getBoundingClientRect(), board.getBoundingClientRect(), window.innerWidth);
}

function cancelGesture() {
  gesture = null; drag = null;
  $('drag-ghost').hidden = true; $('scalpel').classList.remove('drop-hover');
}

board.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !['transplant','excision'].includes(state?.phase)) return;
  const selectedTiles = [...board.querySelectorAll('.letter.selected')];
  let tile = event.target.closest('.letter');
  if (!tile && event.target.closest('.gap') && validSelection()) {
    const first = selectedTiles[0].getBoundingClientRect();
    const last = selectedTiles.at(-1).getBoundingClientRect();
    if (event.clientX >= first.left && event.clientX <= last.right && event.clientY >= first.top && event.clientY <= first.bottom) {
      tile = selectedTiles.reduce((closest, candidate) => {
        const rect = candidate.getBoundingClientRect(), best = closest.getBoundingClientRect();
        return Math.abs(event.clientX - (rect.left + rect.width / 2)) < Math.abs(event.clientX - (best.left + best.width / 2)) ? candidate : closest;
      });
    }
  }
  if (!tile) return;
  event.preventDefault();
  let index = Number(tile.dataset.index);
  if (pendingMove && (index < selection.start || index >= selection.end)) {
    const identity = state.tokens[index].id;
    state = pendingMove.original;
    pendingMove = null;
    selection = null;
    index = state.tokens.findIndex(token => token.id === identity);
  }
  const inside = validSelection() && index >= selection.start && index < selection.end;
  const anchor = selection?.anchor ?? index;
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
    drag.overTray = overExcisionTray(event.clientX, event.clientY);
    $('scalpel').classList.toggle('drop-hover', drag.overTray);
  }
});

board.addEventListener('pointerup', event => {
  if (!gesture || gesture.pointer !== event.pointerId) return;
  const moveDestination = drag?.destination;
  const cut = drag && state.phase === 'excision' && overExcisionTray(event.clientX, event.clientY);
  const wasDragging = Boolean(drag);
  cancelGesture();
  if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
  if (wasDragging && state.phase === 'transplant' && moveDestination !== null) commitMove(moveDestination);
  else if (wasDragging && state.phase === 'excision' && cut) commitExcision();
  else render();
});
board.addEventListener('pointercancel', () => {cancelGesture(); render();});
document.addEventListener('pointerdown', event => {
  if (!state || !selection || gesture || board.contains(event.target)) return;
  if (event.target.closest('#operation-control')) return;
  clearSelection();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && state) {clearSelection();} });
$('move-left').addEventListener('click', () => nudgeChunk(-1));
$('move-right').addEventListener('click', () => nudgeChunk(1));
$('place-transplant').addEventListener('click', () => {
  if (!validSelection()) setMessage('Select 2 or more letters', 'guidance');
  else if (!pendingMove) setMessage('Drag it or use ‹ ›', 'guidance');
  else if (!availableMove(selection.start)) setMessage('');
  else { commitMove(selection.start); return; }
  render();
});
$('reset').addEventListener('click', () => loadPuzzle(state.phase === 'solved' ? (current + 1) % puzzles.length : current));
$('scalpel').addEventListener('click', commitExcision);
$('previous').addEventListener('click', () => loadPuzzle(current-1));
$('next').addEventListener('click', () => loadPuzzle(current+1));


try {
  const response = await fetch('./puzzles.json?v=collection3-levels20');
  if (!response.ok) throw new Error('The puzzle collection could not be loaded.');
  puzzles = await response.json();
  if (!puzzles.length) throw new Error('The puzzle collection is empty.');
  loadPuzzle(0);
} catch (error) {
  $('clue').textContent = '';
  $('status').textContent = 'Couldn’t load puzzles. Try refreshing.';
  $('status').className = 'status error';
}
