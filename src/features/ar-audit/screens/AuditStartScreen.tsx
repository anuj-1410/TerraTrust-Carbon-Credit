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
import {isEmulator} from 'react-native-device-info';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {fetchZones} from '../store/auditSlice';
import type {AuditState} from '../store/auditSlice';
import type {LandState} from '../../land/store/landSlice';
import {isMockLocationEnabled} from '../../../services/ar-bridge';
import {hectaresToAcres} from '../../../common/utils/units';

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
  const [isRooted, setIsRooted] = useState(false);
  const [mockBlocked, setMockBlocked] = useState(false);

  React.useEffect(() => {
    isEmulator().then((emulator: boolean) => setIsRooted(emulator));
  }, []);

  const handleStartAudit = useCallback(async () => {
    try {
      setLoading(true);

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
      <View className="flex-1 items-center justify-center bg-[#1B4332] px-8">
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
          Audit Overview
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{paddingBottom: 32}}>
        {/* Rooted device warning — FR-013 */}
        {isRooted && (
          <View className="mt-4 bg-[#FEF3C7] rounded-2xl px-4 py-3 flex-row items-center">
            <Text className="text-lg mr-3">⚠️</Text>
            <Text className="flex-1 text-[#92400E] text-sm leading-5">
              This device appears to be rooted. Audit data may be less trusted.
            </Text>
          </View>
        )}

        {/* Land Info Card — from Stitch design */}
        <View className="mt-5 bg-white rounded-2xl p-5 shadow-sm">
          <Text className="text-[#191C1B] text-xl font-bold mb-4">
            {landName}
          </Text>

          {/* Area row */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Text className="text-lg mr-3">📐</Text>
              <Text className="text-[#6B7280] text-sm">Area</Text>
            </View>
            <Text className="text-[#191C1B] text-base font-bold" style={{fontFamily: 'RobotoMono-Bold'}}>
              {areaAcres} acres
            </Text>
          </View>

          <View className="h-px bg-[#F2F4F2]" />

          {/* Last Audit row */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Text className="text-lg mr-3">📅</Text>
              <Text className="text-[#6B7280] text-sm">Last Audit</Text>
            </View>
            <Text className="text-[#191C1B] text-base" style={{fontFamily: 'RobotoMono-Regular'}}>
              {lastAudit}
            </Text>
          </View>

          <View className="h-px bg-[#F2F4F2]" />

          {/* Walking Distance row */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <Text className="text-lg mr-3">🚶</Text>
              <Text className="text-[#6B7280] text-sm">Walking Distance</Text>
            </View>
            <Text className="text-[#191C1B] text-base" style={{fontFamily: 'RobotoMono-Regular'}}>
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
            <View className="w-28 h-28 rounded-full bg-[#D1FAE5] items-center justify-center">
              <Text className="text-5xl">🌿</Text>
            </View>
          )}
        </View>

        {/* Description text */}
        <Text className="text-[#6B7280] text-sm text-center mt-5 leading-6 px-4">
          We'll generate satellite-guided sampling zones for your land. Walk to
          each zone and scan trees.
        </Text>
      </ScrollView>

      {/* Start Audit CTA */}
      <View className="px-5 pb-8 pt-3 bg-[#F8FAF8]">
        <TouchableOpacity
          onPress={handleStartAudit}
          disabled={loading}
          className={`h-14 rounded-xl items-center justify-center ${
            loading ? 'bg-[#40916C]/60' : 'bg-[#2D6A4F]'
          }`}
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
