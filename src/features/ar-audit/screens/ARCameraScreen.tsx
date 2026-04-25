import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Camera, useCameraDevice} from 'react-native-vision-camera';
import Geolocation from 'react-native-geolocation-service';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type {RootStackParamList} from '../../../types/navigation';
import Badge from '../../../common/components/Badge';
import BottomSheet from '../../../common/components/BottomSheet';
import {isPointInsidePolygon} from '../../../common/utils/geoJson';
import {useAppSelector} from '../../../store/hooks';
import type {SpeciesSource, TreeSample} from '../store/auditSlice';
import {
  measureTreeDiameter,
  measureTreeHeight,
  identifySpecies,
  cancelHeightMeasurement,
} from '../../../services/ar-bridge';
import {hashPhoto, readFileAsBase64} from '../../../common/utils/hash';
import {
  APPROVED_SPECIES,
  APPROVED_SPECIES_NAMES,
  getWoodDensity,
} from '../../../common/constants/species';
import {v4 as uuidv4} from 'uuid';
import {ensureCameraPermission} from '../../../common/utils/permissions';
import {
  IS_AUDIT_DEMO_MODE,
  IS_AUDIT_SPECIES_DETECTION_DISABLED,
  resolveTreeCaptureLocation,
} from '../utils/demoMode';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ARCameraScreen'>;
type RouteType = RouteProp<RootStackParamList, 'ARCameraScreen'>;

type MeasurePhase =
  | 'idle'
  | 'identifying'
  | 'species_done'
  | 'opening_ar'
  | 'result'
  | 'success';

type VisionCameraState = 'starting' | 'active' | 'inactive';

const DEFAULT_STATUS_TEXT = 'Point camera at tree trunk';
const DIRECT_MEASUREMENT_STATUS_TEXT =
  'Point camera at tree trunk and measure directly';
const DIRECT_MEASUREMENT_SPECIES = APPROVED_SPECIES[0]!;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out'));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

const ARCameraScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {zoneId, zoneIndex} = route.params;
  const cameraRef = useRef<Camera>(null);
  const visionCameraStateRef = useRef<VisionCameraState>('starting');
  const visionCameraActiveWaitersRef = useRef<Array<() => void>>([]);
  const visionCameraInactiveWaitersRef = useRef<Array<() => void>>([]);
  const device = useCameraDevice('back');

  const audit = useAppSelector(state => state.audit);
  const gpsHighAccuracy = useAppSelector(
    state => state.profile.settingsHighAccuracyGPS,
  );
  const boundary = useAppSelector(state =>
    state.land.parcels.find(parcel => parcel.id === state.audit.activeLandId)
      ?.boundary_geojson ?? null,
  );
  const {zones, scannedTrees, arTier} = audit;
  const currentZone = zones[zoneIndex] ?? null;
  const returnedDiameter = route.params.returnDiameter;
  const returnedHeight = route.params.returnHeight;
  const resetScanToken = route.params.resetScanToken;

  // State
  const [phase, setPhase] = useState<MeasurePhase>('idle');
  const [statusText, setStatusText] = useState(
    IS_AUDIT_SPECIES_DETECTION_DISABLED
      ? DIRECT_MEASUREMENT_STATUS_TEXT
      : DEFAULT_STATUS_TEXT,
  );

  // Species
  const [speciesName, setSpeciesName] = useState<string | null>(null);
  const [speciesConfidence, setSpeciesConfidence] = useState(0);
  const [speciesSource, setSpeciesSource] = useState<SpeciesSource | null>(null);
  const [speciesResolutionMode, setSpeciesResolutionMode] = useState<
    'none' | 'confirm' | 'manual'
  >('none');
  const [suggestedSpecies, setSuggestedSpecies] = useState<string | null>(null);
  const [suggestedConfidence, setSuggestedConfidence] = useState(0);
  const [woodDensity, setWoodDensity] = useState(0);

  // Measurement
  const [diameterCm, setDiameterCm] = useState<number | null>(null);
  const [arHeightM, setArHeightM] = useState<number | null>(null);
  const [measureConfidence, setMeasureConfidence] = useState(0);
  const [tierUsed, setTierUsed] = useState<1 | 2 | 3>(arTier as 1 | 2 | 3);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [, setConsecutiveHeightFailures] = useState(0);

  // Evidence
  const [evidenceBase64, setEvidenceBase64] = useState<string | null>(null);
  const [evidenceHash, setEvidenceHash] = useState<string | null>(null);

  // GPS from last known position (simplified — gets from geolocation)
  const [gpsLat, setGpsLat] = useState(0);
  const [gpsLng, setGpsLng] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState(0);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isVisionCameraActive, setIsVisionCameraActive] = useState(true);

  const resolveVisionCameraWaiters = useCallback(
    (nextState: Extract<VisionCameraState, 'active' | 'inactive'>) => {
      visionCameraStateRef.current = nextState;
      const waitersRef =
        nextState === 'active'
          ? visionCameraActiveWaitersRef
          : visionCameraInactiveWaitersRef;
      const pendingWaiters = waitersRef.current;
      waitersRef.current = [];
      pendingWaiters.forEach(resolve => resolve());
    },
    [],
  );

  const waitForVisionCameraState = useCallback(
    (
      targetState: Extract<VisionCameraState, 'active' | 'inactive'>,
      timeoutMs = 5000,
    ) =>
      new Promise<void>((resolve, reject) => {
        if (visionCameraStateRef.current === targetState) {
          resolve();
          return;
        }

        const waitersRef =
          targetState === 'active'
            ? visionCameraActiveWaitersRef
            : visionCameraInactiveWaitersRef;

        let timeoutId: ReturnType<typeof setTimeout>;
        const resolveWaiter = () => {
          clearTimeout(timeoutId);
          waitersRef.current = waitersRef.current.filter(
            waiter => waiter !== resolveWaiter,
          );
          resolve();
        };

        timeoutId = setTimeout(() => {
          waitersRef.current = waitersRef.current.filter(
            waiter => waiter !== resolveWaiter,
          );
          reject(new Error(`Camera failed to become ${targetState} within 5 seconds`));
        }, timeoutMs);

        waitersRef.current.push(resolveWaiter);
      }),
    [],
  );

  const setVisionCameraDesiredActive = useCallback((nextActive: boolean) => {
    if (nextActive && visionCameraStateRef.current === 'inactive') {
      visionCameraStateRef.current = 'starting';
    }

    setIsVisionCameraActive(nextActive);
  }, []);

  const ensureVisionCameraActive = useCallback(async () => {
    if (visionCameraStateRef.current === 'active' && isVisionCameraActive) {
      return;
    }

    setVisionCameraDesiredActive(true);

    // CRITICAL FIX: Wait for React state to propagate before waiting for callbacks
    // This ensures the Camera component receives isActive={true} before we start waiting
    await new Promise(resolve => setTimeout(resolve, 50));

    await waitForVisionCameraState('active');
  }, [isVisionCameraActive, setVisionCameraDesiredActive, waitForVisionCameraState]);

  const ensureVisionCameraInactive = useCallback(async () => {
    if (visionCameraStateRef.current === 'inactive' && !isVisionCameraActive) {
      return;
    }

    setVisionCameraDesiredActive(false);

    // CRITICAL FIX: Wait for React state to propagate before waiting for callbacks
    // This ensures the Camera component receives isActive={false} before we start waiting
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      await waitForVisionCameraState('inactive');
    } catch (error) {
      // Some devices dispatch stop callbacks late or not at all even after the
      // camera device starts closing. Continue with an extra guard delay so ARCore
      // can still attempt acquisition and use native retry/error handling.
      if (__DEV__) {
        console.warn('VisionCamera inactive callback timeout, continuing with delay', error);
      }
      visionCameraStateRef.current = 'inactive';
      await new Promise(resolve => setTimeout(resolve, 650));
    }
  }, [isVisionCameraActive, setVisionCameraDesiredActive, waitForVisionCameraState]);

  const runWithExclusiveArCameraAccess = useCallback(
    async function <T>(
      operation: () => Promise<T>,
      options?: {resumeVisionCamera?: boolean},
    ): Promise<T> {
      if (__DEV__) {
        console.log('VisionCamera transitioning to inactive');
      }
      await ensureVisionCameraInactive();

      if (__DEV__) {
        console.log('VisionCamera inactive, waiting 250ms');
      }
      // Add post-inactive delay to ensure camera device is fully released
      await new Promise(resolve => setTimeout(resolve, 300));

      if (__DEV__) {
        console.log('Launching ARMeasurementActivity');
      }
      try {
        return await operation();
      } finally {
        if (options?.resumeVisionCamera !== false) {
          await ensureVisionCameraActive().catch(() => undefined);
        }
      }
    },
    [ensureVisionCameraActive, ensureVisionCameraInactive],
  );

  const takeVisionCameraSnapshot = useCallback(async () => {
    await ensureVisionCameraActive();

    if (!cameraRef.current) {
      throw new Error('Camera preview is not ready yet.');
    }

    return cameraRef.current.takeSnapshot({quality: 80});
  }, [ensureVisionCameraActive]);

  const captureEvidencePhoto = useCallback(async () => {
    const snapshot = await takeVisionCameraSnapshot();
    const nextEvidenceBase64 = await readFileAsBase64(snapshot.path);
    const nextEvidenceHash = await hashPhoto(nextEvidenceBase64);
    setEvidenceBase64(nextEvidenceBase64);
    setEvidenceHash(nextEvidenceHash);
    return {
      base64: nextEvidenceBase64,
      hash: nextEvidenceHash,
    };
  }, [takeVisionCameraSnapshot]);

  const resetScanState = useCallback(() => {
    void cancelHeightMeasurement().catch(() => undefined);
    setVisionCameraDesiredActive(true);
    setPhase('idle');
    setStatusText(
      IS_AUDIT_SPECIES_DETECTION_DISABLED
        ? DIRECT_MEASUREMENT_STATUS_TEXT
        : DEFAULT_STATUS_TEXT,
    );
    setSpeciesName(null);
    setSpeciesConfidence(0);
    setSpeciesSource(null);
    setSpeciesResolutionMode('none');
    setSuggestedSpecies(null);
    setSuggestedConfidence(0);
    setWoodDensity(0);
    setDiameterCm(null);
    setArHeightM(null);
    setMeasureConfidence(0);
    setTierUsed(arTier as 1 | 2 | 3);
    setConsecutiveFailures(0);
    setConsecutiveHeightFailures(0);
    setEvidenceBase64(null);
    setEvidenceHash(null);
  }, [arTier, setVisionCameraDesiredActive]);

  useEffect(() => {
    let mounted = true;

    const requestCameraAccess = async () => {
      const cameraGranted = await ensureCameraPermission();
      const visionCameraGranted =
        (await Camera.getCameraPermissionStatus()) === 'granted' ||
        (await Camera.requestCameraPermission()) === 'granted';

      if (mounted) {
        setHasCameraPermission(cameraGranted && visionCameraGranted);
      }
    };

    void requestCameraAccess();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!resetScanToken) {
      return;
    }

    resetScanState();
  }, [resetScanState, resetScanToken]);

  // Wire returnDiameter from ManualMeasureScreen (T031)
  useEffect(() => {
    if (returnedDiameter != null) {
      setDiameterCm(returnedDiameter);
      setTierUsed(3);
      setMeasureConfidence(1.0);
      setSpeciesConfidence(currentConfidence => currentConfidence || 1.0);
      setPhase('result');
      setStatusText('Manual measurement received');
    }
  }, [returnedDiameter]);

  useEffect(() => {
    if (returnedHeight != null) {
      setArHeightM(returnedHeight);
      setConsecutiveHeightFailures(0);
      setPhase(diameterCm !== null ? 'result' : 'species_done');
      setStatusText(`Height entered: ${returnedHeight.toFixed(1)} m`);
    }
  }, [diameterCm, returnedHeight]);

  // GPS location for tree capture
  useEffect(() => {
    const watchId = Geolocation.watchPosition(
      pos => {
        setGpsLat(pos.coords.latitude);
        setGpsLng(pos.coords.longitude);
        setGpsAccuracy(pos.coords.accuracy);
      },
      () => {},
      {enableHighAccuracy: gpsHighAccuracy, distanceFilter: 1, interval: 3000},
    );
    return () => Geolocation.clearWatch(watchId);
  }, [gpsHighAccuracy]);

  const treesInCurrentZone = scannedTrees.filter(
    tree => tree.zone_id === currentZone?.zone_id,
  ).length;
  const zoneProgressLabel = currentZone?.label ?? `Zone ${zoneIndex + 1}`;
  const maxTreesPerZone = 5;
  const resolvedSpeciesName = IS_AUDIT_SPECIES_DETECTION_DISABLED
    ? DIRECT_MEASUREMENT_SPECIES.name
    : speciesName;
  const resolvedSpeciesConfidence = IS_AUDIT_SPECIES_DETECTION_DISABLED
    ? 1
    : speciesConfidence;
  const resolvedSpeciesSource = IS_AUDIT_SPECIES_DETECTION_DISABLED
    ? ('MANUAL_SELECTED' as const)
    : speciesSource;
  const resolvedWoodDensity = IS_AUDIT_SPECIES_DETECTION_DISABLED
    ? DIRECT_MEASUREMENT_SPECIES.woodDensity
    : woodDensity;
  const needsArHeight = Boolean(currentZone && !currentZone.gedi_available);
  const canMeasureArHeight = needsArHeight && arTier !== 3;
  const requiresArHeightBeforeSave = needsArHeight;
  const canStartDiameterMeasurement = Boolean(resolvedSpeciesName);
  const canStartHeightMeasurement = canStartDiameterMeasurement && needsArHeight;

  useEffect(() => {
    return () => {
      void cancelHeightMeasurement().catch(() => undefined);
    };
  }, []);

  const applySpeciesSelection = useCallback(
    (
      nextSpecies: string,
      nextConfidence: number,
      nextSource: SpeciesSource,
    ) => {
      setSpeciesName(nextSpecies);
      setSpeciesConfidence(nextConfidence);
      setSpeciesSource(nextSource);
      setWoodDensity(getWoodDensity(nextSpecies) ?? 0);
      setSpeciesResolutionMode('none');
      setSuggestedSpecies(null);
      setSuggestedConfidence(0);
      setPhase('species_done');
      setStatusText('Species identified - Measure diameter');
    },
    [],
  );

  const openManualSpeciesPicker = useCallback((confidence: number) => {
    setSuggestedSpecies(null);
    setSuggestedConfidence(confidence);
    setSpeciesResolutionMode('manual');
    setPhase('idle');
    setStatusText('Select the correct approved species');
  }, []);

  // ──── IDENTIFY SPECIES ────
  const handleIdentifySpecies = useCallback(async () => {
    if (IS_AUDIT_SPECIES_DETECTION_DISABLED) {
      return;
    }

    if (!cameraRef.current) return;
    try {
      setSpeciesName(null);
      setSpeciesConfidence(0);
      setSpeciesSource(null);
      setWoodDensity(0);
      setSpeciesResolutionMode('none');
      setSuggestedSpecies(null);
      setSuggestedConfidence(0);
      setPhase('identifying');
      setStatusText('Identifying species...');
      const snapshot = await takeVisionCameraSnapshot();
      const imgBase64 = await readFileAsBase64(snapshot.path);

      const result = await withTimeout(identifySpecies(imgBase64), 10000);

      const isApprovedSpecies = APPROVED_SPECIES_NAMES.includes(result.species);

      if (!isApprovedSpecies) {
        Alert.alert(
          'Species Not Eligible',
          'This species is not eligible for carbon credits. Please scan a different tree.',
        );
        setSpeciesResolutionMode('none');
        setPhase('idle');
        setStatusText(DEFAULT_STATUS_TEXT);
        return;
      }

      if (result.confidence >= 0.8) {
        applySpeciesSelection(result.species, result.confidence, 'MODEL_AUTO');
        return;
      }

      if (result.confidence >= 0.6) {
        setSuggestedSpecies(result.species);
        setSuggestedConfidence(result.confidence);
        setSpeciesResolutionMode('confirm');
        setPhase('idle');
        setStatusText('Confirm the detected species');
        return;
      }

      openManualSpeciesPicker(result.confidence);
    } catch {
      Alert.alert('Species ID Failed', 'Could not identify species. Please try again.');
      setSpeciesResolutionMode('none');
      setPhase('idle');
      setStatusText(DEFAULT_STATUS_TEXT);
    }
  }, [applySpeciesSelection, openManualSpeciesPicker, takeVisionCameraSnapshot]);

  // ──── MEASURE DIAMETER ────
  const handleMeasureDiameter = useCallback(async () => {
    if (arTier === 3) {
      navigation.navigate('ManualMeasureScreen', {
        zoneId,
        zoneIndex,
        mode: 'diameter',
      });
      return;
    }

    try {
      setPhase('opening_ar');
      setStatusText('Opening AR measurement...');

      const result = await runWithExclusiveArCameraAccess(() =>
        measureTreeDiameter(arTier as 1 | 2),
      );

      // FR-021: confidence < 0.7 → retry
      if (result.confidence < 0.7) {
        // Use functional updater and read the new value synchronously via a ref-like pattern
        setConsecutiveFailures(prev => {
          const next = prev + 1;
          if (next >= 3) {
            navigation.navigate('ManualMeasureScreen', {
              zoneId,
              zoneIndex,
              mode: 'diameter',
            });
          } else {
            Alert.alert(
              'Low Confidence',
              'Move closer to the tree and hold still, then try again.',
            );
            setPhase('species_done');
            setStatusText('Try again — Measure diameter');
          }
          return next;
        });
        return;
      }

      // FR-022: unusual DBH
      if (result.diameter_cm < 5 || result.diameter_cm > 200) {
        setConsecutiveFailures(prev => {
          const next = prev + 1;
          if (next >= 3) {
            navigation.navigate('ManualMeasureScreen', {
              zoneId,
              zoneIndex,
              mode: 'diameter',
            });
          } else {
            Alert.alert(
              'Unusual Measurement',
              'This seems unusual. Please measure again.',
            );
            setPhase('species_done');
            setStatusText('Try again — Measure diameter');
          }
          return next;
        });
        return;
      }

      // Success — capture evidence photo
      setConsecutiveFailures(0);
      setDiameterCm(result.diameter_cm);
      setMeasureConfidence(result.confidence);
      setTierUsed(result.tier_used);

      // Try evidence capture, but do not fail a successful AR measurement if
      // snapshot capture races while VisionCamera is recovering.
      try {
        await captureEvidencePhoto();
      } catch {
        // Accept measurement result and let save flow re-capture evidence later.
      }

      ReactNativeHapticFeedback.trigger('impactMedium');
      setPhase('result');
      setStatusText('Measurement complete');
    } catch (err: unknown) {
      // Distinguish user cancellation (back press) from a real AR failure
      const errorCode =
        err != null &&
        typeof err === 'object' &&
        'code' in err
          ? (err as {code: string}).code
          : '';

      if (errorCode === 'MEASUREMENT_CANCELLED') {
        // User pressed back inside the AR activity — not a failure, just reset quietly
        setPhase(
          IS_AUDIT_SPECIES_DETECTION_DISABLED ? 'species_done' : (speciesName ? 'species_done' : 'idle'),
        );
        setStatusText(
          speciesName
            ? 'Try again — Measure diameter'
            : (IS_AUDIT_SPECIES_DETECTION_DISABLED
                ? DIRECT_MEASUREMENT_STATUS_TEXT
                : DEFAULT_STATUS_TEXT),
        );
        return;
      }

      if (errorCode === 'CAMERA_IN_USE') {
        // Camera access conflict - provide specific error message
        Alert.alert(
          'Camera Unavailable',
          'The camera is currently in use. Please wait a moment and try again.',
        );
        setPhase('species_done');
        setStatusText('Try again — Measure diameter');
        return;
      }

      const errorMessage =
        err != null &&
        typeof err === 'object' &&
        'message' in err &&
        typeof (err as {message?: unknown}).message === 'string'
          ? (err as {message: string}).message
          : '';

      setConsecutiveFailures(prev => {
        const next = prev + 1;
        if (next >= 3) {
          navigation.navigate('ManualMeasureScreen', {
            zoneId,
            zoneIndex,
            mode: 'diameter',
          });
        } else {
          Alert.alert(
            'Measurement Failed',
            errorMessage || 'Move closer to the tree and hold still, then try again.',
          );
          setPhase('species_done');
          setStatusText('Try again — Measure diameter');
        }
        return next;
      });
    }
  }, [
    arTier,
    captureEvidencePhoto,
    navigation,
    runWithExclusiveArCameraAccess,
    speciesName,
    zoneId,
    zoneIndex,
  ]);

  const handleStartHeightMeasurement = useCallback(async () => {
    if (!needsArHeight) {
      return;
    }

    if (!canMeasureArHeight) {
      navigation.navigate('ManualMeasureScreen', {
        zoneId,
        zoneIndex,
        mode: 'height',
      });
      return;
    }

    try {
      setPhase('opening_ar');
      setStatusText('Opening AR height measurement...');
      const result = await runWithExclusiveArCameraAccess(() =>
        measureTreeHeight(),
      );
      const heightM = result.height_m ?? null;
      setArHeightM(heightM);
      setConsecutiveHeightFailures(0);
      ReactNativeHapticFeedback.trigger('impactMedium');
      setStatusText(
        heightM !== null
          ? `Height measured: ${heightM.toFixed(1)} m`
          : 'Height measured',
      );
      setPhase(diameterCm !== null ? 'result' : 'species_done');
    } catch (error: unknown) {
      const errorCode =
        error != null &&
        typeof error === 'object' &&
        'code' in error
          ? (error as {code: string}).code
          : '';
      const errorMessage =
        error != null &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as {message?: unknown}).message === 'string'
          ? (error as {message: string}).message
          : '';

      if (errorCode === 'HEIGHT_CAPTURE_CANCELLED') {
        setStatusText(
          diameterCm !== null
            ? 'Measurement complete'
            : 'Species identified - Measure diameter',
        );
        setPhase(diameterCm !== null ? 'result' : 'species_done');
        return;
      }

      if (errorCode === 'CAMERA_IN_USE') {
        Alert.alert(
          'Camera Unavailable',
          'The camera is currently in use. Please wait a moment and try again.',
        );
        setStatusText(
          diameterCm !== null
            ? 'Measurement complete'
            : 'Species identified - Measure diameter',
        );
        setPhase(diameterCm !== null ? 'result' : 'species_done');
        return;
      }

      Alert.alert(
        'Height Measurement Unavailable',
        errorMessage || 'Could not complete AR height measurement. Please try again.',
      );
      setConsecutiveHeightFailures(prev => {
        const next = prev + 1;
        if (next >= 3) {
          navigation.navigate('ManualMeasureScreen', {
            zoneId,
            zoneIndex,
            mode: 'height',
          });
        }
        return next;
      });
      setStatusText(
        diameterCm !== null
          ? 'Measurement complete'
          : 'Species identified — Measure diameter',
      );
      setPhase(diameterCm !== null ? 'result' : 'species_done');
    }
  }, [
    canMeasureArHeight,
    diameterCm,
    navigation,
    needsArHeight,
    runWithExclusiveArCameraAccess,
    zoneId,
    zoneIndex,
  ]);

  const handleAcceptSave = useCallback(async () => {
    if (!resolvedSpeciesName || !resolvedSpeciesSource || diameterCm === null) {
      return;
    }

    if (requiresArHeightBeforeSave && arHeightM === null) {
      Alert.alert(
        'Add Height First',
        'This zone has no GEDI satellite height data, so measure or enter tree height before saving.',
      );
      return;
    }

    if (!IS_AUDIT_DEMO_MODE && gpsAccuracy > 30) {
      Alert.alert(
        'Weak GPS Signal',
        'GPS accuracy is too weak to save this tree. Move to an open area and try again.',
      );
      return;
    }

    if (
      !IS_AUDIT_DEMO_MODE &&
      boundary &&
      !isPointInsidePolygon({lat: gpsLat, lng: gpsLng}, boundary)
    ) {
      Alert.alert(
        'Outside Registered Land',
        'You appear to be outside your registered land boundary. Please return to your land before saving this tree scan.',
      );
      return;
    }

    let nextEvidenceBase64 = evidenceBase64;
    let nextEvidenceHash = evidenceHash;

    if (!nextEvidenceBase64 || !nextEvidenceHash) {
      const evidencePhoto = await captureEvidencePhoto();
      nextEvidenceBase64 = evidencePhoto.base64;
      nextEvidenceHash = evidencePhoto.hash;
    }

    const resolvedLocation = resolveTreeCaptureLocation(
      currentZone,
      gpsLat,
      gpsLng,
      gpsAccuracy,
    );

    const pendingTree: TreeSample = {
      tree_id: uuidv4(),
      zone_id: zoneId,
      species: resolvedSpeciesName,
      species_confidence: resolvedSpeciesConfidence,
      species_source: resolvedSpeciesSource,
      dbh_cm: Math.round(diameterCm * 10) / 10,
      wood_density: resolvedWoodDensity,
      ar_height_m: needsArHeight ? arHeightM : null,
      measurement_tier: tierUsed,
      confidence_score: measureConfidence,
      gps_lat: resolvedLocation.gpsLat,
      gps_lng: resolvedLocation.gpsLng,
      gps_accuracy_m: resolvedLocation.gpsAccuracy,
      evidence_photo_base64: nextEvidenceBase64 ?? '',
      evidence_photo_hash: nextEvidenceHash ?? '',
      scan_timestamp: new Date().toISOString(),
    };

    navigation.navigate('TreeResultScreen', {pendingTree});
  }, [
    arHeightM,
    diameterCm,
    needsArHeight,
    requiresArHeightBeforeSave,
    tierUsed,
    measureConfidence,
    gpsLat,
    gpsLng,
    gpsAccuracy,
    boundary,
    evidenceBase64,
    evidenceHash,
    zoneId,
    navigation,
    captureEvidencePhoto,
    currentZone,
    resolvedSpeciesName,
    resolvedSpeciesConfidence,
    resolvedSpeciesSource,
    resolvedWoodDensity,
  ]);

  const handleRetry = useCallback(() => {
    setDiameterCm(null);
    setPhase('species_done');
    setStatusText('Try again — Measure diameter');
  }, []);

  const precisionBadge = (() => {
    if (tierUsed === 1) {
      return {label: 'High Precision', variant: 'high-precision' as const};
    }

    if (tierUsed === 2) {
      return {label: 'Standard Precision', variant: 'standard-precision' as const};
    }

    return {label: 'Manual Measurement', variant: 'manual' as const};
  })();

  if (hasCameraPermission === false) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Text className="text-center text-lg font-semibold text-white">
          Camera permission is required to scan trees.
        </Text>
        <TouchableOpacity
          onPress={() => {
            void Camera.requestCameraPermission().then(status => {
              setHasCameraPermission(status === 'granted');
            });
          }}
          className="mt-6 rounded-xl bg-[#2D6A4F] px-6 py-3">
          <Text className="font-bold text-white">Allow Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasCameraPermission === null) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-lg text-white">Checking camera permission...</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white text-lg">No camera device found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Camera full screen */}
      <Camera
        ref={cameraRef}
        style={{flex: 1, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
        device={device}
        isActive={isVisionCameraActive && phase !== 'success'}
        onStarted={() => resolveVisionCameraWaiters('active')}
        onStopped={() => resolveVisionCameraWaiters('inactive')}
        onPreviewStarted={() => resolveVisionCameraWaiters('active')}
        onPreviewStopped={() => resolveVisionCameraWaiters('inactive')}
        photo
      />

      {/* Top bar overlay */}
      <View className="absolute top-0 left-0 right-0 pt-12 pb-3 px-5 flex-row items-center bg-black/50">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-12 h-12 items-center justify-center">
          <MaterialCommunityIcons color="#FFFFFF" name="arrow-left" size={24} />
        </TouchableOpacity>
        <Text className="flex-1 text-white text-base text-center">
          {statusText}
        </Text>
        <View className="rounded-2xl bg-white/20 px-3 py-1.5">
          <Text className="text-center text-[11px] font-semibold text-white">
            {zoneProgressLabel}
          </Text>
          <Text className="text-center text-sm font-bold text-white">
            {treesInCurrentZone}/{maxTreesPerZone} trees
          </Text>
        </View>
      </View>

      {/* Crosshair reticle */}
      {phase !== 'result' && phase !== 'success' && phase !== 'opening_ar' && (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          {/* Horizontal line */}
          <View className="absolute w-20 h-px bg-white/80" />
          {/* Vertical line */}
          <View className="absolute w-px h-20 bg-white/80" />
          {/* Center circle */}
          <View className="w-10 h-10 rounded-full border-2 border-white/80" />
        </View>
      )}

      {/* Species overlay card — visible after identification */}
      {speciesName &&
      phase !== 'idle' &&
      phase !== 'identifying' &&
      phase !== 'success' &&
      phase !== 'opening_ar' && (
        <View className="absolute top-28 left-5 right-5 bg-black/60 rounded-2xl p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <MaterialCommunityIcons color="#FFFFFF" name="sprout" size={18} />
              <Text className="ml-2 text-white text-lg font-bold">
                {speciesName}
              </Text>
            </View>
            <Text className="text-[#4ADE80] text-base font-bold">
              {Math.round(speciesConfidence * 100)}%
            </Text>
          </View>
          <Text
            className="text-white/70 text-xs mt-1"
            style={{fontFamily: 'RobotoMono-Regular'}}>
            Density: {woodDensity.toFixed(2)} g/cm³
          </Text>
        </View>
      )}

      {phase === 'opening_ar' && (
        <View className="absolute inset-0 items-center justify-center bg-black/55 px-8">
          <View className="items-center rounded-3xl bg-black/70 px-8 py-7">
            <ActivityIndicator color="#4ADE80" size="large" />
            <Text className="mt-4 text-center text-lg font-semibold text-white">
              {statusText}
            </Text>
            <Text className="mt-2 text-center text-sm text-white/75">
              Releasing the preview camera and handing off to TerraTrust AR.
            </Text>
          </View>
        </View>
      )}

      {/* Bottom action buttons */}
      {speciesResolutionMode === 'none' &&
      (phase === 'idle' || phase === 'species_done') ? (
        <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-6 bg-gradient-to-t from-black/80">
          <View className="flex-row items-center">
            {!IS_AUDIT_SPECIES_DETECTION_DISABLED ? (
              <TouchableOpacity
                onPress={handleIdentifySpecies}
                className="mx-1 flex-1 rounded-xl border-2 items-center justify-center px-3 py-3"
                style={{
                  borderColor: speciesName ? 'rgba(74, 222, 128, 0.85)' : 'rgba(255,255,255,0.6)',
                  backgroundColor: speciesName ? 'rgba(34, 197, 94, 0.18)' : 'transparent',
                }}>
                <MaterialCommunityIcons
                  color="#FFFFFF"
                  name={speciesName ? 'check-circle-outline' : 'magnify'}
                  size={18}
                />
                <Text className="mt-1 text-center text-xs font-semibold text-white">
                  {speciesName ? 'Species Ready' : 'Identify Species'}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={() => {
                void handleMeasureDiameter();
              }}
              disabled={!canStartDiameterMeasurement}
              className="mx-1 flex-1 rounded-xl items-center justify-center px-3 py-3"
              style={{
                backgroundColor: canStartDiameterMeasurement
                  ? '#2D6A4F'
                  : 'rgba(107, 114, 128, 0.75)',
              }}>
              <MaterialCommunityIcons color="#FFFFFF" name="ruler" size={18} />
              <Text className="mt-1 text-center text-xs font-semibold text-white">
                Measure Diameter
              </Text>
            </TouchableOpacity>

            {needsArHeight ? (
              <TouchableOpacity
                onPress={() => {
                  void handleStartHeightMeasurement();
                }}
                disabled={!canStartHeightMeasurement}
                className="mx-1 flex-1 rounded-xl items-center justify-center px-3 py-3"
                style={{
                  backgroundColor: canStartHeightMeasurement
                    ? '#2D6A4F'
                    : 'rgba(107, 114, 128, 0.75)',
                }}>
                <MaterialCommunityIcons color="#FFFFFF" name="arrow-expand-vertical" size={18} />
                <Text className="mt-1 text-center text-xs font-semibold text-white">
                  {canMeasureArHeight ? 'Measure Height' : 'Enter Height'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Measurement result bottom sheet */}
      {phase === 'result' && diameterCm !== null && (
        <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl px-5 pt-3 pb-8">
          {/* Handle bar */}
          <View className="self-center w-10 h-1 bg-[#D1D5DB] rounded-full mb-4" />

          <Text className="text-[#6B7280] text-sm mb-1">Diameter</Text>
          <Text
            className="text-[#191C1B] text-4xl font-bold mb-3"
            style={{fontFamily: 'RobotoMono-Bold'}}>
            {diameterCm.toFixed(1)} cm
          </Text>

          {/* Precision badge */}
          <View className="mb-3 self-start">
            <Badge label={precisionBadge.label} variant={precisionBadge.variant} />
          </View>

          {/* Confidence */}
          <View className="flex-row items-center mb-5">
            <Text className="text-[#6B7280] text-sm mr-2">Confidence</Text>
            <View className="flex-1 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
              <View
                className="h-full bg-[#2D6A4F] rounded-full"
                style={{width: `${Math.round(measureConfidence * 100)}%`}}
              />
            </View>
            <Text
              className="text-[#191C1B] text-sm font-bold ml-2"
              style={{fontFamily: 'RobotoMono-Regular'}}>
              {Math.round(measureConfidence * 100)}%
            </Text>
          </View>

          <View className="mb-5">
            <Text className="text-[#6B7280] text-sm mb-1">Height</Text>
            <Text
              className="text-[#191C1B] text-lg font-bold"
              style={{fontFamily: 'RobotoMono-Regular'}}>
              {needsArHeight
                ? arHeightM !== null
                  ? `${arHeightM.toFixed(1)} m`
                  : canMeasureArHeight
                    ? 'Not measured yet'
                    : 'Manual height required'
                : 'From GEDI Satellite'}
            </Text>
          </View>

          {needsArHeight && arHeightM === null && (
            <TouchableOpacity
              onPress={() => {
                void handleStartHeightMeasurement();
              }}
              className="mb-3 h-12 rounded-xl border-2 border-[#2D6A4F] items-center justify-center">
              <Text className="text-[#2D6A4F] text-base font-semibold">
                {canMeasureArHeight ? 'Measure Height' : 'Enter Height'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Buttons */}
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={handleRetry}
              className="flex-1 h-14 rounded-xl border-2 border-[#D1D5DB] items-center justify-center">
              <Text className="text-[#6B7280] text-base font-semibold">
                Retry
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                void handleAcceptSave();
              }}
              disabled={requiresArHeightBeforeSave && arHeightM === null}
              className="flex-1 h-14 rounded-xl items-center justify-center"
              style={{
                backgroundColor:
                  requiresArHeightBeforeSave && arHeightM === null
                    ? 'rgba(45,106,79,0.5)'
                    : '#2D6A4F',
              }}>
              <Text className="text-white text-base font-bold">
                Accept & Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Scan success Lottie overlay */}
      <BottomSheet
        visible={speciesResolutionMode === 'confirm'}
        onClose={() => {
          setSpeciesResolutionMode('none');
          setStatusText(DEFAULT_STATUS_TEXT);
        }}>
        <Text className="text-lg font-bold" style={{color: '#191C1B'}}>
          Is this the correct species?
        </Text>
        <Text className="mt-3 leading-6" style={{color: '#6B7280'}}>
          TerraTrust detected {suggestedSpecies ?? 'this tree'} with {Math.round(suggestedConfidence * 100)}% confidence.
        </Text>
        <TouchableOpacity
          className="mt-6 h-12 rounded-xl items-center justify-center"
          style={{backgroundColor: '#2D6A4F'}}
          onPress={() => {
            if (!suggestedSpecies) {
              return;
            }

            applySpeciesSelection(
              suggestedSpecies,
              suggestedConfidence,
              'MODEL_CONFIRMED',
            );
          }}
          activeOpacity={0.7}>
          <Text className="text-base font-semibold text-white">Yes, continue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="mt-3 h-12 rounded-xl border items-center justify-center"
          style={{borderColor: '#2D6A4F'}}
          onPress={() => {
            setSpeciesResolutionMode('manual');
            setStatusText('Select the correct approved species');
          }}
          activeOpacity={0.7}>
          <Text className="text-base font-semibold" style={{color: '#2D6A4F'}}>
            No, choose manually
          </Text>
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet
        visible={speciesResolutionMode === 'manual'}
        onClose={() => {
          setSpeciesResolutionMode('none');
          setStatusText(DEFAULT_STATUS_TEXT);
        }}>
        <Text className="text-lg font-bold" style={{color: '#191C1B'}}>
          Select an approved species
        </Text>
        <Text className="mt-3 leading-6" style={{color: '#6B7280'}}>
          Choose the approved species that best matches this tree when the model is uncertain.
        </Text>
        <ScrollView className="mt-4" style={{maxHeight: 280}}>
          {APPROVED_SPECIES.map(species => (
            <TouchableOpacity
              key={species.name}
              className="mb-3 rounded-xl border px-4 py-3"
              style={{borderColor: '#D1D5DB'}}
              onPress={() => {
                applySpeciesSelection(
                  species.name,
                  suggestedConfidence,
                  'MANUAL_SELECTED',
                );
              }}
              activeOpacity={0.7}>
              <Text className="text-base font-semibold" style={{color: '#191C1B'}}>
                {species.name}
              </Text>
              <Text className="mt-1 text-sm" style={{color: '#6B7280'}}>
                {species.scientificName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>

    </View>
  );
};

export default ARCameraScreen;
