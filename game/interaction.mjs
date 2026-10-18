/** Preview one transplant at several positions without spending extra moves. */
export function transplantPreview(tokens, start, end, destination) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end - start < 2 || end > tokens.length)
    throw new Error('Select at least two letters.');
  const remainder = [...tokens.slice(0, start), ...tokens.slice(end)];
  if (!Number.isInteger(destination) || destination < 0 || destination > remainder.length)
    throw new Error('Invalid transplant position.');
  return [...remainder.slice(0, destination), ...tokens.slice(start, end), ...remainder.slice(destination)];
}

/** A forgiving landing area below the word, including beside the visible tray. */
export function excisionDropContains(x, y, tray, board, viewportWidth) {
  return x >= Math.max(0, tray.left - 32) && x <= Math.min(viewportWidth, tray.right + 32)
    && y >= Math.max(board.bottom + 10, tray.top - 36) && y <= tray.bottom + 40;
}
