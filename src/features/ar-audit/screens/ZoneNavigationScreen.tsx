import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  BackHandler,
  Linking,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import MapView, {
  Circle,
  Marker,
  Polygon,
  Polyline,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppSelector} from '../../../store/hooks';
import {useGeofence} from '../../../common/hooks/useGeofence';
import {ensureLocationPermission} from '../../../common/utils/permissions';
import {COLORS} from '../../../common/constants/colors';
import {IS_AUDIT_DEMO_MODE} from '../utils/demoMode';
import {GPS_RELIABLE_ACCURACY_METRES} from '../../../common/utils/location';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ZoneNavigationScreen'>;
type RouteType = RouteProp<RootStackParamList, 'ZoneNavigationScreen'>;

const ZoneNavigationScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {landId, originTab: routeOriginTab} = route.params;

  const audit = useAppSelector(state => state.audit);
  const parcels = useAppSelector(state => state.land.parcels);
  const parcel = parcels.find(p => p.id === landId);
  const boundary = parcel?.boundary_geojson ?? null;

  const {zones, currentZoneIndex, scannedTrees, minTreesRequired} = audit;
  const originTab = audit.originTab ?? routeOriginTab ?? 'HomeTab';
  const currentZone = zones[currentZoneIndex] ?? null;

  const ZONE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const currentZoneLetter = ZONE_LETTERS[currentZoneIndex] ?? String(currentZoneIndex + 1);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<
    'granted' | 'denied' | 'blocked' | null
  >(null);

  // Convert farm boundary GeoJSON to polygon coordinates
  const boundaryCoords = React.useMemo(() => {
    if (!boundary?.coordinates?.[0]) return [];
    return boundary.coordinates[0].map(c => ({latitude: c[1], longitude: c[0]}));
  }, [boundary]);

  const {
    isInsideBoundary,
    isAtZoneCentre,
    currentPosition,
    gpsAccuracy,
    hasWeakSignal,
    hasReliableFix,
    isMockedLocation,
  } = useGeofence(
    boundary,
    currentZone,
    landId,
  );

  useEffect(() => {
    if (IS_AUDIT_DEMO_MODE) {
      setLocationPermissionStatus('granted');
      return;
    }

    void ensureLocationPermission().then(result => {
      setLocationPermissionStatus(result.status);
    });
  }, []);

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
  const hasLocationPermission = locationPermissionStatus === 'granted';
  const satisfiesBoundary = boundary ? isInsideBoundary : true;
  const canStartScanning =
    (IS_AUDIT_DEMO_MODE || hasLocationPermission) &&
    Boolean(currentPosition) &&
    hasReliableFix &&
    !hasWeakSignal &&
    !isMockedLocation &&
    isAtZoneCentre &&
    satisfiesBoundary;

  const handleStartScanning = () => {
    if (!currentZone) return;
    navigation.navigate('ARCameraScreen', {
      zoneId: currentZone.zone_id,
      zoneIndex: currentZoneIndex,
    });
  };

  const handleExitAudit = useCallback(() => {
    Alert.alert('Exit audit?', 'Your progress will be saved.', [
      {text: 'Keep auditing', style: 'cancel'},
      {
        text: 'Exit audit',
        style: 'destructive',
        onPress: () =>
          navigation.reset({
            index: 0,
            routes: [{name: 'HomeScreen', params: {screen: originTab}}],
          }),
      },
    ]);
  }, [navigation, originTab]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleExitAudit();
        return true;
      },
    );

    return () => subscription.remove();
  }, [handleExitAudit]);

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
          {boundaryCoords.length > 0 && (
            <Polygon
              coordinates={boundaryCoords}
              strokeColor={COLORS.FOREST_GREEN}
              strokeWidth={2}
              lineDashPattern={[10, 5]}
              fillColor="rgba(47, 133, 90, 0.05)"
            />
          )}

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

          {scannedTrees.map(tree => (
            <Marker
              key={tree.tree_id}
              coordinate={{
                latitude: tree.gps_lat,
                longitude: tree.gps_lng,
              }}
              anchor={{x: 0.5, y: 0.5}}>
              <View
                className="h-3.5 w-3.5 rounded-full border border-white"
                style={{
                  backgroundColor:
                    tree.zone_id === currentZone?.zone_id
                      ? COLORS.FOREST_GREEN
                      : COLORS.TEAL,
                }}
              />
            </Marker>
          ))}

          {/* Zone circles */}
          {zones.map((zone, idx) => {
            const isComplete = zone.is_complete;
            const isCurrent = idx === currentZoneIndex;
            const fillColor = isComplete
              ? 'rgba(160,174,192,0.25)'
              : isCurrent
                ? 'rgba(56,178,172,0.18)'
                : 'rgba(200,200,200,0.12)';
            const strokeColor = isComplete
              ? COLORS.DISABLED_GREY
              : isCurrent
                ? COLORS.TEAL
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

          {/* Zone label markers — current zone labeled, completed/upcoming unlabeled */}
          {zones.map((zone, idx) => {
            const isComplete = zone.is_complete;
            const isCurrent = idx === currentZoneIndex;
            const zoneLetter = ZONE_LETTERS[idx] ?? String(idx + 1);
            return (
              <Marker
                key={`label-${zone.zone_id}`}
                coordinate={{
                  latitude: zone.centre_gps.lat,
                  longitude: zone.centre_gps.lng,
                }}
                anchor={{x: 0.5, y: 0.5}}>
                {isCurrent ? (
                  <View
                    className="rounded-full px-3 py-2"
                    style={{backgroundColor: COLORS.TEAL}}>
                    <Text className="text-xs font-bold text-white">
                      Zone {zoneLetter}
                    </Text>
                  </View>
                ) : (
                  <View
                    className="h-7 w-7 rounded-full"
                    style={{
                      backgroundColor: isComplete ? COLORS.DISABLED_GREY : COLORS.CARD_WHITE,
                      borderWidth: isComplete ? 0 : 2,
                      borderColor: COLORS.DISABLED_GREY,
                    }}
                  />
                )}
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

        <View className="absolute left-4 right-4 top-12 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={handleExitAudit}
            className="h-12 w-12 items-center justify-center rounded-full bg-black/30"
            accessibilityLabel="Exit audit">
            <MaterialCommunityIcons color="#FFFFFF" name="arrow-left" size={24} />
          </TouchableOpacity>
          <View className="rounded-full bg-black/30 px-4 py-2">
            <Text className="text-sm font-semibold text-white">
              Zone {currentZoneIndex + 1} of {zones.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Geofence warning banner — FR-008 */}
      {currentPosition && !hasWeakSignal && !isInsideBoundary && (
        <View className="mx-4 mt-2 bg-[#FEF3C7] rounded-2xl px-4 py-3 flex-row items-center">
          <MaterialCommunityIcons color="#92400E" name="alert-outline" size={20} />
          <Text className="flex-1 text-[#92400E] text-sm leading-5">
            You appear to be outside your registered land boundary. Please
            return to your land to scan.
          </Text>
        </View>
      )}

      {locationPermissionStatus === 'denied' && !IS_AUDIT_DEMO_MODE && (
        <View className="mx-4 mt-2 rounded-2xl px-4 py-3 flex-row items-center" style={{backgroundColor: '#FEF3C7'}}>
          <MaterialCommunityIcons color="#92400E" name="map-marker-outline" size={20} />
          <Text className="flex-1 text-sm leading-5" style={{color: '#92400E'}}>
            Location permission is required to navigate to your audit zone.
          </Text>
        </View>
      )}

      {locationPermissionStatus === 'blocked' && !IS_AUDIT_DEMO_MODE && (
        <View className="mx-4 mt-2 rounded-2xl px-4 py-3" style={{backgroundColor: '#FEF3C7'}}>
          <View className="flex-row items-center">
            <MaterialCommunityIcons color="#92400E" name="map-marker-off-outline" size={20} />
            <Text className="ml-3 flex-1 text-sm leading-5" style={{color: '#92400E'}}>
              Location access is blocked. Enable it in Settings before scanning this zone.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              void Linking.openSettings();
            }}
            className="mt-3 self-start rounded-xl border px-4 py-2"
            style={{borderColor: '#92400E'}}>
            <Text style={{color: '#92400E'}}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {hasWeakSignal && gpsAccuracy !== null && (
        <View className="mx-4 mt-2 rounded-2xl px-4 py-3 flex-row items-center" style={{backgroundColor: '#FEF3C7'}}>
          <MaterialCommunityIcons color="#92400E" name="crosshairs-question" size={20} />
          <Text className="flex-1 text-sm leading-5" style={{color: '#92400E'}}>
            GPS signal is weak right now (accuracy ±{Math.round(gpsAccuracy)}m). TerraTrust needs accuracy within {GPS_RELIABLE_ACCURACY_METRES}m before scanning can start.
          </Text>
        </View>
      )}

      {isMockedLocation && !IS_AUDIT_DEMO_MODE && (
        <View className="mx-4 mt-2 rounded-2xl px-4 py-3 flex-row items-center" style={{backgroundColor: '#FEE2E2'}}>
          <MaterialCommunityIcons color={COLORS.ERROR_RED} name="map-marker-off" size={20} />
          <Text className="ml-3 flex-1 text-sm leading-5" style={{color: COLORS.ERROR_RED}}>
            Mock location was detected on this GPS fix. Disable mock location before scanning.
          </Text>
        </View>
      )}

      {/* Zone Info Card */}
      <View className="mx-4 mt-3 bg-white rounded-2xl p-4 shadow-sm">
        <Text className="text-[#191C1B] text-lg font-bold">
          Zone {currentZoneLetter}
        </Text>

        {/* Distance + status row */}
        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center">
            <MaterialCommunityIcons color="#6B7280" name="walk" size={18} />
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

        {distanceToZone !== null && distanceToZone > 0 && currentZone && currentPosition && (
          <Text className="text-[#6B7280] text-sm mt-2">
            Zone {currentZoneLetter} is {distanceToZone}m away. Walk toward the{' '}
            {(() => {
              const dLat = currentZone.centre_gps.lat - currentPosition.lat;
              const dLng = currentZone.centre_gps.lng - currentPosition.lng;
              if (Math.abs(dLat) > Math.abs(dLng)) {
                return dLat > 0 ? 'north' : 'south';
              }
              return dLng > 0 ? 'east' : 'west';
            })()}{' '}
            corner of your field.
          </Text>
        )}

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
          disabled={!canStartScanning}
          className={`h-14 rounded-xl items-center justify-center flex-row ${
            canStartScanning
              ? 'bg-[#2D6A4F]'
              : 'bg-[#9CA3AF]'
          }`}
          activeOpacity={0.7}>
          <Text className="text-white text-base font-bold">
            {isAtZoneCentre
              ? "You're here — Start Scanning"
              : `Start Scanning in Zone ${currentZoneLetter}`}
          </Text>
          <MaterialCommunityIcons
            color="#FFFFFF"
            name={isAtZoneCentre ? 'camera-outline' : 'lock-outline'}
            size={18}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ZoneNavigationScreen;
