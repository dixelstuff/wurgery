/** Pure game rules. Letter identities survive moves, including repeated letters. */
export function newGame(puzzle) {
  return { puzzle, tokens: [...puzzle.source].map((letter, id) => ({letter, id, moved: false})),
    phase: 'transplant', transplant: null, excision: null };
}

export const textOf = tokens => tokens.map(token => token.letter).join('');

function validRange(tokens, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= end || end > tokens.length)
    throw new Error('Choose a nonempty, continuous chunk of letters.');
}

export function transplant(state, start, end, destination) {
  if (state.phase !== 'transplant') throw new Error('Your transplant is already complete. Reset to change it.');
  validRange(state.tokens, start, end);
  const remainder = [...state.tokens.slice(0, start), ...state.tokens.slice(end)];
  if (!Number.isInteger(destination) || destination < 0 || destination > remainder.length)
    throw new Error('Drop the chunk into a gap between letters.');
  const chunk = state.tokens.slice(start, end).map(token => ({...token, moved: true}));
  const tokens = [...remainder.slice(0, destination), ...chunk, ...remainder.slice(destination)];
  if (textOf(tokens) === textOf(state.tokens)) throw new Error('That leaves the word unchanged. Try a different gap.');
  return {...state, tokens, phase: 'excision', transplant: {
    start, end, destination, chunk: textOf(chunk), before: textOf(state.tokens), after: textOf(tokens)
  }};
}

export function excise(state, start, end) {
  if (state.phase !== 'excision') throw new Error('Complete your transplant first.');
  validRange(state.tokens, start, end);
  const tokens = [...state.tokens.slice(0, start), ...state.tokens.slice(end)];
  if (!tokens.length) throw new Error('Leave some letters on the operating table.');
  const answer = textOf(tokens);
  return {...state, tokens, phase: answer === state.puzzle.target ? 'solved' : 'incorrect', excision: {
    start, end, chunk: textOf(state.tokens.slice(start, end)), before: textOf(state.tokens), after: answer
  }};
}
