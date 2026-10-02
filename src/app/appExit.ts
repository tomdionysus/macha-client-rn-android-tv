let leaving: Promise<void> | undefined;

/**
 * Leave the app once everything the viewer would miss has reached the device.
 *
 * Back from Home exits with no confirmation, so Continue Watching and the
 * rest must be persisted first. Storage writes land in memory at once and reach AsyncStorage through a
 * chained queue (`src/state/storage.ts`), so an exit taken mid-queue could
 * lose the last of them; `flush` is that queue's end.
 *
 * Bounded by `budgetMs` (`EXIT_FLUSH_BUDGET_MS`): a write that never
 * finishes must not keep a viewer in an app they have asked to leave. Presses
 * that arrive while it waits join the same exit rather than starting another.
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
