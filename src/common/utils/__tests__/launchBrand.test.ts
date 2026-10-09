import {createLaunchBrandTimer, LAUNCH_BRAND_DURATION_MS} from '../launchBrand';

it('holds the launch brand for 2.5 seconds and never adds another delay to OTP handoff or retries', () => {
  const remaining = createLaunchBrandTimer();
  expect(LAUNCH_BRAND_DURATION_MS).toBe(2500);
  expect(remaining(1000)).toBe(2500);
  expect(remaining(2000)).toBe(1500);
  expect(remaining(3500)).toBe(0);
  expect(remaining(10000)).toBe(0);
  expect(createLaunchBrandTimer()(10000)).toBe(2500);
});
