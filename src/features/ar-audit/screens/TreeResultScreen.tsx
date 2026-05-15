import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {CommonActions, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Badge from '../../../common/components/Badge';
import Button from '../../../common/components/Button';
import BottomSheet from '../../../common/components/BottomSheet';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';
import {deleteFile} from '../../../common/utils/hash';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import type {RootStackParamList} from '../../../types/navigation';
import {addScannedTree, setCurrentZoneIndex} from '../store/auditSlice';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'TreeResultScreen'>;
type RouteType = RouteProp<RootStackParamList, 'TreeResultScreen'>;

const MAX_TREES_PER_ZONE = 5;

const formatLatitude = (value: number) =>
  `${Math.abs(value).toFixed(4)}°${value >= 0 ? 'N' : 'S'}`;

const formatLongitude = (value: number) =>
  `${Math.abs(value).toFixed(4)}°${value >= 0 ? 'E' : 'W'}`;

function getHeightSourceLabel(tree: RouteType['params']['pendingTree']): string {
  const heightCaptureMethod =
    tree.height_capture_method ?? (tree.ar_height_m !== null ? 'AR' : 'GEDI');

  if (heightCaptureMethod === 'GEDI' || tree.ar_height_m === null) {
    return 'GEDI satellite estimate';
  }

  if (heightCaptureMethod === 'MANUAL') {
    return `Manual height: ${tree.ar_height_m.toFixed(1)} m`;
  }

  return `AR measured height: ${tree.ar_height_m.toFixed(1)} m`;
}

const TreeResultScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const dispatch = useAppDispatch();
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();
  const audit = useAppSelector(state => state.audit);
  const {scannedTrees, zones, currentZoneIndex, minTreesRequired} = audit;
  const [hasSavedTree, setHasSavedTree] = useState(false);
  const [showZoneCompletionSheet, setShowZoneCompletionSheet] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tree = route.params.pendingTree;
  const currentZone = zones[currentZoneIndex] ?? null;
  const nextZone = zones[currentZoneIndex + 1] ?? null;
  const zoneName = currentZone?.label ?? `Zone ${currentZoneIndex + 1}`;

  const treesInZone =
    scannedTrees.filter(item => item.zone_id === currentZone?.zone_id).length + 1;
  const minimumTreesPerZone = Math.max(
    3,
    Math.floor(minTreesRequired / Math.max(zones.length, 1)),
  );
  const zoneMinReached = treesInZone >= minimumTreesPerZone;
  const canScanMoreTrees = treesInZone < MAX_TREES_PER_ZONE;
  const isLastZone = currentZoneIndex >= zones.length - 1;

  const precisionBadge = (() => {
    if (tree.measurement_tier === 1) {
      return {label: 'High Precision', variant: 'high-precision' as const};
    }

    if (tree.measurement_tier === 2) {
      return {label: 'Standard Precision', variant: 'standard-precision' as const};
    }

    return {label: 'Manual Measurement', variant: 'manual' as const};
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
    if (hasSavedTree) {
      return;
    }

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
  }, [dispatch, hasSavedTree, navigateBackToCamera, tree, zoneMinReached]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleRescan = useCallback(() => {
    if (tree.evidence_photo_uri) {
      void deleteFile(tree.evidence_photo_uri).catch(() => false);
    }
    navigateBackToCamera();
  }, [navigateBackToCamera, tree.evidence_photo_uri]);

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

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: topSpacing,
          paddingBottom: bottomSpacing,
        }}>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={handleRescan}
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full"
            style={{backgroundColor: COLORS.CARD_WHITE}}
            accessibilityLabel="Go back">
            <MaterialCommunityIcons
              color={COLORS.DARK_SLATE}
              name="arrow-left"
              size={22}
            />
          </TouchableOpacity>
          <View className="ml-3 flex-1">
            <Text
              className="text-[13px] font-semibold uppercase tracking-[1.6px]"
              style={{color: COLORS.FOREST_GREEN}}>
              Tree Review
            </Text>
            <Text className="mt-1 text-3xl font-bold" style={{color: COLORS.DARK_SLATE}}>
              Review this tree scan
            </Text>
          </View>
        </View>

        <Card className="mt-6 px-5 py-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text
                className="text-[13px] font-semibold uppercase tracking-[1.4px]"
                style={{color: COLORS.FOREST_GREEN}}>
                Species
              </Text>
              <Text className="mt-2 text-2xl font-bold" style={{color: COLORS.DARK_SLATE}}>
                {tree.species}
              </Text>
            </View>
            <Badge label={precisionBadge.label} variant={precisionBadge.variant} />
          </View>

          <View className="mt-5 gap-3">
            <View
              className="rounded-2xl px-4 py-3"
              style={{backgroundColor: COLORS.OFF_WHITE}}>
              <Text
                className="text-[11px] font-semibold uppercase tracking-[1.4px]"
                style={{color: COLORS.DISABLED_GREY}}>
                Diameter
              </Text>
              <Text
                className="mt-1 text-3xl font-bold"
                style={{color: COLORS.DARK_SLATE, fontFamily: 'RobotoMono-Bold'}}>
                {tree.dbh_cm.toFixed(1)} cm
              </Text>
            </View>

            <View
              className="rounded-2xl px-4 py-3"
              style={{backgroundColor: COLORS.OFF_WHITE}}>
              <Text
                className="text-[11px] font-semibold uppercase tracking-[1.4px]"
                style={{color: COLORS.DISABLED_GREY}}>
                Height source
              </Text>
              <Text className="mt-1 text-base font-semibold" style={{color: COLORS.DARK_SLATE}}>
                {getHeightSourceLabel(tree)}
              </Text>
            </View>

            <View
              className="rounded-2xl px-4 py-3"
              style={{backgroundColor: COLORS.OFF_WHITE}}>
              <Text
                className="text-[11px] font-semibold uppercase tracking-[1.4px]"
                style={{color: COLORS.DISABLED_GREY}}>
                GPS location
              </Text>
              <Text
                className="mt-1 text-base font-semibold"
                style={{color: COLORS.DARK_SLATE, fontFamily: 'RobotoMono-Regular'}}>
                {formatLatitude(tree.gps_lat)}, {formatLongitude(tree.gps_lng)}
              </Text>
              <Text className="mt-1 text-sm" style={{color: COLORS.DISABLED_GREY}}>
                Accuracy ± {tree.gps_accuracy_m.toFixed(1)} m
              </Text>
            </View>
          </View>
        </Card>

        <Card className="mt-4 overflow-hidden p-0">
          <View className="px-5 pb-4 pt-5">
            <Text className="text-lg font-semibold" style={{color: COLORS.DARK_SLATE}}>
              Evidence photo
            </Text>
            <Text className="mt-2 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
              This image hash is stored with the tree record for audit traceability.
            </Text>
          </View>

          {tree.evidence_photo_uri ? (
            <Image
              source={{uri: tree.evidence_photo_uri}}
              className="h-44 w-full bg-[#E5E7EB]"
              resizeMode="cover"
            />
          ) : (
            <View className="h-44 items-center justify-center bg-[#E5E7EB]">
              <Text style={{color: COLORS.DISABLED_GREY}}>No photo captured</Text>
            </View>
          )}

          {tree.evidence_photo_hash ? (
            <View className="px-5 py-4">
              <Text
                className="text-xs"
                style={{color: COLORS.DISABLED_GREY, fontFamily: 'RobotoMono-Regular'}}>
                SHA-256: {tree.evidence_photo_hash.substring(0, 24)}...
              </Text>
            </View>
          ) : null}
        </Card>

        <Card className="mt-4 px-5 py-5" style={{backgroundColor: '#F2FBF7'}}>
          <Text
            className="text-[13px] font-semibold uppercase tracking-[1.4px]"
            style={{color: COLORS.FOREST_GREEN}}>
            Zone progress
          </Text>
          <Text className="mt-2 text-lg font-semibold" style={{color: COLORS.DARK_SLATE}}>
            {zoneName}: {treesInZone} of {MAX_TREES_PER_ZONE} trees
          </Text>
          <Text className="mt-2 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
            Minimum {minimumTreesPerZone} trees are required in each zone before
            submission.
          </Text>
          <View className="mt-4 flex-row">
            {Array.from({length: MAX_TREES_PER_ZONE}).map((_, index) => (
              <View
                key={index}
                className="mr-2 h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    index < treesInZone ? COLORS.FOREST_GREEN : '#E2E8F0',
                }}
              />
            ))}
          </View>
        </Card>
      </ScrollView>

      <View
        className="border-t px-4 pt-4"
        style={{
          borderTopColor: '#E2E8F0',
          backgroundColor: COLORS.OFF_WHITE,
          paddingBottom: bottomSpacing,
        }}>
        <View className="self-center w-full" style={{maxWidth: contentMaxWidth}}>
          <Button
            label={hasSavedTree ? 'Tree Saved' : 'Confirm and save tree'}
            onPress={handleConfirmSave}
            disabled={hasSavedTree}
          />
          <Button
            className="mt-3"
            label="Rescan this tree"
            onPress={handleRescan}
            disabled={hasSavedTree}
            variant="secondary"
          />
        </View>
      </View>

      <BottomSheet visible={showZoneCompletionSheet} onClose={() => undefined}>
        <Text className="text-xl font-bold text-center" style={{color: COLORS.DARK_SLATE}}>
          {isLastZone ? 'All zones complete' : `${zoneName} complete`}
        </Text>
        <Text className="mt-3 text-center text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
          {isLastZone
            ? `${treesInZone} trees were scanned in ${zoneName}. Review the full audit and submit it for satellite verification.`
            : canScanMoreTrees
              ? `${treesInZone} trees were scanned in ${zoneName}. You can scan ${MAX_TREES_PER_ZONE - treesInZone} more tree${MAX_TREES_PER_ZONE - treesInZone === 1 ? '' : 's'} here or continue to ${nextZone?.label ?? `Zone ${currentZoneIndex + 2}`}.`
              : `You have reached the maximum of ${MAX_TREES_PER_ZONE} trees for ${zoneName}. Continue to ${nextZone?.label ?? `Zone ${currentZoneIndex + 2}`}.`}
        </Text>

        {canScanMoreTrees ? (
          <Button
            className="mt-6"
            label="Scan more trees in this zone"
            onPress={handleScanMoreTrees}
            variant="secondary"
          />
        ) : null}
        <Button
          className="mt-3"
          label={
            isLastZone
              ? 'Review and submit'
              : `Go to ${nextZone?.label ?? `Zone ${currentZoneIndex + 2}`}`
          }
          onPress={handleContinue}
        />
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
            Tree saved successfully
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default TreeResultScreen;
