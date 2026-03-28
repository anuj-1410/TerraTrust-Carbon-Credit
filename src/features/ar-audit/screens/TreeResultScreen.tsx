import React, {useCallback} from 'react';
import {View, Text, TouchableOpacity, ScrollView, Image} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import type {AuditState} from '../store/auditSlice';
import {addScannedTree, setCurrentZoneIndex} from '../store/auditSlice';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'TreeResultScreen'>;
type RouteType = RouteProp<RootStackParamList, 'TreeResultScreen'>;

const TreeResultScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const dispatch = useAppDispatch();
  const audit = useAppSelector(state => state.audit as unknown as AuditState);
  const {scannedTrees, zones, currentZoneIndex, minTreesRequired} = audit;

  // Flaw #85: Read pending tree from route params instead of already-saved array
  const tree = route.params.pendingTree;
  const currentZone = zones[currentZoneIndex] ?? null;

  // Count includes already-saved trees + this pending one
  const treesInZone = scannedTrees.filter(
    t => t.zone_id === currentZone?.zone_id,
  ).length + 1; // +1 for pending tree
  const treesPerZone = Math.max(
    3,
    Math.floor(minTreesRequired / Math.max(zones.length, 1)),
  );

  const precisionBadge = (() => {
    if (!tree) return {label: '', bgColor: '', textColor: ''};
    if (tree.measurement_tier === 1)
      return {
        label: '◉ High Precision',
        bgColor: 'bg-[#D1FAE5]',
        textColor: 'text-[#065F46]',
      };
    if (tree.measurement_tier === 2)
      return {
        label: '◉ Standard Precision',
        bgColor: 'bg-[#FEF3C7]',
        textColor: 'text-[#92400E]',
      };
    return {
      label: '◎ Manual Measurement',
      bgColor: 'bg-[#F3F4F6]',
      textColor: 'text-[#6B7280]',
    };
  })();

  const zoneMinReached = treesInZone >= treesPerZone;
  const allZonesComplete =
    zoneMinReached && currentZoneIndex >= zones.length - 1;

  // Flaw #85/#86: "Confirm and Save Tree" — dispatches addScannedTree
  const handleConfirmSave = useCallback(() => {
    if (!tree) return;
    dispatch(addScannedTree(tree));

    if (allZonesComplete) {
      navigation.navigate('AuditCompleteScreen');
    } else if (zoneMinReached) {
      dispatch(setCurrentZoneIndex(currentZoneIndex + 1));
      navigation.navigate('ZoneNavigationScreen', {
        auditId: audit.activeAuditId!,
        landId: audit.activeLandId!,
      });
    } else {
      navigation.navigate('ARCameraScreen', {
        zoneId: currentZone?.zone_id ?? '',
        zoneIndex: currentZoneIndex,
      });
    }
  }, [
    tree,
    allZonesComplete,
    zoneMinReached,
    currentZoneIndex,
    audit.activeAuditId,
    audit.activeLandId,
    currentZone,
    dispatch,
    navigation,
  ]);

  // Flaw #87: Rescan discards pendingTree — just navigate back without saving
  const handleRescan = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

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
          onPress={() => navigation.goBack()}
          className="w-12 h-12 items-center justify-center rounded-full"
          accessibilityLabel="Go back">
          <Text className="text-white text-2xl">←</Text>
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
              <Text className="text-lg mr-2">🌿</Text>
              <Text className="text-[#191C1B] text-xl font-bold">
                {tree.species}
              </Text>
            </View>
            <View className="bg-[#D1FAE5] px-3 py-1 rounded-full flex-row items-center">
              <Text className="text-[#065F46] text-xs font-semibold">
                ✓ Verified
              </Text>
            </View>
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
            <View
              className={`self-start px-3 py-1 rounded-full mt-2 ${precisionBadge.bgColor}`}>
              <Text
                className={`text-xs font-semibold ${precisionBadge.textColor}`}>
                {precisionBadge.label}
              </Text>
            </View>
          </View>

          <View className="h-px bg-[#F2F4F2]" />

          {/* Height */}
          <View className="py-4">
            <Text className="text-[#6B7280] text-sm mb-1">Height Source</Text>
            <Text className="text-[#191C1B] text-base">
              {tree.ar_height_m !== null ? (
                <Text style={{fontFamily: 'RobotoMono-Regular'}}>
                  AR Measured: {tree.ar_height_m} m
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
              {tree.gps_lat.toFixed(4)}°N, {tree.gps_lng.toFixed(4)}°E
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
            {treesInZone} of {treesPerZone} trees scanned
          </Text>
          <View className="flex-row mt-2">
            {Array.from({length: treesPerZone}).map((_, i) => (
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
          className="h-14 rounded-xl bg-[#2D6A4F] items-center justify-center flex-row"
          activeOpacity={0.7}>
          <Text className="text-white text-base font-bold">
            Confirm and Save Tree
          </Text>
          <Text className="text-white text-lg ml-2">✓</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRescan}
          className="mt-3 h-12 rounded-xl border-2 border-[#D1D5DB] items-center justify-center flex-row"
          activeOpacity={0.7}>
          <Text className="text-[#6B7280] text-base font-semibold">
            Rescan This Tree
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TreeResultScreen;
