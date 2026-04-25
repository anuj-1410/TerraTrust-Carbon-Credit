jest.mock('react-native', () => ({
  NativeModules: {
    ARModule: {
      checkDepthSupport: jest.fn(),
      launchDiameterMeasurement: jest.fn(),
    },
  },
}));

import {NativeModules} from 'react-native';
import {detectARTier, measureTreeDiameter} from '../ar-bridge';

const mockARModule = NativeModules.ARModule as {
  checkDepthSupport: jest.Mock;
  launchDiameterMeasurement: jest.Mock;
};

describe('AR bridge tier detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps FULL_DEPTH support to Tier 1', async () => {
    mockARModule.checkDepthSupport.mockResolvedValue('FULL_DEPTH');

    await expect(detectARTier()).resolves.toBe(1);
  });

  it('maps SLAM_ONLY support to Tier 2', async () => {
    mockARModule.checkDepthSupport.mockResolvedValue('SLAM_ONLY');

    await expect(detectARTier()).resolves.toBe(2);
  });

  it('maps unsupported or failed checks to Tier 3', async () => {
    mockARModule.checkDepthSupport.mockResolvedValueOnce('UNSUPPORTED');
    await expect(detectARTier()).resolves.toBe(3);

    mockARModule.checkDepthSupport.mockRejectedValueOnce(new Error('boom'));
    await expect(detectARTier()).resolves.toBe(3);
  });

  it('keeps Tier 2 on native AR measurement instead of manual fallback', async () => {
    mockARModule.launchDiameterMeasurement.mockResolvedValue(
      '{"diameter_cm":32.4,"confidence":0.82,"tier_used":2,"point_count":88,"filtered_point_count":88,"inlier_count":63,"residual_cm":2.7,"scan_distance_m":0.24,"scan_duration_ms":5100,"fit_method":"gravity_aligned_ransac_circle"}',
    );

    const result = await measureTreeDiameter(2);

    expect(mockARModule.launchDiameterMeasurement).toHaveBeenCalledWith(2);
    expect(result.tier_used).toBe(2);
    expect(result.fit_method).toBe('gravity_aligned_ransac_circle');
    expect(result.inlier_count).toBe(63);
    expect(result.residual_cm).toBe(2.7);
  });
});
