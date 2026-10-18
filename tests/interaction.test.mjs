import test from 'node:test';
import assert from 'node:assert/strict';
import {transplantPreview, excisionDropContains} from '../game/interaction.mjs';
import {newGame, transplant, textOf} from '../game/model.mjs';

test('several caret previews still commit exactly one transplant from the original', () => {
  const initial = newGame({source:'ABCDEFGH',target:'CDEAB'});
  for (const destination of [1,2,3,2,3]) {
    const preview = transplantPreview(initial.tokens,0,2,destination);
    assert.deepEqual(preview.map(t=>t.id).sort((a,b)=>a-b), [0,1,2,3,4,5,6,7]);
    assert.equal(textOf(preview.slice(destination,destination+2)), 'AB');
  }
  const finalPreview = transplantPreview(initial.tokens,0,2,3);
  const committed = transplant(initial,0,2,3);
  assert.deepEqual(committed.tokens,finalPreview);
  assert.equal(committed.transplant.before,'ABCDEFGH');
  assert.equal(committed.phase,'excision');
  assert.equal(initial.phase,'transplant');
});

test('caret previews support repeated letters, returning to the start and both ends', () => {
  const {tokens} = newGame({source:'ABABCD'});
  assert.deepEqual(transplantPreview(tokens,0,2,0),tokens);
  assert.deepEqual(transplantPreview(tokens,0,2,4).map(t=>t.id),[2,3,4,5,0,1]);
  assert.equal(textOf(transplantPreview(tokens,2,4,0)),'ABABCD');
  assert.throws(()=>transplantPreview(tokens,0,1,2));
  assert.throws(()=>transplantPreview(tokens,0,2,5));
});

const tray={left:80,right:310,top:400,bottom:516};
const board={bottom:350};
test('excision accepts near misses beside, above and below the visible tray', () => {
  for (const [x,y] of [[50,420],[340,420],[195,370],[195,550]])
    assert.equal(excisionDropContains(x,y,tray,board,390),true);
});

test('excision generosity stops before the grid and outside the expanded bounds', () => {
  for (const [x,y] of [[195,350],[20,420],[370,420],[195,560]])
    assert.equal(excisionDropContains(x,y,tray,board,390),false);
});
