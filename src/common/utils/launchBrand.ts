export const LAUNCH_BRAND_DURATION_MS = 2500;

export function createLaunchBrandTimer() {
  let deadline: number | null = null;
  return (now = Date.now()) => {
    deadline ??= now + LAUNCH_BRAND_DURATION_MS;
    return Math.max(0, deadline - now);
  };
}

// Only the first launch display pauses navigation; auth retries stay immediate.
export const launchBrandRemaining = createLaunchBrandTimer();
