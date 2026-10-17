import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame, transplant, excise, textOf} from '../game/model.mjs';

const puzzles = JSON.parse(readFileSync(new URL('../game/puzzles.json', import.meta.url)));

test('all curated puzzles can be solved using their two verified operations', () => {
  for (const puzzle of puzzles) {
    const move = puzzle.solution.transplant, cut = puzzle.solution.excision;
    const initial = newGame(puzzle);
    const moved = transplant(initial, move.start, move.end, move.destination);
    assert.equal(moved.phase, 'excision');
    assert.equal(textOf(moved.tokens), move.after);
    const complete = excise(moved, cut.start, cut.end);
    assert.equal(complete.phase, 'solved');
    assert.equal(textOf(complete.tokens), puzzle.target);
    assert.ok(complete.tokens.some(t => t.moved));
    assert.deepEqual(initial, newGame(puzzle)); // Operations do not mutate earlier state.
  }
});

test('repeated letter identities remain attached to the actual moved chunk', () => {
  const moved = transplant(newGame({source:'ABAC',target:'BACA'}), 0, 1, 3);
  assert.equal(textOf(moved.tokens), 'BACA');
  assert.deepEqual(moved.tokens.filter(t => t.moved).map(t => t.id), [0]);
  assert.deepEqual(moved.tokens.map(t => t.id), [1,2,3,0]);
  assert.throws(() => transplant(newGame({source:'AAAA'}), 0, 1, 3), /unchanged/);
});

test('operation order, boundaries, nonempty cuts and no-op moves are enforced', () => {
  const initial = newGame({source:'ABCD',target:'BCA'});
  assert.throws(() => excise(initial, 0, 1), /first/);
  for (const range of [[0,0],[-1,1],[1,8],[2,1],[.5,2]])
    assert.throws(() => transplant(initial, ...range, 0));
  assert.throws(() => transplant(initial, 0, 1, 0), /unchanged/);
  assert.throws(() => transplant(initial, 0, 1, 4), /gap/);
  const moved = transplant(initial, 0, 1, 3);
  assert.throws(() => transplant(moved, 0, 1, 2), /already/);
  assert.throws(() => excise(moved, 0, 0));
  assert.throws(() => excise(moved, 0, 4), /Leave/);
  const incorrect = excise(moved, 0, 1);
  assert.equal(incorrect.phase, 'incorrect');
  assert.deepEqual(newGame(incorrect.puzzle), initial);
  assert.throws(() => excise(incorrect, 0, 1), /first/);
});

test('different valid sequences to the intended answer are accepted', () => {
  const puzzle = {source:'ABCD',target:'BCA'};
  assert.equal(excise(transplant(newGame(puzzle),0,1,2),3,4).phase, 'solved');
  assert.equal(excise(transplant(newGame(puzzle),0,1,3),2,3).phase, 'solved');
});
