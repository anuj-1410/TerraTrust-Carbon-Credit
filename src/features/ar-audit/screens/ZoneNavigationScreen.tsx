import React, {useEffect, useRef} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import MapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppSelector} from '../../../store/hooks';
import type {AuditState} from '../store/auditSlice';
import type {LandState} from '../../land/store/landSlice';
import {useGeofence} from '../../../common/hooks/useGeofence';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ZoneNavigationScreen'>;
type RouteType = RouteProp<RootStackParamList, 'ZoneNavigationScreen'>;

const ZoneNavigationScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {landId} = route.params;

  const audit = useAppSelector(state => state.audit as unknown as AuditState);
  const parcels = useAppSelector(
    state => (state.land as unknown as LandState).parcels,
  );
  const parcel = parcels.find(p => p.id === landId);
  const boundary = parcel?.boundary_geojson ?? null;

  const {zones, currentZoneIndex, scannedTrees, minTreesRequired} = audit;
  const currentZone = zones[currentZoneIndex] ?? null;

  const {isInsideBoundary, isAtZoneCentre, currentPosition} = useGeofence(
    boundary,
    currentZone,
  );

  // Fire haptic on zone arrival
  const prevAtZone = useRef(false);
  useEffect(() => {
    if (isAtZoneCentre && !prevAtZone.current) {
      ReactNativeHapticFeedback.trigger('impactMedium');
    }
    prevAtZone.current = isAtZoneCentre;
  }, [isAtZoneCentre]);

  const mapRef = useRef<MapView>(null);

  // Centre map on current zone
  useEffect(() => {
    if (currentZone && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentZone.centre_gps.lat,
          longitude: currentZone.centre_gps.lng,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        500,
      );
    }
  }, [currentZone]);

  const treesInCurrentZone = scannedTrees.filter(
    t => t.zone_id === currentZone?.zone_id,
  ).length;
  const treesPerZone = Math.max(
    3,
    Math.floor(minTreesRequired / Math.max(zones.length, 1)),
  );

  const handleStartScanning = () => {
    if (!currentZone) return;
    navigation.navigate('ARCameraScreen', {
      zoneId: currentZone.zone_id,
      zoneIndex: currentZoneIndex,
    });
  };

  // Compute distance to current zone centre
  const distanceToZone = (() => {
    if (!currentPosition || !currentZone) return null;
    const R = 6371000;
    const dLat =
      ((currentZone.centre_gps.lat - currentPosition.lat) * Math.PI) / 180;
    const dLng =
      ((currentZone.centre_gps.lng - currentPosition.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((currentPosition.lat * Math.PI) / 180) *
        Math.cos((currentZone.centre_gps.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  })();

  return (
    <View className="flex-1 bg-[#F8FAF8]">
      {/* Header */}
      <View className="bg-[#1B4332] pt-12 pb-4 px-5 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-12 h-12 items-center justify-center rounded-full"
          accessibilityLabel="Go back">
          <Text className="text-white text-2xl">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-white text-xl font-bold text-center">
          Zone Navigation
        </Text>
        <Text className="text-white/70 text-sm">
          Zone {currentZoneIndex + 1} of {zones.length}
        </Text>
      </View>

      {/* Map — mapType="standard" ONLY, NEVER satellite */}
      <View className="flex-1">
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          mapType="standard"
          style={{flex: 1}}
          cacheEnabled
          loadingEnabled
          showsUserLocation={false}
          initialRegion={
            currentZone
              ? {
                  latitude: currentZone.centre_gps.lat,
                  longitude: currentZone.centre_gps.lng,
                  latitudeDelta: 0.003,
                  longitudeDelta: 0.003,
                }
              : undefined
          }>
          {/* Farmer GPS blue dot */}
          {currentPosition && (
            <Marker
              coordinate={{
                latitude: currentPosition.lat,
                longitude: currentPosition.lng,
              }}
              anchor={{x: 0.5, y: 0.5}}>
              <View className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow" />
            </Marker>
          )}

          {/* Zone circles */}
          {zones.map((zone, idx) => {
            const isComplete = zone.is_complete;
            const isCurrent = idx === currentZoneIndex;
            const fillColor = isComplete
              ? 'rgba(156,163,175,0.25)'
              : isCurrent
                ? 'rgba(45,106,79,0.20)'
                : 'rgba(200,200,200,0.15)';
            const strokeColor = isComplete
              ? '#9CA3AF'
              : isCurrent
                ? '#2D6A4F'
                : '#D1D5DB';

            return (
              <Circle
                key={zone.zone_id}
                center={{
                  latitude: zone.centre_gps.lat,
                  longitude: zone.centre_gps.lng,
                }}
                radius={zone.radius_metres}
                fillColor={fillColor}
                strokeColor={strokeColor}
                strokeWidth={2}
              />
            );
          })}

          {/* Zone label markers */}
          {zones.map((zone, idx) => {
            const isComplete = zone.is_complete;
            return (
              <Marker
                key={`label-${zone.zone_id}`}
                coordinate={{
                  latitude: zone.centre_gps.lat,
                  longitude: zone.centre_gps.lng,
                }}
                anchor={{x: 0.5, y: 0.5}}>
                <View
                  className={`w-7 h-7 rounded-full items-center justify-center ${
                    isComplete
                      ? 'bg-[#9CA3AF]'
                      : idx === currentZoneIndex
                        ? 'bg-[#2D6A4F]'
                        : 'bg-white border border-[#D1D5DB]'
                  }`}>
                  {isComplete ? (
                    <Text className="text-white text-xs font-bold">✓</Text>
                  ) : (
                    <Text
                      className={`text-xs font-bold ${
                        idx === currentZoneIndex
                          ? 'text-white'
                          : 'text-[#6B7280]'
                      }`}>
                      {idx + 1}
                    </Text>
                  )}
                </View>
              </Marker>
            );
          })}

          {/* Walking path polyline */}
          {zones.length > 1 && (
            <Polyline
              coordinates={zones.map(z => ({
                latitude: z.centre_gps.lat,
                longitude: z.centre_gps.lng,
              }))}
              strokeColor="#40916C"
              strokeWidth={2}
              lineDashPattern={[8, 6]}
            />
          )}
        </MapView>
      </View>

      {/* Geofence warning banner — FR-008 */}
      {currentPosition && !isInsideBoundary && (
        <View className="mx-4 mt-2 bg-[#FEF3C7] rounded-2xl px-4 py-3 flex-row items-center">
          <Text className="text-lg mr-3">⚠️</Text>
          <Text className="flex-1 text-[#92400E] text-sm leading-5">
            You appear to be outside your registered land boundary. Please
            return to your land to scan.
          </Text>
        </View>
      )}

      {/* Zone Info Card — from Stitch design */}
      <View className="mx-4 mt-3 bg-white rounded-2xl p-4 shadow-sm">
        <Text className="text-[#191C1B] text-lg font-bold">
          {currentZone?.label ?? `Zone ${currentZoneIndex + 1}`}
        </Text>

        {/* Distance + status row */}
        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center">
            <Text className="text-base mr-2">🚶</Text>
            <Text
              className="text-[#6B7280] text-sm"
              style={{fontFamily: 'RobotoMono-Regular'}}>
              {distanceToZone !== null ? `~${distanceToZone}m away` : '— m'}
            </Text>
          </View>
          <View
            className={`px-3 py-1 rounded-full ${
              isAtZoneCentre ? 'bg-[#D1FAE5]' : 'bg-[#F3F4F6]'
            }`}>
            <Text
              className={`text-xs font-semibold ${
                isAtZoneCentre ? 'text-[#065F46]' : 'text-[#6B7280]'
              }`}>
              {isAtZoneCentre ? 'Near zone' : 'Walking to zone'}
            </Text>
          </View>
        </View>

        {/* Trees progress */}
        <View className="flex-row items-center mt-3">
          <Text className="text-[#6B7280] text-sm">
            {treesInCurrentZone} of {treesPerZone} trees scanned
          </Text>
          {/* Mini dots */}
          <View className="flex-row ml-3">
            {Array.from({length: treesPerZone}).map((_, i) => (
              <View
                key={i}
                className={`w-2 h-2 rounded-full mr-1 ${
                  i < treesInCurrentZone ? 'bg-[#2D6A4F]' : 'bg-[#E5E7EB]'
                }`}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Action button — FR-006, FR-007 */}
      <View className="px-4 pb-8 pt-3">
        <TouchableOpacity
          onPress={handleStartScanning}
          disabled={!isAtZoneCentre || (currentPosition != null && !isInsideBoundary)}
          className={`h-14 rounded-xl items-center justify-center flex-row ${
            isAtZoneCentre && (isInsideBoundary || !currentPosition)
              ? 'bg-[#2D6A4F]'
              : 'bg-[#9CA3AF]'
          }`}
          activeOpacity={0.7}>
          <Text className="text-white text-base font-bold">
            {isAtZoneCentre
              ? "You're here — Start Scanning"
              : `Walk to Zone ${currentZoneIndex + 1}`}
          </Text>
          <Text className="text-white text-lg ml-2">
            {isAtZoneCentre ? '📷' : '🔒'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ZoneNavigationScreen;
