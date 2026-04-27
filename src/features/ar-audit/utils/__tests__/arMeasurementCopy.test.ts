import {
  DEFAULT_AR_CAMERA_STATUS_TEXT,
  DIAMETER_READY_STATUS_TEXT,
  DIRECT_AR_CAMERA_STATUS_TEXT,
  getDefaultArCameraStatusText,
  getHeightInterruptedStatusText,
  getHeightRetryStatusText,
} from '../arMeasurementCopy';

describe('arMeasurementCopy', () => {
  it('preserves the direct-measurement default copy for species-skip testing', () => {
    expect(getDefaultArCameraStatusText(true)).toBe(
      DIRECT_AR_CAMERA_STATUS_TEXT,
    );
  });

  it('returns a height-specific recovery status when diameter is already ready', () => {
    expect(
      getHeightInterruptedStatusText({
        diameterReady: true,
        needsArHeight: true,
        speciesReady: true,
        speciesDetectionDisabled: false,
      }),
    ).toBe('Height not saved - tap Measure Height to continue');
  });

  it('returns a height retry status after an AR height failure', () => {
    expect(
      getHeightRetryStatusText({
        diameterReady: true,
        needsArHeight: true,
        speciesReady: true,
        speciesDetectionDisabled: false,
      }),
    ).toBe('Height not saved - try Measure Height again');
  });

  it('falls back to diameter guidance when species is ready but diameter is not', () => {
    expect(
      getHeightInterruptedStatusText({
        diameterReady: false,
        needsArHeight: true,
        speciesReady: true,
        speciesDetectionDisabled: false,
      }),
    ).toBe(DIAMETER_READY_STATUS_TEXT);
  });

  it('preserves the direct-measurement default copy when no species workflow is required', () => {
    expect(
      getHeightInterruptedStatusText({
        diameterReady: false,
        needsArHeight: true,
        speciesReady: false,
        speciesDetectionDisabled: true,
      }),
    ).toBe(DIRECT_AR_CAMERA_STATUS_TEXT);
    expect(getDefaultArCameraStatusText(false)).toBe(
      DEFAULT_AR_CAMERA_STATUS_TEXT,
    );
  });
});
