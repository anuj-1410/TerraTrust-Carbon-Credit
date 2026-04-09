import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Camera, useCameraDevice} from 'react-native-vision-camera';
import Geolocation from 'react-native-geolocation-service';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type {RootStackParamList} from '../../../types/navigation';
import Badge from '../../../common/components/Badge';
import {isPointInsidePolygon} from '../../../common/utils/geoJson';
import {useAppSelector} from '../../../store/hooks';
import type {TreeSample} from '../store/auditSlice';
import {
  measureTreeDiameter,
  identifySpecies,
  beginHeightMeasurement,
  captureHeightPoint,
  cancelHeightMeasurement,
} from '../../../services/ar-bridge';
import {hashPhoto, readFileAsBase64} from '../../../common/utils/hash';
import {
  APPROVED_SPECIES_NAMES,
  getWoodDensity,
} from '../../../common/constants/species';
import {v4 as uuidv4} from 'uuid';
import {ensureCameraPermission} from '../../../common/utils/permissions';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ARCameraScreen'>;
type RouteType = RouteProp<RootStackParamList, 'ARCameraScreen'>;

type MeasurePhase =
  | 'idle'
  | 'identifying'
  | 'species_done'
  | 'measuring'
  | 'height_base'
  | 'height_top'
  | 'result'
  | 'success';

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
  const resetScanToken = route.params.resetScanToken;

  // State
  const [phase, setPhase] = useState<MeasurePhase>('idle');
  const [statusText, setStatusText] = useState('Point camera at tree trunk');

  // Species
  const [speciesName, setSpeciesName] = useState<string | null>(null);
  const [speciesConfidence, setSpeciesConfidence] = useState(0);
  const [woodDensity, setWoodDensity] = useState(0);

  // Measurement
  const [diameterCm, setDiameterCm] = useState<number | null>(null);
  const [arHeightM, setArHeightM] = useState<number | null>(null);
  const [measureConfidence, setMeasureConfidence] = useState(0);
  const [tierUsed, setTierUsed] = useState<1 | 2 | 3>(arTier as 1 | 2 | 3);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Evidence
  const [evidenceBase64, setEvidenceBase64] = useState<string | null>(null);
  const [evidenceHash, setEvidenceHash] = useState<string | null>(null);

  // GPS from last known position (simplified — gets from geolocation)
  const [gpsLat, setGpsLat] = useState(0);
  const [gpsLng, setGpsLng] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState(0);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  // Timer animation
  const timerProgress = useSharedValue(0);
  const slamArrowX = useSharedValue(0);

  const timerStyle = useAnimatedStyle(() => ({
    width: `${timerProgress.value * 100}%`,
  }));

  const slamArrowStyle = useAnimatedStyle(() => ({
    transform: [{translateX: slamArrowX.value}],
  }));

  const resetScanState = useCallback(() => {
    void cancelHeightMeasurement().catch(() => undefined);
    setPhase('idle');
    setStatusText('Point camera at tree trunk');
    setSpeciesName(null);
    setSpeciesConfidence(0);
    setWoodDensity(0);
    setDiameterCm(null);
    setArHeightM(null);
    setMeasureConfidence(0);
    setTierUsed(arTier as 1 | 2 | 3);
    setEvidenceBase64(null);
    setEvidenceHash(null);
    timerProgress.value = 0;
    slamArrowX.value = 0;
  }, [arTier, slamArrowX, timerProgress]);

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
  const needsArHeight = Boolean(currentZone && !currentZone.gedi_available);
  const canMeasureArHeight = needsArHeight && arTier !== 3;
  const requiresArHeightBeforeSave = needsArHeight && canMeasureArHeight;
  const canStartDiameterMeasurement = Boolean(speciesName);
  const canStartHeightMeasurement = Boolean(speciesName) && canMeasureArHeight;

  useEffect(() => {
    return () => {
      void cancelHeightMeasurement().catch(() => undefined);
    };
  }, []);

  // ──── IDENTIFY SPECIES ────
  const handleIdentifySpecies = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      setPhase('identifying');
      setStatusText('Identifying species...');
      const snapshot = await cameraRef.current.takeSnapshot({quality: 80});
      const imgBase64 = await readFileAsBase64(snapshot.path);

      const result = await withTimeout(identifySpecies(imgBase64), 10000);

      if (result.confidence >= 0.8) {
        // Check if approved
        if (!APPROVED_SPECIES_NAMES.includes(result.species)) {
          Alert.alert(
            'Species Not Approved',
            'This species is not eligible for carbon credits. Please scan a different tree.',
          );
          setPhase('idle');
          setStatusText('Point camera at tree trunk');
          return;
        }
        setSpeciesName(result.species);
        setSpeciesConfidence(result.confidence);
        setWoodDensity(getWoodDensity(result.species) ?? 0);
        setPhase('species_done');
        setStatusText('Species identified — Measure diameter');
      } else {
        Alert.alert(
          'Retake Species Photo',
          'Species confidence is too low. Please retake the species photo and try again.',
        );
        setPhase('idle');
        setStatusText('Point camera at tree trunk');
      }
    } catch {
      Alert.alert('Species ID Failed', 'Could not identify species. Please try again.');
      setPhase('idle');
      setStatusText('Point camera at tree trunk');
    }
  }, []);

  // ──── MEASURE DIAMETER ────
  const handleMeasureDiameter = useCallback(async () => {
    if (arTier === 3) {
      navigation.navigate('ManualMeasureScreen', {zoneId, zoneIndex});
      return;
    }

    try {
      setPhase('measuring');

      if (arTier === 1) {
        setStatusText('Hold still for 3 seconds...');
        timerProgress.value = 0;
        timerProgress.value = withTiming(1, {
          duration: 3000,
          easing: Easing.linear,
        });
      } else {
        setStatusText('Move left and right slowly...');
        slamArrowX.value = 0;
        slamArrowX.value = withRepeat(
          withTiming(80, {duration: 1250, easing: Easing.inOut(Easing.ease)}),
          4,
          true,
        );
      }

      const result = await withTimeout(measureTreeDiameter(), 10000);

      // FR-021: confidence < 0.7 → retry
      if (result.confidence < 0.7) {
        setConsecutiveFailures(f => f + 1);
        if (consecutiveFailures + 1 >= 3) {
          // FR-027: 3 failures → ManualMeasure
          navigation.navigate('ManualMeasureScreen', {zoneId, zoneIndex});
          return;
        }
        Alert.alert(
          'Low Confidence',
          'Move closer to the tree and hold still, then try again.',
        );
        setPhase('species_done');
        setStatusText('Try again — Measure diameter');
        return;
      }

      // FR-022: unusual DBH
      if (result.diameter_cm < 5 || result.diameter_cm > 200) {
        setConsecutiveFailures(f => f + 1);
        if (consecutiveFailures + 1 >= 3) {
          navigation.navigate('ManualMeasureScreen', {zoneId, zoneIndex});
          return;
        }
        Alert.alert(
          'Unusual Measurement',
          'This seems unusual. Please measure again.',
        );
        setPhase('species_done');
        setStatusText('Try again — Measure diameter');
        return;
      }

      // Success — capture evidence photo
      setConsecutiveFailures(0);
      setDiameterCm(result.diameter_cm);
      setMeasureConfidence(result.confidence);
      setTierUsed(result.tier_used);

      // Evidence photo + hash
      if (cameraRef.current) {
        const snap = await cameraRef.current.takeSnapshot({quality: 80});
        const b64 = await readFileAsBase64(snap.path);
        setEvidenceBase64(b64);
        setEvidenceHash(await hashPhoto(b64));
      }

      ReactNativeHapticFeedback.trigger('impactMedium');
      setPhase('result');
      setStatusText('Measurement complete');
    } catch {
      setConsecutiveFailures(f => f + 1);
      if (consecutiveFailures + 1 >= 3) {
        navigation.navigate('ManualMeasureScreen', {zoneId, zoneIndex});
        return;
      }
      Alert.alert(
        'Measurement Failed',
        'Move closer to the tree and hold still, then try again.',
      );
      setPhase('species_done');
      setStatusText('Try again — Measure diameter');
    }
  }, [arTier, consecutiveFailures, navigation, slamArrowX, timerProgress, zoneId, zoneIndex]);

  const handleStartHeightMeasurement = useCallback(async () => {
    if (!canMeasureArHeight) {
      Alert.alert(
        'Height Measurement Unavailable',
        'This device cannot capture AR height for zones without GEDI satellite data.',
      );
      return;
    }

    try {
      await withTimeout(beginHeightMeasurement(), 5000);
      setPhase('height_base');
      setStatusText(
        'GEDI satellite data not available. Point at the base of the tree, then tap Base.',
      );
    } catch {
      Alert.alert(
        'Height Measurement Unavailable',
        'Could not start AR height measurement. Hold the phone steady and try again.',
      );
    }
  }, [canMeasureArHeight]);

  const handleCaptureHeightBase = useCallback(async () => {
    try {
      await withTimeout(captureHeightPoint('base'), 5000);
      setPhase('height_top');
      setStatusText('Base marked. Tilt to the top of the tree, then tap Top.');
    } catch {
      Alert.alert(
        'Base Not Captured',
        'Point at the base of the tree and hold steady, then try again.',
      );
    }
  }, []);

  const handleCaptureHeightTop = useCallback(async () => {
    try {
      const result = await withTimeout(captureHeightPoint('top'), 5000);
      const heightM = result.height_m ?? null;
      setArHeightM(heightM);
      ReactNativeHapticFeedback.trigger('impactMedium');
      setStatusText(
        heightM !== null
          ? `Height measured: ${heightM.toFixed(1)} m`
          : 'Height measured',
      );
      setPhase(diameterCm !== null ? 'result' : 'species_done');
    } catch {
      Alert.alert(
        'Height Not Captured',
        'Point at the top of the tree and hold steady, then try again.',
      );
    }
  }, [diameterCm]);

  const handleCancelHeightMeasurement = useCallback(() => {
    void cancelHeightMeasurement().catch(() => undefined);
    setStatusText(
      diameterCm !== null
        ? 'Measurement complete'
        : 'Species identified — Measure diameter',
    );
    setPhase(diameterCm !== null ? 'result' : 'species_done');
  }, [diameterCm]);

  const handleAcceptSave = useCallback(async () => {
    if (!speciesName || diameterCm === null) return;

    if (requiresArHeightBeforeSave && arHeightM === null) {
      Alert.alert(
        'Measure Height First',
        'This zone has no GEDI satellite height data, so you need to capture tree height before saving.',
      );
      return;
    }

    if (gpsAccuracy > 30) {
      Alert.alert(
        'Weak GPS Signal',
        'GPS accuracy is too weak to save this tree. Move to an open area and try again.',
      );
      return;
    }

    if (
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

    if ((!nextEvidenceBase64 || !nextEvidenceHash) && cameraRef.current) {
      const snapshot = await cameraRef.current.takeSnapshot({quality: 80});
      nextEvidenceBase64 = await readFileAsBase64(snapshot.path);
      nextEvidenceHash = await hashPhoto(nextEvidenceBase64);
      setEvidenceBase64(nextEvidenceBase64);
      setEvidenceHash(nextEvidenceHash);
    }

    const pendingTree: TreeSample = {
      tree_id: uuidv4(),
      zone_id: zoneId,
      species: speciesName,
      species_confidence: speciesConfidence,
      dbh_cm: Math.round(diameterCm * 10) / 10,
      wood_density: woodDensity,
      ar_height_m: needsArHeight ? arHeightM : null,
      measurement_tier: tierUsed,
      confidence_score: measureConfidence,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      gps_accuracy_m: gpsAccuracy,
      evidence_photo_base64: nextEvidenceBase64 ?? '',
      evidence_photo_hash: nextEvidenceHash ?? '',
      scan_timestamp: new Date().toISOString(),
    };

    // Show success animation then navigate to review
    setPhase('success');
    setTimeout(() => {
      navigation.navigate('TreeResultScreen', {pendingTree});
    }, 1500);
  }, [
    arHeightM,
    speciesName,
    diameterCm,
    speciesConfidence,
    woodDensity,
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
        isActive={phase !== 'success'}
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
      {phase !== 'result' && phase !== 'success' && (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          {/* Horizontal line */}
          <View className="absolute w-20 h-px bg-white/80" />
          {/* Vertical line */}
          <View className="absolute w-px h-20 bg-white/80" />
          {/* Center circle */}
          <View className="w-10 h-10 rounded-full border-2 border-white/80" />
        </View>
      )}

      {/* Green wireframe cylinder overlay during measurement — FR-016 / T034 */}
      {phase === 'measuring' && (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          {/* Cylinder body — green dashed border */}
          <View className="w-20 h-40 border-2 border-dashed border-[#4ADE80] rounded-lg opacity-70" />
          {/* Top ellipse */}
          <View className="absolute top-[28%] w-20 h-5 border-2 border-dashed border-[#4ADE80] rounded-full opacity-70" />
          {/* Bottom ellipse */}
          <View className="absolute bottom-[28%] w-20 h-5 border-2 border-dashed border-[#4ADE80] rounded-full opacity-70" />
        </View>
      )}

      {/* Species overlay card — visible after identification */}
      {speciesName && phase !== 'idle' && phase !== 'identifying' && phase !== 'success' && (
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

      {/* Measurement progress — Tier 1 ring / Tier 2 motion guide */}
      {phase === 'measuring' && (
        <View className="absolute bottom-48 left-0 right-0 items-center">
          {arTier === 1 ? (
            <View className="w-48 h-3 bg-white/20 rounded-full overflow-hidden">
              <Animated.View
                className="h-full bg-[#4ADE80] rounded-full"
                style={timerStyle}
              />
            </View>
          ) : (
            <Animated.View style={slamArrowStyle}>
              <MaterialCommunityIcons color="#FFFFFF" name="arrow-left-right" size={36} />
            </Animated.View>
          )}
          <Text className="text-white text-sm mt-3">
            {arTier === 1
              ? 'Hold still...'
              : 'Move left and right slowly...'}
          </Text>
        </View>
      )}

      {/* Bottom action buttons */}
      {(phase === 'idle' || phase === 'species_done') && (
        <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-6 bg-gradient-to-t from-black/80">
          <View className="flex-row items-center">
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
                  {canMeasureArHeight ? 'Measure Height' : 'Height Unavailable'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {(phase === 'height_base' || phase === 'height_top') && (
        <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-6 bg-gradient-to-t from-black/80">
          <View className="rounded-2xl bg-black/60 p-4 mb-4">
            <Text className="text-white text-base font-semibold">
              {phase === 'height_base'
                ? 'Point the crosshair at the base of the tree trunk.'
                : 'Tilt up and place the crosshair on the top of the tree.'}
            </Text>
            <Text className="text-white/70 text-sm mt-2">
              {phase === 'height_base'
                ? 'Tap Base when the crosshair is on the tree base.'
                : 'Tap Top to calculate the vertical height between both points.'}
            </Text>
          </View>
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={handleCancelHeightMeasurement}
              className="flex-1 h-14 rounded-xl border-2 border-white/60 items-center justify-center">
              <Text className="text-white text-base font-semibold">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (phase === 'height_base') {
                  void handleCaptureHeightBase();
                  return;
                }

                void handleCaptureHeightTop();
              }}
              className="flex-1 h-14 rounded-xl bg-[#2D6A4F] items-center justify-center">
              <Text className="text-white text-base font-bold">
                {phase === 'height_base' ? 'Mark Base' : 'Mark Top'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
                    : 'AR height unavailable on this device'
                : 'From GEDI Satellite'}
            </Text>
          </View>

          {canMeasureArHeight && arHeightM === null && (
            <TouchableOpacity
              onPress={() => {
                void handleStartHeightMeasurement();
              }}
              className="mb-3 h-12 rounded-xl border-2 border-[#2D6A4F] items-center justify-center">
              <Text className="text-[#2D6A4F] text-base font-semibold">
                Measure Height
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
      {phase === 'success' && (
        <View className="absolute inset-0 bg-[#2D6A4F]/70 items-center justify-center">
          <LottieView
            source={require('../../../assets/lottie/scan_success.json')}
            autoPlay
            loop={false}
            style={{width: 180, height: 180}}
          />
          <Text className="text-white text-xl font-bold mt-4">
            Tree Scanned Successfully!
          </Text>
        </View>
      )}

    </View>
  );
};

export default ARCameraScreen;
