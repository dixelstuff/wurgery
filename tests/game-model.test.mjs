import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame, transplant, excise, textOf} from '../game/model.mjs';

const puzzles = JSON.parse(readFileSync(new URL('../game/puzzles.json', import.meta.url)));

test('all twenty curated puzzles solve with chunks of at least two letters', () => {
  assert.equal(puzzles.length, 20);
  for (const puzzle of puzzles) {
    const move = puzzle.solution.transplant, cut = puzzle.solution.excision;
    assert.ok(move.end - move.start >= 2 && cut.end - cut.start >= 2);
    const initial = newGame(puzzle);
    const moved = transplant(initial, move.start, move.end, move.destination);
    assert.equal(moved.phase, 'excision');
    assert.equal(textOf(moved.tokens), move.after);
    const complete = excise(moved, cut.start, cut.end);
    assert.equal(complete.phase, 'solved');
    assert.equal(textOf(complete.tokens), puzzle.target);
    assert.deepEqual(initial, newGame(puzzle));
  }
});

test('repeated letters retain their identities through two-letter moves', () => {
  const moved = transplant(newGame({source:'ABABCD'}), 0, 2, 4);
  assert.equal(textOf(moved.tokens), 'ABCDAB');
  assert.deepEqual(moved.tokens.map(t => t.id), [2,3,4,5,0,1]);
  assert.throws(() => transplant(newGame({source:'AAAA'}), 0, 2, 2), /unchanged/);
});

test('reject single letters, bad boundaries, wrong operation order and no-ops', () => {
  const initial = newGame({source:'ABCDEFGH',target:'CDEAB'});
  assert.throws(() => excise(initial, 0, 2), /first/);
  for (const range of [[0,0],[0,1],[-1,2],[1,9],[2,1],[.5,2]])
    assert.throws(() => transplant(initial, ...range, 0));
  assert.throws(() => transplant(initial, 0, 2, 0), /unchanged/);
  assert.throws(() => transplant(initial, 0, 2, 7), /gap/);
  const moved = transplant(initial, 0, 2, 3);
  assert.throws(() => transplant(moved, 0, 2, 2), /already/);
  assert.throws(() => excise(moved, 0, 1), /two/);
  assert.throws(() => excise(moved, 0, 8), /Leave/);
  const incorrect = excise(moved, 0, 2);
  assert.equal(incorrect.phase, 'incorrect');
  assert.deepEqual(newGame(incorrect.puzzle), initial);
  assert.throws(() => excise(incorrect, 0, 2), /first/);
});

test('any legal two-letter-or-longer sequence to the intended answer is accepted', () => {
  const puzzle = {source:'ABCDEFGH',target:'CDEAB'};
  assert.equal(excise(transplant(newGame(puzzle),0,2,3),5,8).phase, 'solved');
  assert.equal(excise(transplant(newGame(puzzle),2,5,0),5,8).phase, 'solved');
});

test('removing the whole transplant cannot solve, including within a larger cut', () => {
  const exact = transplant(newGame({source:'ABCDEFGH',target:'CDEFGH'}),0,2,6);
  assert.equal(excise(exact,6,8).phase, 'incorrect');
  const larger = transplant(newGame({source:'ABCDEFGH',target:'ADEFG'}),1,3,6);
  assert.equal(excise(larger,5,8).phase, 'incorrect');
  // Equal letter values do not count as keeping the original moved letters.
  const repeated = transplant(newGame({source:'ABABCD',target:'ABCD'}),0,2,4);
  assert.equal(excise(repeated,4,6).phase, 'incorrect');
  const retained = transplant(newGame({source:'ABABCD',target:'CDAB'}),0,2,4);
  assert.equal(excise(retained,0,2).phase, 'solved');
});
