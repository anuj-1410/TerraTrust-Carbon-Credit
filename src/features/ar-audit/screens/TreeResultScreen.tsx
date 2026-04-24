import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Text, TouchableOpacity, ScrollView, Image} from 'react-native';
import {CommonActions, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type {RootStackParamList} from '../../../types/navigation';
import Badge from '../../../common/components/Badge';
import BottomSheet from '../../../common/components/BottomSheet';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {addScannedTree, setCurrentZoneIndex} from '../store/auditSlice';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'TreeResultScreen'>;
type RouteType = RouteProp<RootStackParamList, 'TreeResultScreen'>;

const MAX_TREES_PER_ZONE = 5;

const formatLatitude = (value: number) =>
  `${Math.abs(value).toFixed(4)}°${value >= 0 ? 'N' : 'S'}`;

const formatLongitude = (value: number) =>
  `${Math.abs(value).toFixed(4)}°${value >= 0 ? 'E' : 'W'}`;

const TreeResultScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const dispatch = useAppDispatch();
  const audit = useAppSelector(state => state.audit);
  const {scannedTrees, zones, currentZoneIndex, minTreesRequired} = audit;
  const [hasSavedTree, setHasSavedTree] = useState(false);
  const [showZoneCompletionSheet, setShowZoneCompletionSheet] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tree = route.params.pendingTree;
  const currentZone = zones[currentZoneIndex] ?? null;
  const nextZone = zones[currentZoneIndex + 1] ?? null;
  const zoneName = currentZone?.label ?? `Zone ${currentZoneIndex + 1}`;

  const treesInZone = scannedTrees.filter(
    t => t.zone_id === currentZone?.zone_id,
  ).length + 1; // +1 for pending tree
  const minimumTreesPerZone = Math.max(
    3,
    Math.floor(minTreesRequired / Math.max(zones.length, 1)),
  );
  const zoneMinReached = treesInZone >= minimumTreesPerZone;
  const canScanMoreTrees = treesInZone < MAX_TREES_PER_ZONE;
  const isLastZone = currentZoneIndex >= zones.length - 1;

  const precisionBadge = (() => {
    if (!tree) return {label: '', variant: 'manual' as const};
    if (tree.measurement_tier === 1)
      return {
        label: '◉ High Precision',
        variant: 'high-precision' as const,
      };
    if (tree.measurement_tier === 2)
      return {
        label: '◉ Standard Precision',
        variant: 'standard-precision' as const,
      };
    return {
      label: '◎ Manual Measurement',
      variant: 'manual' as const,
    };
  })();

  const navigateBackToCamera = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'ARCameraScreen',
        params: {
          zoneId: currentZone?.zone_id ?? tree.zone_id,
          zoneIndex: currentZoneIndex,
          returnDiameter: undefined,
          returnHeight: undefined,
          resetScanToken: `${Date.now()}`,
        },
        merge: true,
      }),
    );
  }, [currentZone, currentZoneIndex, navigation, tree.zone_id]);

  const handleConfirmSave = useCallback(() => {
    if (!tree || hasSavedTree) return;

    dispatch(addScannedTree(tree));
    setHasSavedTree(true);
    ReactNativeHapticFeedback.trigger('notificationSuccess');

    saveTimerRef.current = setTimeout(() => {
      if (zoneMinReached) {
        setShowZoneCompletionSheet(true);
        return;
      }

      navigateBackToCamera();
    }, 1500);
  }, [
    zoneMinReached,
    dispatch,
    hasSavedTree,
    navigateBackToCamera,
    tree,
  ]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleRescan = useCallback(() => {
    navigateBackToCamera();
  }, [navigateBackToCamera]);

  const handleScanMoreTrees = useCallback(() => {
    setShowZoneCompletionSheet(false);
    navigateBackToCamera();
  }, [navigateBackToCamera]);

  const handleContinue = useCallback(() => {
    setShowZoneCompletionSheet(false);

    if (isLastZone) {
      navigation.navigate('AuditCompleteScreen');
      return;
    }

    if (!audit.activeAuditId || !audit.activeLandId) {
      return;
    }

    dispatch(setCurrentZoneIndex(currentZoneIndex + 1));
    navigation.dispatch(
      CommonActions.navigate({
        name: 'ZoneNavigationScreen',
        params: {
          auditId: audit.activeAuditId,
          landId: audit.activeLandId,
          originTab: audit.originTab ?? undefined,
        },
        merge: true,
      }),
    );
  }, [
    audit.activeAuditId,
    audit.activeLandId,
    audit.originTab,
    currentZoneIndex,
    dispatch,
    isLastZone,
    navigation,
  ]);

  if (!tree) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F8FAF8]">
        <Text className="text-[#6B7280]">No tree data available</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F8FAF8]">
      {/* Header */}
      <View className="bg-[#1B4332] pt-12 pb-5 px-5 flex-row items-center">
        <TouchableOpacity
          onPress={handleRescan}
          className="w-12 h-12 items-center justify-center rounded-full"
          accessibilityLabel="Go back">
          <MaterialCommunityIcons color="#FFFFFF" name="arrow-left" size={24} />
        </TouchableOpacity>
        <Text className="flex-1 text-white text-xl font-bold text-center mr-12">
          Tree Scan Result
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{paddingBottom: 32}}>
        {/* Result Card */}
        <View className="mt-5 bg-white rounded-2xl p-5 shadow-sm">
          {/* Species */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <MaterialCommunityIcons color="#2D6A4F" name="sprout" size={18} />
              <Text className="text-[#191C1B] text-xl font-bold">
                {tree.species}
              </Text>
            </View>
            <Badge label="Verified" variant="verified" />
          </View>

          <View className="h-px bg-[#F2F4F2]" />

          {/* Diameter */}
          <View className="py-4">
            <Text className="text-[#6B7280] text-sm mb-1">
              Trunk Diameter (DBH)
            </Text>
            <Text
              className="text-[#191C1B] text-4xl font-bold"
              style={{fontFamily: 'RobotoMono-Bold'}}>
              {tree.dbh_cm.toFixed(1)} cm
            </Text>
            <View className="mt-2 self-start">
              <Badge label={precisionBadge.label} variant={precisionBadge.variant} />
            </View>
          </View>

          <View className="h-px bg-[#F2F4F2]" />

          {/* Height */}
          <View className="py-4">
            <Text className="text-[#6B7280] text-sm mb-1">Height Source</Text>
            <Text className="text-[#191C1B] text-base">
              {tree.ar_height_m !== null ? (
                <Text style={{fontFamily: 'RobotoMono-Regular'}}>
                  AR Measured: {tree.ar_height_m.toFixed(1)} m
                </Text>
              ) : (
                'From GEDI Satellite'
              )}
            </Text>
          </View>

          <View className="h-px bg-[#F2F4F2]" />

          {/* GPS */}
          <View className="py-4">
            <Text className="text-[#6B7280] text-sm mb-1">GPS Location</Text>
            <Text
              className="text-[#191C1B] text-sm"
              style={{fontFamily: 'RobotoMono-Regular'}}>
              {formatLatitude(tree.gps_lat)}, {formatLongitude(tree.gps_lng)}
            </Text>
            <Text className="text-[#9CA3AF] text-xs mt-0.5">
              ± {tree.gps_accuracy_m.toFixed(1)}m
            </Text>
          </View>

          <View className="h-px bg-[#F2F4F2]" />

          {/* Evidence photo */}
          <View className="py-4">
            <Text className="text-[#6B7280] text-sm mb-2">Evidence Photo</Text>
            {tree.evidence_photo_base64 ? (
              <Image
                source={{
                  uri: `data:image/jpeg;base64,${tree.evidence_photo_base64}`,
                }}
                className="w-full h-32 rounded-xl bg-[#E5E7EB]"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-32 rounded-xl bg-[#E5E7EB] items-center justify-center">
                <Text className="text-[#9CA3AF]">No photo</Text>
              </View>
            )}
            {tree.evidence_photo_hash && (
              <Text
                className="text-[#9CA3AF] text-[10px] mt-2"
                style={{fontFamily: 'RobotoMono-Regular'}}>
                SHA-256: {tree.evidence_photo_hash.substring(0, 16)}...
              </Text>
            )}
          </View>
        </View>

        {/* Zone progress */}
        <View className="mt-4 items-center">
          <Text className="text-[#6B7280] text-sm">
            {currentZone?.label ?? `Zone ${currentZoneIndex + 1}`}:{' '}
            {treesInZone} of {MAX_TREES_PER_ZONE} trees scanned
          </Text>
          <Text className="mt-1 text-center text-xs text-[#9CA3AF]">
            Minimum {minimumTreesPerZone} trees required in each zone.
          </Text>
          <View className="flex-row mt-2">
            {Array.from({length: MAX_TREES_PER_ZONE}).map((_, i) => (
              <View
                key={i}
                className={`w-3 h-3 rounded-full mr-1.5 ${
                  i < treesInZone ? 'bg-[#2D6A4F]' : 'bg-[#E5E7EB]'
                }`}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom buttons */}
      <View className="px-5 pb-8 pt-3 bg-[#F8FAF8]">
        <TouchableOpacity
          onPress={handleConfirmSave}
          disabled={hasSavedTree}
          className="h-14 rounded-xl items-center justify-center flex-row"
          style={{backgroundColor: hasSavedTree ? '#9CA3AF' : '#2D6A4F'}}
          activeOpacity={0.7}>
          <Text className="text-white text-base font-bold">
            {hasSavedTree ? 'Tree Saved' : 'Confirm and Save Tree'}
          </Text>
          <MaterialCommunityIcons color="#FFFFFF" name="check" size={18} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRescan}
          disabled={hasSavedTree}
          className="mt-3 h-12 rounded-xl border-2 border-[#D1D5DB] items-center justify-center flex-row"
          style={{opacity: hasSavedTree ? 0.5 : 1}}
          activeOpacity={0.7}>
          <Text className="text-[#6B7280] text-base font-semibold">
            Rescan This Tree
          </Text>
        </TouchableOpacity>
      </View>

      <BottomSheet visible={showZoneCompletionSheet} onClose={() => undefined}>
        <Text className="text-[#191C1B] text-xl font-bold text-center">
          {isLastZone ? 'All zones done!' : `${zoneName} complete!`}
        </Text>
        <Text className="mt-2 text-center text-sm text-[#6B7280]">
          {isLastZone
            ? `${treesInZone} trees scanned in ${zoneName}. Review your audit and submit it for satellite verification.`
            : canScanMoreTrees
              ? `${treesInZone} trees scanned in ${zoneName}. You can scan ${MAX_TREES_PER_ZONE - treesInZone} more tree${MAX_TREES_PER_ZONE - treesInZone === 1 ? '' : 's'} in this zone or continue to ${nextZone?.label ?? `Zone ${currentZoneIndex + 2}`}.`
              : `You have reached the maximum of ${MAX_TREES_PER_ZONE} trees for ${zoneName}. Continue to ${nextZone?.label ?? `Zone ${currentZoneIndex + 2}`}.`}
        </Text>

        {canScanMoreTrees && (
          <TouchableOpacity
            onPress={handleScanMoreTrees}
            className="mt-6 h-12 rounded-xl border-2 border-[#D1D5DB] items-center justify-center"
            activeOpacity={0.7}>
            <Text className="text-[#6B7280] text-base font-semibold">
              Scan more trees in this zone
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleContinue}
          className="mt-3 h-14 rounded-xl bg-[#2D6A4F] items-center justify-center"
          activeOpacity={0.7}>
          <Text className="text-white text-base font-bold">
            {isLastZone
              ? 'Review and Submit'
              : `Go to ${nextZone?.label ?? `Zone ${currentZoneIndex + 2}`} ->`}
          </Text>
        </TouchableOpacity>
      </BottomSheet>

      {hasSavedTree ? (
        <View className="absolute inset-0 items-center justify-center bg-[#2D6A4F]/70">
          <LottieView
            source={require('../../../assets/lottie/scan_success.json')}
            autoPlay
            loop={false}
            style={{width: 180, height: 180}}
          />
          <Text className="mt-4 text-xl font-bold text-white">
            Tree Scanned Successfully!
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default TreeResultScreen;
