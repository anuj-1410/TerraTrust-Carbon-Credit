import {Linking, NativeModules} from 'react-native';
import type {ARTier} from '../features/ar-audit/store/auditSlice';

export interface ARMeasurementResult {
  diameter_cm: number;
  confidence: number;
  tier_used: 1 | 2;
  point_count: number;
  raw_point_count?: number;
  filtered_point_count?: number;
  inlier_count?: number;
  residual_cm?: number;
  scan_distance_m?: number;
  scan_duration_ms?: number;
  fit_method?: string;
}

export interface SpeciesInferenceResult {
  species: string;
  confidence: number;
  all_scores: number[];
}

export interface HeightMeasurementCompleteResult {
  height_m: number;
}

const {ARModule} = NativeModules;
const AR_TIER_UNRESOLVED_ERROR = 'AR_TIER_UNRESOLVED';
const ARCORE_PLAY_STORE_URL = 'market://details?id=com.google.ar.core';
const ARCORE_WEB_URL =
  'https://play.google.com/store/apps/details?id=com.google.ar.core';

type NativeARSupportStatus =
  | 'FULL_DEPTH'
  | 'SLAM_ONLY'
  | 'UNSUPPORTED'
  | 'CAMERA_PERMISSION_REQUIRED'
  | 'ARCORE_INSTALL_REQUIRED'
  | 'ARCORE_UPDATE_REQUIRED'
  | 'TEMPORARY_UNAVAILABLE'
  | 'CHECKING';

export type ARSupportState =
  | 'checking'
  | 'full-depth'
  | 'slam-only'
  | 'manual'
  | 'camera-permission-required'
  | 'arcore-install-required'
  | 'arcore-update-required'
  | 'temporarily-unavailable';

export interface ARCapabilityDetectionResult {
  tier: ARTier;
  resolved: boolean;
  supportState: ARSupportState;
}

function getResolvedStateForTier(tier: ARTier): ARSupportState {
  if (tier === 1) {
    return 'full-depth';
  }

  if (tier === 2) {
    return 'slam-only';
  }

  return 'manual';
}

function getFallbackCapability(
  fallbackTier?: ARTier,
): ARCapabilityDetectionResult | undefined {
  if (fallbackTier === undefined) {
    return undefined;
  }

  return {
    tier: fallbackTier,
    resolved: true,
    supportState: getResolvedStateForTier(fallbackTier),
  };
}

export async function detectARCapability(
  fallbackCapability?: ARCapabilityDetectionResult,
): Promise<ARCapabilityDetectionResult> {
  try {
    const support: NativeARSupportStatus = await ARModule.checkDepthSupport();

    if (support === 'FULL_DEPTH') {
      return {tier: 1, resolved: true, supportState: 'full-depth'};
    }

    if (support === 'SLAM_ONLY') {
      return {tier: 2, resolved: true, supportState: 'slam-only'};
    }

    if (support === 'UNSUPPORTED') {
      return {tier: 3, resolved: true, supportState: 'manual'};
    }

    if (
      (support === 'TEMPORARY_UNAVAILABLE' || support === 'CHECKING') &&
      fallbackCapability?.resolved
    ) {
      return fallbackCapability;
    }

    if (support === 'CAMERA_PERMISSION_REQUIRED') {
      return {
        tier: fallbackCapability?.tier ?? 3,
        resolved: false,
        supportState: 'camera-permission-required',
      };
    }

    if (support === 'ARCORE_INSTALL_REQUIRED') {
      return {
        tier: fallbackCapability?.tier ?? 3,
        resolved: false,
        supportState: 'arcore-install-required',
      };
    }

    if (support === 'ARCORE_UPDATE_REQUIRED') {
      return {
        tier: fallbackCapability?.tier ?? 3,
        resolved: false,
        supportState: 'arcore-update-required',
      };
    }

    return {
      tier: fallbackCapability?.tier ?? 3,
      resolved: false,
      supportState:
        support === 'CHECKING' ? 'checking' : 'temporarily-unavailable',
    };
  } catch {
    return fallbackCapability ?? {
      tier: 3,
      resolved: true,
      supportState: 'manual',
    };
  }
}

export async function detectARTier(fallbackTier?: ARTier): Promise<ARTier> {
  const capability = await detectARCapability(getFallbackCapability(fallbackTier));

  if (!capability.resolved) {
    throw new Error(AR_TIER_UNRESOLVED_ERROR);
  }

  return capability.tier;
}

export function isARTierUnresolvedError(error: unknown): boolean {
  return (
    error instanceof Error && error.message === AR_TIER_UNRESOLVED_ERROR
  );
}

export async function measureTreeDiameter(
  tier: 1 | 2,
): Promise<ARMeasurementResult> {
  const raw: string = await ARModule.launchDiameterMeasurement(tier);
  return JSON.parse(raw) as ARMeasurementResult;
}

export async function measureTreeHeight(): Promise<HeightMeasurementCompleteResult> {
  const raw: string = await ARModule.launchHeightMeasurement();
  return JSON.parse(raw) as HeightMeasurementCompleteResult;
}

export async function moveAppToBackground(): Promise<boolean> {
  return ARModule.moveTaskToBack();
}

export async function openArCoreStoreListing(): Promise<void> {
  try {
    await Linking.openURL(ARCORE_PLAY_STORE_URL);
  } catch {
    await Linking.openURL(ARCORE_WEB_URL);
  }
}

export async function identifySpecies(
  imageBase64: string,
): Promise<SpeciesInferenceResult> {
  const raw: string = await ARModule.runSpeciesInference(imageBase64);
  return JSON.parse(raw) as SpeciesInferenceResult;
}
