import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import DeviceInfo from 'react-native-device-info';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {fetchZones} from '../store/auditSlice';
import type {AuditState} from '../store/auditSlice';
import type {LandState} from '../../land/store/landSlice';
import {isMockLocationEnabled} from '../../../services/ar-bridge';
import {hectaresToAcres} from '../../../common/utils/units';
import {ensureLocationPermission} from '../../../common/utils/permissions';
import {COLORS} from '../../../common/constants/colors';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AuditStartScreen'>;
type RouteType = RouteProp<RootStackParamList, 'AuditStartScreen'>;

const AuditStartScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {landId, landName} = route.params;
  const dispatch = useAppDispatch();

  const parcels = useAppSelector(
    state => (state.land as unknown as LandState).parcels,
  );
  const audit = useAppSelector(state => state.audit as unknown as AuditState);
  const parcel = parcels.find(p => p.id === landId);

  const [loading, setLoading] = useState(false);
  const [showRootWarning, setShowRootWarning] = useState(false);
  const [mockBlocked, setMockBlocked] = useState(false);

  React.useEffect(() => {
    Promise.all([
      DeviceInfo.getTags().catch(() => ''),
      DeviceInfo.getType().catch(() => 'user'),
    ]).then(([tags, buildType]) => {
      const rooted = tags.includes('test-keys') || buildType !== 'user';
      setShowRootWarning(rooted);
    });
  }, []);

  const handleStartAudit = useCallback(async () => {
    try {
      setLoading(true);

      const hasLocationPermission = await ensureLocationPermission();
      if (!hasLocationPermission) {
        Alert.alert(
          'Location Permission Required',
          'TerraTrust needs location access to navigate to your audit zones.',
        );
        setLoading(false);
        return;
      }

      // FR-012: Mock GPS check — full blocking screen
      const isMock = await isMockLocationEnabled();
      if (isMock) {
        setMockBlocked(true);
        setLoading(false);
        return;
      }

      const result = await dispatch(fetchZones(landId)).unwrap();
      navigation.navigate('ZoneNavigationScreen', {
        auditId: result.audit_id,
        landId,
      });
    } catch (error: any) {
      Alert.alert(
        'Unable to Start Audit',
        error?.message || audit.errorMessage || 'Please check your connection and try again.',
        [{text: 'Retry', onPress: handleStartAudit}, {text: 'Cancel'}],
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch, landId, navigation, audit.errorMessage]);

  const areaAcres = parcel
    ? hectaresToAcres(parcel.area_hectares).toFixed(1)
    : '—';
  const lastAudit = parcel?.last_audit_year
    ? String(parcel.last_audit_year)
    : 'No audit yet';

  // FR-012: Mock GPS full blocking screen
  if (mockBlocked) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{backgroundColor: COLORS.DARK_SLATE}}>
        <Text className="text-6xl mb-6">🚫</Text>
        <Text className="text-white text-xl font-bold text-center mb-4">
          Mock Location Detected
        </Text>
        <Text className="text-white/80 text-base text-center leading-6">
          Please disable Mock Location in Developer Settings to use this app.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      {/* Header */}
      <View className="pt-12 pb-5 px-5 flex-row items-center" style={{backgroundColor: COLORS.DARK_SLATE}}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-12 h-12 items-center justify-center rounded-full"
          accessibilityLabel="Go back">
          <Text className="text-white text-2xl">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-white text-xl font-bold text-center mr-12">
          Audit Overview
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{paddingBottom: 32}}>
        {/* Rooted device warning — FR-013 */}
        {showRootWarning && (
          <View className="mt-4 rounded-2xl px-4 py-3 flex-row items-center" style={{backgroundColor: '#FEF3C7'}}>
            <Text className="text-lg mr-3">⚠️</Text>
            <Text className="flex-1 text-sm leading-5" style={{color: '#92400E'}}>
              This device appears to be rooted. For your security, some features may not work correctly.
            </Text>
          </View>
        )}

        {/* Land Info Card — from Stitch design */}
        <View className="mt-5 bg-white rounded-2xl p-5 shadow-sm">
          <Text className="text-xl font-bold mb-4" style={{color: COLORS.DARK_SLATE}}>
            {landName}
          </Text>

          {/* Area row */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Text className="text-lg mr-3">📐</Text>
              <Text className="text-sm" style={{color: '#6B7280'}}>Area</Text>
            </View>
            <Text className="text-base font-bold" style={{fontFamily: 'RobotoMono-Bold', color: COLORS.DARK_SLATE}}>
              {areaAcres} acres
            </Text>
          </View>

          <View className="h-px bg-[#F2F4F2]" />

          {/* Last Audit row */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Text className="text-lg mr-3">📅</Text>
              <Text className="text-sm" style={{color: '#6B7280'}}>Last Audit</Text>
            </View>
            <Text className="text-base" style={{fontFamily: 'RobotoMono-Regular', color: COLORS.DARK_SLATE}}>
              {lastAudit}
            </Text>
          </View>

          <View className="h-px bg-[#F2F4F2]" />

          {/* Walking Distance row */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Text className="text-lg mr-3">🚶</Text>
              <Text className="text-sm" style={{color: '#6B7280'}}>Walking Distance</Text>
            </View>
            <Text className="text-base" style={{fontFamily: 'RobotoMono-Regular', color: COLORS.DARK_SLATE}}>
              ~{audit.walkingPathMetres || '—'} m
            </Text>
          </View>
        </View>

        {/* Center illustration / Lottie area */}
        <View className="items-center mt-8">
          {loading ? (
            <LottieView
              source={require('../../../assets/lottie/spinning_leaf.json')}
              autoPlay
              loop
              style={{width: 120, height: 120}}
            />
          ) : (
            <View className="w-28 h-28 rounded-full items-center justify-center" style={{backgroundColor: '#D1FAE5'}}>
              <Text className="text-5xl">🌿</Text>
            </View>
          )}
        </View>

        {/* Description text */}
        <Text className="text-sm text-center mt-5 leading-6 px-4" style={{color: '#6B7280'}}>
          You will walk to {audit.zones.length || '—'} locations on your land and scan trees at each one.
          This takes about 20-30 minutes.
        </Text>
      </ScrollView>

      {/* Start Audit CTA */}
      <View className="px-5 pb-8 pt-3" style={{backgroundColor: COLORS.OFF_WHITE}}>
        <TouchableOpacity
          onPress={handleStartAudit}
          disabled={loading}
          className="h-14 rounded-xl items-center justify-center"
          style={{backgroundColor: loading ? 'rgba(47,133,90,0.6)' : COLORS.FOREST_GREEN}}
          activeOpacity={0.7}>
          <Text className="text-white text-base font-bold">
            {loading ? 'Generating Zones...' : 'Start Audit'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AuditStartScreen;
