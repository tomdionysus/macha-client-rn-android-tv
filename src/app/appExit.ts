let leaving: Promise<void> | undefined;

/**
 * Exit once queued storage writes (`src/state/storage.ts`) have reached the
 * device, or after `budgetMs` (`EXIT_FLUSH_BUDGET_MS`) so a stuck write cannot
 * hold the viewer in. Presses during the wait join the same exit.
 */
export function exitAfterFlush(flush: () => Promise<unknown>, exit: () => void, budgetMs: number): Promise<void> {
  if (leaving) return leaving;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, budgetMs);
  });
  leaving = Promise.race([flush().then(() => undefined, () => undefined), budget]).then(() => {
    if (timer) clearTimeout(timer);
    leaving = undefined;
    exit();
  });
  return leaving;
}
