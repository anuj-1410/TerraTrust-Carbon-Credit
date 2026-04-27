export const DEFAULT_AR_CAMERA_STATUS_TEXT = 'Point camera at tree trunk';
export const DIRECT_AR_CAMERA_STATUS_TEXT =
  'Point camera at tree trunk and measure directly';
export const DIAMETER_READY_STATUS_TEXT =
  'Species identified - Measure diameter';

interface HeightStatusOptions {
  diameterReady: boolean;
  needsArHeight: boolean;
  speciesReady: boolean;
  speciesDetectionDisabled: boolean;
}

export function getDefaultArCameraStatusText(
  speciesDetectionDisabled: boolean,
): string {
  return speciesDetectionDisabled
    ? DIRECT_AR_CAMERA_STATUS_TEXT
    : DEFAULT_AR_CAMERA_STATUS_TEXT;
}

export function getHeightInterruptedStatusText(
  options: HeightStatusOptions,
): string {
  if (options.diameterReady && options.needsArHeight) {
    return 'Height not saved - tap Measure Height to continue';
  }

  if (options.speciesDetectionDisabled) {
    return getDefaultArCameraStatusText(true);
  }

  if (options.speciesReady) {
    return DIAMETER_READY_STATUS_TEXT;
  }

  return getDefaultArCameraStatusText(options.speciesDetectionDisabled);
}

export function getHeightRetryStatusText(
  options: HeightStatusOptions,
): string {
  if (options.diameterReady && options.needsArHeight) {
    return 'Height not saved - try Measure Height again';
  }

  return getHeightInterruptedStatusText(options);
}
