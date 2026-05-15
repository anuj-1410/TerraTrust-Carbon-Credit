import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  Image,
  Linking,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import DeviceInfo from 'react-native-device-info';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {detectAndSetARTier, fetchZones, setOriginTab} from '../store/auditSlice';
import type {FetchZonesError} from '../store/auditSlice';
import {hectaresToAcres} from '../../../common/utils/units';
import {
  ensureCameraPermission,
  ensureLocationPermission,
} from '../../../common/utils/permissions';
import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';
import {IS_AUDIT_DEMO_MODE} from '../utils/demoMode';
import {getCurrentLocationFix, isMockedGeoPosition} from '../../../common/utils/location';
import {
  openArCoreStoreListing,
  type ARSupportState,
} from '../../../services/ar-bridge';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AuditStartScreen'>;
type RouteType = RouteProp<RootStackParamList, 'AuditStartScreen'>;
type RootAwareDeviceInfo = typeof DeviceInfo & {
  isRooted?: () => Promise<boolean>;
};

function getArSupportCopy(
  supportState: ARSupportState,
  arTier: 1 | 2 | 3,
  arTierResolved: boolean,
) {
  if (supportState === 'camera-permission-required') {
    return {
      title: 'Camera Permission Needed',
      description:
        'Allow camera access so TerraTrust can verify whether this phone supports high-precision AR or needs manual measurement.',
      icon: 'camera-lock-outline' as const,
      iconColor: COLORS.WARNING_ORANGE,
    };
  }

  if (supportState === 'arcore-install-required') {
    return {
      title: 'AR Services Need Installation',
      description:
        'This phone looks AR-compatible, but Google Play Services for AR is not installed yet. Install it once to unlock scanning.',
      icon: 'download-outline' as const,
      iconColor: COLORS.TEAL,
    };
  }

  if (supportState === 'arcore-update-required') {
    return {
      title: 'AR Services Need Update',
      description:
        'Update Google Play Services for AR so TerraTrust can use this phone’s scanning capability correctly.',
      icon: 'update' as const,
      iconColor: COLORS.TEAL,
    };
  }

  if (supportState === 'temporarily-unavailable') {
    return {
      title: 'Capability Check Paused',
      description:
        'TerraTrust will retry AR verification when the camera becomes available. You can also retry from this screen.',
      icon: 'camera-alert-outline' as const,
      iconColor: COLORS.WARNING_ORANGE,
    };
  }

  if (!arTierResolved || supportState === 'checking') {
    return {
      title: 'Checking Device Capability',
      description:
        'TerraTrust is verifying whether this phone should use depth AR, motion-based AR, or manual fallback for this audit.',
      icon: 'progress-clock' as const,
      iconColor: COLORS.WARNING_ORANGE,
    };
  }

  if (arTier === 1) {
    return {
      title: 'High Precision',
      description:
        'Your phone supports full depth AR. TerraTrust will guide a still 3-second diameter scan.',
      icon: 'crosshairs-gps' as const,
      iconColor: COLORS.FOREST_GREEN,
    };
  }

  if (arTier === 2) {
    return {
      title: 'Standard Precision',
      description:
        'Your phone supports motion-based AR. TerraTrust will guide a left-right measurement scan.',
      icon: 'tune-variant' as const,
      iconColor: COLORS.TEAL,
    };
  }

  return {
    title: 'Manual Measurement Fallback',
    description:
      'Your phone will use the documented string-measurement fallback during tree scans.',
    icon: 'ruler' as const,
    iconColor: COLORS.DARK_SLATE,
  };
}

const AuditStartScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {landId, landName, originTab = 'HomeTab'} = route.params;
  const dispatch = useAppDispatch();

  const parcels = useAppSelector(state => state.land.parcels);
  const audit = useAppSelector(state => state.audit);
  const arTier = useAppSelector(state => state.audit.arTier);
  const arTierResolved = useAppSelector(state => state.audit.arTierResolved);
  const arSupportState = useAppSelector(state => state.audit.arSupportState);
  const parcel = parcels.find(p => p.id === landId);
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();

  const [loading, setLoading] = useState(false);
  const [showRootWarning, setShowRootWarning] = useState(false);
  const [mockBlocked, setMockBlocked] = useState(false);
  const arSupportCopy = getArSupportCopy(
    arSupportState,
    arTier as 1 | 2 | 3,
    arTierResolved,
  );

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const handleOpenArCoreStore = useCallback(() => {
    void openArCoreStoreListing();
  }, []);

  const handleResolveCapability = useCallback(async () => {
    if (arSupportState === 'camera-permission-required') {
      const permission = await ensureCameraPermission();

      if (!permission.granted) {
        if (permission.blocked) {
          Alert.alert(
            'Camera Permission Blocked',
            'Enable camera access in Settings so TerraTrust can verify AR precision and scan trees during the audit.',
            [
              {text: 'Cancel', style: 'cancel'},
              {text: 'Open Settings', onPress: handleOpenSettings},
            ],
          );
        }

        return;
      }

      await dispatch(detectAndSetARTier());
      return;
    }

    if (
      arSupportState === 'arcore-install-required' ||
      arSupportState === 'arcore-update-required'
    ) {
      handleOpenArCoreStore();
      return;
    }

    await dispatch(detectAndSetARTier());
  }, [
    arSupportState,
    dispatch,
    handleOpenArCoreStore,
    handleOpenSettings,
  ]);

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

  React.useEffect(() => {
    if (!arTierResolved) {
      dispatch(detectAndSetARTier());
    }
  }, [arTierResolved, dispatch]);

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
        const locationPermission = await ensureLocationPermission();
        if (!locationPermission.granted) {
          if (locationPermission.blocked) {
            Alert.alert(
              'Location Permission Blocked',
              'TerraTrust cannot start an audit until location access is enabled in Settings.',
              [
                {text: 'Cancel', style: 'cancel'},
                {text: 'Open Settings', onPress: handleOpenSettings},
              ],
            );
          } else {
            Alert.alert(
              'Location Permission Required',
              'TerraTrust needs location access to navigate to your audit zones.',
            );
          }

          setLoading(false);
          return;
        }

        try {
          const liveFix = await getCurrentLocationFix({
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
            distanceFilter: 0,
            forceRequestLocation: true,
          });

          if (isMockedGeoPosition(liveFix)) {
            setMockBlocked(true);
            setLoading(false);
            return;
          }
        } catch {
          // Do not hard-block audit start if a live fix is temporarily unavailable.
        }
      }

      const cameraPermission = await ensureCameraPermission();
      if (!cameraPermission.granted) {
        if (cameraPermission.blocked) {
          Alert.alert(
            'Camera Permission Blocked',
            'TerraTrust cannot verify AR precision or scan trees until camera access is enabled in Settings.',
            [
              {text: 'Cancel', style: 'cancel'},
              {text: 'Open Settings', onPress: handleOpenSettings},
            ],
          );
        } else {
          Alert.alert(
            'Camera Permission Required',
            'TerraTrust needs camera access to verify AR precision and scan trees during the audit.',
          );
        }

        setLoading(false);
        return;
      }

      try {
        const capability = await dispatch(detectAndSetARTier()).unwrap();

        if (!capability.resolved) {
          if (capability.supportState === 'camera-permission-required') {
            Alert.alert(
              'Camera Permission Needed',
              'TerraTrust still needs camera access to verify this phone’s AR precision.',
            );
          } else if (capability.supportState === 'arcore-install-required') {
            Alert.alert(
              'Install AR Services',
              'This phone looks AR-compatible, but Google Play Services for AR must be installed before scanning can begin.',
              [
                {text: 'Cancel', style: 'cancel'},
                {text: 'Install', onPress: handleOpenArCoreStore},
              ],
            );
          } else if (capability.supportState === 'arcore-update-required') {
            Alert.alert(
              'Update AR Services',
              'Update Google Play Services for AR before starting the audit so TerraTrust can use this phone’s scanning capability correctly.',
              [
                {text: 'Cancel', style: 'cancel'},
                {text: 'Update', onPress: handleOpenArCoreStore},
              ],
            );
          } else {
            Alert.alert(
              'AR Capability Still Checking',
              'TerraTrust could not verify this phone’s AR mode right now. Please try again in a moment.',
            );
          }

          setLoading(false);
          return;
        }
      } catch {
        setLoading(false);
        return;
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
  }, [
    audit.errorMessage,
    dispatch,
    handleOpenArCoreStore,
    handleOpenSettings,
    landId,
    navigation,
    originTab,
  ]);

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
      <View
        className="flex-row items-center pb-5"
        style={{
          backgroundColor: COLORS.DARK_SLATE,
          paddingTop: topSpacing,
          paddingHorizontal: horizontalPadding,
        }}>
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
        className="flex-1"
        contentContainerStyle={{
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingBottom: bottomSpacing,
        }}>
        {/* Rooted device warning — FR-013 */}
        {showRootWarning && (
          <Card
            className="mt-4 flex-row items-center rounded-2xl px-4 py-3"
            style={{backgroundColor: '#FEF3C7'}}>
            <MaterialCommunityIcons color="#92400E" name="alert-outline" size={20} />
            <Text className="flex-1 text-sm leading-5" style={{color: '#92400E'}}>
              This device appears to be rooted. For your security, some features may not work correctly.
            </Text>
          </Card>
        )}

        {/* Land Info Card — from Stitch design */}
        <Card className="mt-5 rounded-2xl p-5">
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
        </Card>

        <Card className="mt-4 rounded-2xl p-5">
          <Text className="text-sm uppercase tracking-widest" style={{color: COLORS.DISABLED_GREY}}>
            AR Precision
          </Text>
          <View className="mt-4 flex-row items-start">
            <View
              className="mr-4 h-12 w-12 items-center justify-center rounded-2xl"
              style={{backgroundColor: `${arSupportCopy.iconColor}18`}}>
              <MaterialCommunityIcons
                color={arSupportCopy.iconColor}
                name={arSupportCopy.icon}
                size={24}
              />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold" style={{color: COLORS.DARK_SLATE}}>
                {arSupportCopy.title}
              </Text>
              <Text className="mt-2 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
                {arSupportCopy.description}
              </Text>
            </View>
          </View>
          {(arSupportState === 'camera-permission-required' ||
            arSupportState === 'arcore-install-required' ||
            arSupportState === 'arcore-update-required' ||
            arSupportState === 'temporarily-unavailable') && (
            <Button
              className="mt-4"
              label={
                arSupportState === 'camera-permission-required'
                  ? 'Allow Camera Access'
                  : arSupportState === 'arcore-install-required'
                    ? 'Install AR Services'
                    : arSupportState === 'arcore-update-required'
                      ? 'Update AR Services'
                      : 'Retry Capability Check'
              }
              onPress={() => {
                void handleResolveCapability();
              }}
              variant={
                arSupportState === 'temporarily-unavailable'
                  ? 'secondary'
                  : 'primary'
              }
            />
          )}
        </Card>

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
      <View
        style={{
          backgroundColor: COLORS.OFF_WHITE,
          paddingHorizontal: horizontalPadding,
          paddingTop: 12,
          paddingBottom: bottomSpacing,
        }}>
        <View style={{alignSelf: 'center', width: '100%', maxWidth: contentMaxWidth}}>
          <Button
            label={loading ? 'Preparing Your Scanning Map...' : 'Start Audit'}
            onPress={() => {
              void handleStartAudit();
            }}
            disabled={loading}
          />
        </View>
      </View>
    </View>
  );
};

export default AuditStartScreen;
