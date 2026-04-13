import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  Image,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import DeviceInfo from 'react-native-device-info';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {fetchZones, setOriginTab} from '../store/auditSlice';
import type {FetchZonesError} from '../store/auditSlice';
import {isMockLocationEnabled} from '../../../services/ar-bridge';
import {hectaresToAcres} from '../../../common/utils/units';
import {ensureLocationPermission} from '../../../common/utils/permissions';
import {COLORS} from '../../../common/constants/colors';
import {IS_AUDIT_DEMO_MODE} from '../utils/demoMode';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AuditStartScreen'>;
type RouteType = RouteProp<RootStackParamList, 'AuditStartScreen'>;
type RootAwareDeviceInfo = typeof DeviceInfo & {
  isRooted?: () => Promise<boolean>;
};

const AuditStartScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {landId, landName, originTab = 'HomeTab'} = route.params;
  const dispatch = useAppDispatch();

  const parcels = useAppSelector(state => state.land.parcels);
  const audit = useAppSelector(state => state.audit);
  const parcel = parcels.find(p => p.id === landId);

  const [loading, setLoading] = useState(false);
  const [showRootWarning, setShowRootWarning] = useState(false);
  const [mockBlocked, setMockBlocked] = useState(false);

  React.useEffect(() => {
    const rootAwareDeviceInfo = DeviceInfo as RootAwareDeviceInfo;

    if (typeof rootAwareDeviceInfo.isRooted !== 'function') {
      setShowRootWarning(false);
      return;
    }

    void rootAwareDeviceInfo
      .isRooted()
      .then(setShowRootWarning)
      .catch(() => setShowRootWarning(false));
  }, []);

  const handleCancelAudit = useCallback(() => {
    Alert.alert('Cancel audit?', 'Your progress will be saved.', [
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

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleCancelAudit();
        return true;
      },
    );

    return () => subscription.remove();
  }, [handleCancelAudit]);

  const handleStartAudit = useCallback(async () => {
    try {
      setLoading(true);

      if (!IS_AUDIT_DEMO_MODE) {
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
      }

      dispatch(setOriginTab(originTab));
      const result = await dispatch(fetchZones(landId)).unwrap();
      navigation.navigate('ZoneNavigationScreen', {
        auditId: result.audit_id,
        landId,
        originTab,
      });
    } catch (error: any) {
      const fetchZonesError = error as FetchZonesError;

      if (fetchZonesError.existingAuditId) {
        navigation.replace('AuditStatusScreen', {
          auditId: fetchZonesError.existingAuditId,
        });
        return;
      }

      Alert.alert(
        'Unable to Start Audit',
        fetchZonesError.message ||
          audit.errorMessage ||
          'Please check your connection and try again.',
        [{text: 'Retry', onPress: handleStartAudit}, {text: 'Cancel'}],
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch, landId, navigation, audit.errorMessage, originTab]);

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
        <MaterialCommunityIcons
          color="#FFFFFF"
          name="map-marker-off"
          size={60}
        />
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
          onPress={handleCancelAudit}
          className="w-12 h-12 items-center justify-center rounded-full"
          accessibilityLabel="Cancel audit">
          <MaterialCommunityIcons color="#FFFFFF" name="close" size={24} />
        </TouchableOpacity>
        <Text className="flex-1 text-white text-xl font-bold text-center mr-12">
          Annual Audit
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{paddingBottom: 32}}>
        {/* Rooted device warning — FR-013 */}
        {showRootWarning && (
          <View className="mt-4 rounded-2xl px-4 py-3 flex-row items-center" style={{backgroundColor: '#FEF3C7'}}>
            <MaterialCommunityIcons color="#92400E" name="alert-outline" size={20} />
            <Text className="flex-1 text-sm leading-5" style={{color: '#92400E'}}>
              This device appears to be rooted. For your security, some features may not work correctly.
            </Text>
          </View>
        )}

        {/* Land Info Card — from Stitch design */}
        <View className="mt-5 bg-white rounded-2xl p-5 shadow-sm">
          <View className="mb-4 flex-row items-center">
            {parcel?.thumbnail_url ? (
              <Image
                source={{uri: parcel.thumbnail_url}}
                className="h-20 w-20 rounded-2xl"
                resizeMode="cover"
              />
            ) : (
              <View
                className="h-20 w-20 items-center justify-center rounded-2xl"
                style={{backgroundColor: '#D1FAE5'}}>
                <MaterialCommunityIcons
                  color={COLORS.FOREST_GREEN}
                  name="sprout"
                  size={28}
                />
              </View>
            )}
            <View className="ml-4 flex-1">
              <Text className="text-xl font-bold" style={{color: COLORS.DARK_SLATE}}>
                {landName}
              </Text>
              <Text className="mt-1 text-sm" style={{color: '#6B7280'}}>
                Annual audit for this verified parcel
              </Text>
            </View>
          </View>

          {/* Area row */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <MaterialCommunityIcons color="#6B7280" name="ruler" size={18} />
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
              <MaterialCommunityIcons color="#6B7280" name="calendar-blank-outline" size={18} />
              <Text className="text-sm" style={{color: '#6B7280'}}>Last Audit</Text>
            </View>
            <Text className="text-base" style={{fontFamily: 'RobotoMono-Regular', color: COLORS.DARK_SLATE}}>
              {lastAudit}
            </Text>
          </View>

          <View className="h-px bg-[#F2F4F2]" />

          {/* Status row */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center">
              <MaterialCommunityIcons color="#6B7280" name="check-circle-outline" size={18} />
              <Text className="text-sm" style={{color: '#6B7280'}}>Status</Text>
            </View>
            <Text className="text-base" style={{fontFamily: 'RobotoMono-Regular', color: COLORS.DARK_SLATE}}>
              Ready to start
            </Text>
          </View>
        </View>

        <View className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <Text className="text-sm uppercase tracking-widest" style={{color: COLORS.DISABLED_GREY}}>
            AR Precision
          </Text>
          <Text className="mt-2 text-lg font-bold" style={{color: COLORS.DARK_SLATE}}>
            {audit.arTier === 1
              ? 'High Precision'
              : audit.arTier === 2
                ? 'Standard Precision'
                : 'Manual Measurement Fallback'}
          </Text>
          <Text className="mt-2 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
            {audit.arTier === 1
              ? 'Your phone supports full depth AR. TerraTrust will guide a still 3-second diameter scan.'
              : audit.arTier === 2
                ? 'Your phone supports motion-based AR. TerraTrust will guide a left-right measurement scan.'
                : 'Your phone will use the documented string-measurement fallback during tree scans.'}
          </Text>
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
              <MaterialCommunityIcons color={COLORS.FOREST_GREEN} name="sprout" size={46} />
            </View>
          )}
        </View>

        {/* Description text */}
        <Text className="text-sm text-center mt-5 leading-6 px-4" style={{color: '#6B7280'}}>
          TerraTrust will generate your sampling zones and guide you through each tree scan on your land.
          This usually takes about 20-30 minutes.
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
