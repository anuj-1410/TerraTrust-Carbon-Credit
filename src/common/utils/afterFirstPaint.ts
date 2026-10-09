type IdleScheduler = typeof globalThis & {
  requestIdleCallback?: (
    callback: () => void,
    options: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/** Let the destination screen paint before nonessential native/crypto work. */
export function afterFirstPaint(work: () => void): () => void {
  const scheduler = globalThis as IdleScheduler;
  let idle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    if (scheduler.requestIdleCallback) {
      idle = scheduler.requestIdleCallback(work, { timeout: 2000 });
    } else {
      timer = setTimeout(work, 0);
    }
  });
  return () => {
    cancelAnimationFrame(frame);
    if (idle !== undefined) {
      scheduler.cancelIdleCallback?.(idle);
    }
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  };
}
