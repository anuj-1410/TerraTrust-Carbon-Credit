import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Camera, useCameraDevice} from 'react-native-vision-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import LottieView from 'lottie-react-native';

import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import type {AuditState, TreeSample} from '../store/auditSlice';
import {addScannedTree} from '../store/auditSlice';
import {
  measureTreeDiameter,
  identifySpecies,
} from '../../../services/ar-bridge';
import {hashPhoto} from '../../../common/utils/hash';
import {
  APPROVED_SPECIES,
  APPROVED_SPECIES_NAMES,
  getWoodDensity,
} from '../../../common/constants/species';
import {v4 as uuidv4} from 'uuid';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ARCameraScreen'>;
type RouteType = RouteProp<RootStackParamList, 'ARCameraScreen'>;

type MeasurePhase =
  | 'idle'
  | 'identifying'
  | 'species_done'
  | 'measuring'
  | 'result'
  | 'success';

const ARCameraScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {zoneId, zoneIndex} = route.params;
  const dispatch = useAppDispatch();
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');

  const audit = useAppSelector(state => state.audit as unknown as AuditState);
  const {zones, scannedTrees, arTier, minTreesRequired} = audit;
  const currentZone = zones[zoneIndex] ?? null;

  // State
  const [phase, setPhase] = useState<MeasurePhase>('idle');
  const [statusText, setStatusText] = useState('Point camera at tree trunk');

  // Species
  const [speciesName, setSpeciesName] = useState<string | null>(null);
  const [speciesConfidence, setSpeciesConfidence] = useState(0);
  const [woodDensity, setWoodDensity] = useState(0);
  const [showSpeciesDropdown, setShowSpeciesDropdown] = useState(false);

  // Measurement
  const [diameterCm, setDiameterCm] = useState<number | null>(null);
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

  // Timer animation
  const timerProgress = useSharedValue(0);
  const slamArrowX = useSharedValue(0);

  const timerStyle = useAnimatedStyle(() => ({
    width: `${timerProgress.value * 100}%`,
  }));

  const slamArrowStyle = useAnimatedStyle(() => ({
    transform: [{translateX: slamArrowX.value}],
  }));

  // Wire returnDiameter from ManualMeasureScreen (T031)
  useEffect(() => {
    const returnDiameter = (route.params as any)?.returnDiameter;
    if (returnDiameter != null) {
      setDiameterCm(returnDiameter);
      setTierUsed(3);
      setMeasureConfidence(1.0);
      setSpeciesConfidence(speciesConfidence || 1.0);
      setPhase('result');
      setStatusText('Manual measurement received');
    }
  }, [(route.params as any)?.returnDiameter]);

  // GPS location for tree capture
  useEffect(() => {
    const Geolocation = require('react-native-geolocation-service').default;
    const watchId = Geolocation.watchPosition(
      (pos: any) => {
        setGpsLat(pos.coords.latitude);
        setGpsLng(pos.coords.longitude);
        setGpsAccuracy(pos.coords.accuracy);
      },
      () => {},
      {enableHighAccuracy: true, distanceFilter: 1, interval: 3000},
    );
    return () => Geolocation.clearWatch(watchId);
  }, []);

  const treesInZone = scannedTrees.filter(t => t.zone_id === zoneId).length;
  const treesPerZone = Math.max(
    3,
    Math.floor(minTreesRequired / Math.max(zones.length, 1)),
  );

  // ──── IDENTIFY SPECIES ────
  const handleIdentifySpecies = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      setPhase('identifying');
      setStatusText('Identifying species...');
      const snapshot = await cameraRef.current.takeSnapshot({quality: 80});
      const base64 = snapshot.path; // path to file
      // Read file to base64 — we use the path
      const RNFS = require('react-native-fs');
      const imgBase64: string = await RNFS.readFile(snapshot.path, 'base64');

      const result = await identifySpecies(imgBase64);

      if (result.confidence >= 0.6) {
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
        // Low confidence — show dropdown
        setShowSpeciesDropdown(true);
        setPhase('species_done');
        setStatusText('Select species manually');
      }
    } catch {
      Alert.alert('Species ID Failed', 'Could not identify species. Please try again.');
      setPhase('idle');
      setStatusText('Point camera at tree trunk');
    }
  }, []);

  const handleSelectSpecies = useCallback((name: string) => {
    setSpeciesName(name);
    setSpeciesConfidence(1.0); // manual selection = full confidence
    setWoodDensity(getWoodDensity(name) ?? 0);
    setShowSpeciesDropdown(false);
    setPhase('species_done');
    setStatusText('Species selected — Measure diameter');
  }, []);

  // ──── MEASURE DIAMETER ────
  const handleMeasureDiameter = useCallback(async () => {
    if (arTier === 3) {
      navigation.navigate('ManualMeasureScreen', {});
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

      const result = await measureTreeDiameter();

      // FR-021: confidence < 0.7 → retry
      if (result.confidence < 0.7) {
        setConsecutiveFailures(f => f + 1);
        if (consecutiveFailures + 1 >= 3) {
          // FR-027: 3 failures → ManualMeasure
          navigation.navigate('ManualMeasureScreen', {});
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
          navigation.navigate('ManualMeasureScreen', {});
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
        const RNFS = require('react-native-fs');
        const b64: string = await RNFS.readFile(snap.path, 'base64');
        setEvidenceBase64(b64);
        setEvidenceHash(hashPhoto(b64));
      }

      ReactNativeHapticFeedback.trigger('impactMedium');
      setPhase('result');
      setStatusText('Measurement complete');
    } catch {
      setConsecutiveFailures(f => f + 1);
      if (consecutiveFailures + 1 >= 3) {
        navigation.navigate('ManualMeasureScreen', {});
        return;
      }
      Alert.alert(
        'Measurement Failed',
        'Move closer to the tree and hold still, then try again.',
      );
      setPhase('species_done');
      setStatusText('Try again — Measure diameter');
    }
  }, [arTier, consecutiveFailures, navigation, timerProgress, slamArrowX]);

  // ──── ACCEPT & SAVE ────
  const handleAcceptSave = useCallback(() => {
    if (!speciesName || diameterCm === null) return;

    const treeSample: TreeSample = {
      tree_id: uuidv4(),
      zone_id: zoneId,
      species: speciesName,
      species_confidence: speciesConfidence,
      dbh_cm: Math.round(diameterCm * 10) / 10,
      wood_density: woodDensity,
      ar_height_m: null,
      measurement_tier: tierUsed,
      confidence_score: measureConfidence,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      gps_accuracy_m: gpsAccuracy,
      evidence_photo_base64: evidenceBase64 ?? '',
      evidence_photo_hash: evidenceHash ?? '',
      scan_timestamp: new Date().toISOString(),
    };

    // Show success animation
    setPhase('success');
    setTimeout(() => {
      dispatch(addScannedTree(treeSample));
      navigation.navigate('TreeResultScreen');
    }, 1500);
  }, [
    speciesName,
    diameterCm,
    speciesConfidence,
    woodDensity,
    tierUsed,
    measureConfidence,
    gpsLat,
    gpsLng,
    gpsAccuracy,
    evidenceBase64,
    evidenceHash,
    zoneId,
    dispatch,
    navigation,
  ]);

  const handleRetry = useCallback(() => {
    setDiameterCm(null);
    setPhase('species_done');
    setStatusText('Try again — Measure diameter');
  }, []);

  const precisionBadge = (() => {
    if (tierUsed === 1) return {label: '◉ High Precision', color: 'bg-[#D1FAE5] text-[#065F46]'};
    if (tierUsed === 2) return {label: '◉ Standard Precision', color: 'bg-[#FEF3C7] text-[#92400E]'};
    return {label: '◎ Manual Measurement', color: 'bg-[#F3F4F6] text-[#6B7280]'};
  })();

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
          <Text className="text-white text-2xl">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-white text-base text-center">
          {statusText}
        </Text>
        <View className="bg-white/20 rounded-full px-3 py-1">
          <Text className="text-white text-sm font-bold">
            {treesInZone}/{treesPerZone}
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
        <TouchableOpacity
          onPress={() => setShowSpeciesDropdown(true)}
          className="absolute top-28 left-5 right-5 bg-black/60 rounded-2xl p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Text className="text-lg mr-2">🌿</Text>
              <Text className="text-white text-lg font-bold">
                {speciesName}
              </Text>
            </View>
            <Text className="text-[#4ADE80] text-base font-bold">
              {Math.round(speciesConfidence * 100)}%
            </Text>
          </View>
          <Text className="text-white/50 text-xs mt-1">
            Tap to change species
          </Text>
          <Text
            className="text-white/70 text-xs mt-1"
            style={{fontFamily: 'RobotoMono-Regular'}}>
            Density: {woodDensity.toFixed(2)} g/cm³
          </Text>
        </TouchableOpacity>
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
              <Text className="text-white text-4xl">⟷</Text>
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
          <View className="flex-row justify-center items-end space-x-4">
            {/* Identify Species */}
            {phase === 'idle' && (
              <TouchableOpacity
                onPress={handleIdentifySpecies}
                className="flex-1 h-14 rounded-xl border-2 border-white/60 items-center justify-center">
                <Text className="text-white text-sm font-semibold">
                  🔍 Identify Species
                </Text>
              </TouchableOpacity>
            )}

            {/* Measure Diameter */}
            {phase === 'species_done' && speciesName && (
              <TouchableOpacity
                onPress={handleMeasureDiameter}
                className="flex-1 h-14 rounded-xl bg-[#2D6A4F] items-center justify-center mx-2">
                <Text className="text-white text-base font-bold">
                  📏 Measure Diameter
                </Text>
              </TouchableOpacity>
            )}

            {/* Measure Height — only if gedi_available === false */}
            {phase === 'species_done' &&
              currentZone &&
              !currentZone.gedi_available && (
                <TouchableOpacity
                  onPress={() => {
                    /* Height measurement TBD */
                  }}
                  className="h-14 px-4 rounded-xl border-2 border-white/60 items-center justify-center">
                  <Text className="text-white text-sm">📐 Height</Text>
                </TouchableOpacity>
              )}
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
          <View className={`self-start px-3 py-1.5 rounded-full mb-3 ${precisionBadge.color.split(' ')[0]}`}>
            <Text className={`text-xs font-semibold ${precisionBadge.color.split(' ')[1]}`}>
              {precisionBadge.label}
            </Text>
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
              onPress={handleAcceptSave}
              className="flex-1 h-14 rounded-xl bg-[#2D6A4F] items-center justify-center">
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

      {/* Species dropdown modal */}
      <Modal visible={showSpeciesDropdown} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl px-5 pt-4 pb-8 max-h-[70%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[#191C1B] text-lg font-bold">
                Select Species
              </Text>
              <TouchableOpacity onPress={() => setShowSpeciesDropdown(false)}>
                <Text className="text-[#6B7280] text-2xl">✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={APPROVED_SPECIES}
              keyExtractor={item => item.name}
              renderItem={({item}) => (
                <TouchableOpacity
                  onPress={() => handleSelectSpecies(item.name)}
                  className="py-4 border-b border-[#F2F4F2] flex-row justify-between items-center">
                  <View>
                    <Text className="text-[#191C1B] text-base font-semibold">
                      {item.name}
                    </Text>
                    <Text className="text-[#6B7280] text-xs">
                      {item.scientificName}
                    </Text>
                  </View>
                  <Text
                    className="text-[#6B7280] text-sm"
                    style={{fontFamily: 'RobotoMono-Regular'}}>
                    ρ {item.woodDensity.toFixed(2)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ARCameraScreen;
