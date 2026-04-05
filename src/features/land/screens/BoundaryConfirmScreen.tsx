import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MapView, {Polygon} from 'react-native-maps';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from 'react-native-geolocation-service';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  addParcel,
  clearCurrentDraft,
  setCurrentDraft,
  type LandParcel,
} from '../store/landSlice';
import api from '../../../services/api';
import {COLORS} from '../../../common/constants/colors';
import BottomSheet from '../../../common/components/BottomSheet';
import {calculateAreaHectares} from '../../../common/utils/geoJson';
import {hectaresToAcres} from '../../../common/utils/units';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const getGPS = (): Promise<{lat: number; lng: number} | null> =>
  new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => resolve(null),
      {timeout: 5000, enableHighAccuracy: false},
    );
  });

const BoundaryConfirmScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const currentDraft = useAppSelector(s => s.land.currentDraft);

  const boundary = currentDraft.boundary;
  const ocrResult = currentDraft.ocrResult;
  const defaultFarmName = ocrResult?.survey_number?.trim() || 'My Land';
  const areaAcres = boundary
    ? hectaresToAcres(calculateAreaHectares(boundary)).toFixed(2)
    : null;
  const sourceLabel = currentDraft.boundarySource === 'MANUAL'
    ? 'Manual Map'
    : 'Official Government Record';

  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [showRetryOptions, setShowRetryOptions] = useState(false);
  const [loadingText, setLoadingText] = useState('Registering your land...');

  // Compute region from GeoJSON coordinates
  const {region, polygonCoords} = useMemo(() => {
    if (!boundary?.coordinates?.[0]) {
      return {
        region: {latitude: 18.5, longitude: 73.9, latitudeDelta: 0.01, longitudeDelta: 0.01},
        polygonCoords: [],
      };
    }

    const coords = boundary.coordinates[0];
    const lats = coords.map(c => c[1]);
    const lngs = coords.map(c => c[0]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const PADDING = 1.3;
    const latDelta = (maxLat - minLat) * PADDING || 0.005;
    const lngDelta = (maxLng - minLng) * PADDING || 0.005;

    return {
      region: {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      },
      polygonCoords: coords.map(c => ({latitude: c[1], longitude: c[0]})),
    };
  }, [boundary]);

  // Confirm → register
  const onConfirm = useCallback(async () => {
    if (!ocrResult || !boundary) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      setIsOffline(true);
      return;
    }

    setIsLoading(true);
    setRegisterError(null);
    setIsOffline(false);

    try {
      const payload = {
        farm_name: defaultFarmName,
        survey_number: ocrResult.survey_number,
        district: ocrResult.district,
        taluka: ocrResult.taluka,
        village: ocrResult.village,
        state: ocrResult.state,
        boundary_source: currentDraft.boundarySource,
        geojson: {
          type: 'Feature',
          geometry: boundary,
          properties: {
            survey_number: ocrResult.survey_number,
            owner_name: ocrResult.owner_name,
          },
        },
        ocr_owner_name: ocrResult.owner_name,
      };

      const {data} = await api.post('/api/v1/land/register', payload);
      const registerData = data as {land_id: string; area_hectares: number; status: 'verified'};

      const newParcel: LandParcel = {
        id: registerData.land_id,
        farm_name: defaultFarmName,
        survey_number: ocrResult.survey_number,
        district: ocrResult.district,
        taluka: ocrResult.taluka,
        village: ocrResult.village,
        state: ocrResult.state,
        area_hectares: registerData.area_hectares,
        boundary_geojson: boundary,
        boundary_source: currentDraft.boundarySource!,
        is_verified: true,
        status: 'verified',
        last_audit_year: null,
        thumbnail_url: currentDraft.satelliteThumbnailUrl,
        created_at: new Date().toISOString(),
      };

      dispatch(addParcel(newParcel));
      dispatch(clearCurrentDraft());
      navigation.replace('LandRegistrationSuccessScreen', {
        landId: newParcel.id,
      });
    } catch (err: unknown) {
      const axiosErr = err as {response?: {status?: number; data?: {error?: string}}};
      if (!axiosErr.response) {
        setIsOffline(true);
      } else if (axiosErr.response.status === 400) {
        setRegisterError(
          'The name on this document does not match your registered name. Please use the land document where you are listed as the owner.',
        );
      } else if (axiosErr.response.status === 409) {
        setRegisterError(
          'This land parcel is already registered in your account.',
        );
      } else {
        setRegisterError(
          axiosErr.response.data?.error ?? 'Registration failed. Please try again.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [ocrResult, boundary, currentDraft, defaultFarmName, dispatch, navigation]);

  const onRetryAutomaticFetch = useCallback(async () => {
    if (!ocrResult) {
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      setIsOffline(true);
      setShowRetryOptions(false);
      return;
    }

    setShowRetryOptions(false);
    setIsLoading(true);
    setLoadingText('Trying to find your land boundary again...');
    setRegisterError(null);

    const gps = await getGPS();

    try {
      dispatch(setCurrentDraft({fetchStatus: 'fetching'}));

      const params: Record<string, string | number> = {
        survey_number: ocrResult.survey_number,
        district: ocrResult.district,
        taluka: ocrResult.taluka,
        village: ocrResult.village,
        state: ocrResult.state,
      };

      if (gps) {
        params.user_lat = gps.lat;
        params.user_lng = gps.lng;
      }

      const {data} = await api.get('/api/v1/land/fetch-boundary', {params});

      if ((data as {status: string}).status === 'success') {
        const successData = data as {
          status: 'success';
          boundary_source: string;
          geojson: {geometry: object};
          satellite_thumbnail_url: string;
        };

        dispatch(
          setCurrentDraft({
            boundary: successData.geojson
              .geometry as import('../store/landSlice').GeoJSONPolygon,
            boundarySource: successData.boundary_source as import('../store/landSlice').BoundarySource,
            satelliteThumbnailUrl: successData.satellite_thumbnail_url,
            fetchStatus: 'success',
          }),
        );
        return;
      }

      dispatch(setCurrentDraft({fetchStatus: 'manual_required'}));
      navigation.navigate('ManualUploadGuideScreen');
    } catch (err: unknown) {
      const axiosErr = err as {response?: unknown};
      dispatch(setCurrentDraft({fetchStatus: 'error'}));

      if (!axiosErr.response) {
        setIsOffline(true);
      }

      setRegisterError(
        'We still could not verify this boundary automatically. Upload the boundary map manually or retake the document.',
      );
    } finally {
      setLoadingText('Registering your land...');
      setIsLoading(false);
    }
  }, [dispatch, navigation, ocrResult]);

  const onRetakeDocument = useCallback(() => {
    dispatch(clearCurrentDraft());
    navigation.navigate('DocumentUploadScreen');
  }, [dispatch, navigation]);

  return (
    <View style={{flex: 1, backgroundColor: COLORS.DARK_SLATE}}>
      {/* Satellite image background */}
      {!imageLoadFailed && currentDraft.satelliteThumbnailUrl && (
        <Image
          source={{uri: currentDraft.satelliteThumbnailUrl}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImageLoadFailed(true)}
        />
      )}

      {/* Fallback green background when image fails */}
      {(imageLoadFailed || !currentDraft.satelliteThumbnailUrl) && (
        <View className="absolute inset-0 bg-green-100" />
      )}

      {/* MapView with polygon overlay */}
      <MapView
        style={StyleSheet.absoluteFill}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        liteMode={false}
      >
        {polygonCoords.length > 0 && (
          <Polygon
            coordinates={polygonCoords}
            fillColor="rgba(47,133,90,0.3)"
            strokeColor="rgba(47,133,90,0.9)"
            strokeWidth={2}
          />
        )}
      </MapView>

      {/* Back button */}
      <View className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-4 pb-4 pt-12">
        <TouchableOpacity
          className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-black/30"
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <MaterialCommunityIcons color="#FFFFFF" name="arrow-left" size={22} />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-lg font-bold text-white">Confirm Your Land</Text>
          <View className="mt-2 flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full bg-white" />
            <View className="h-2.5 w-2.5 rounded-full bg-white" />
            <View className="h-2.5 w-2.5 rounded-full bg-white/30" />
          </View>
        </View>
        <View className="h-12 w-12" />
      </View>

      {/* Offline banner */}
      {isOffline && (
        <View className="absolute top-0 left-0 right-0 bg-amber-600 px-4 py-2">
          <Text className="text-white text-sm text-center font-medium">
            You are offline. Please check your connection.
          </Text>
        </View>
      )}

      {/* Bottom sheet */}
      <View
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl px-6 pt-6 pb-8"
        style={{backgroundColor: COLORS.DARK_SLATE}}>
        <Text className="text-xl font-bold text-white">Is this your land?</Text>

        {/* Survey Number */}
        <View className="mb-4 mt-4">
          <Text className="text-white/50 text-xs uppercase tracking-widest">
            Survey Number
          </Text>
          <Text className="text-white text-xl font-bold mt-0.5">
            {ocrResult?.survey_number ?? '—'}
          </Text>
        </View>

        {/* Owner */}
        <View className="mb-4">
          <Text className="text-white/50 text-xs uppercase tracking-widest">
            Owner
          </Text>
          <Text className="text-white text-base font-medium mt-0.5">
            {ocrResult?.owner_name ?? '—'}
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-white/50 text-xs uppercase tracking-widest">
            Area
          </Text>
          <Text className="text-white text-base font-medium mt-0.5">
            {areaAcres ? `${areaAcres} acres` : 'Calculating...'}
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-white/50 text-xs uppercase tracking-widest">
            Source
          </Text>
          <Text className="text-white text-base font-medium mt-0.5">
            {sourceLabel}
          </Text>
        </View>

        {/* Error message */}
        {registerError && (
          <View className="bg-red-900/40 rounded-lg p-3 mb-4">
            <Text className="text-red-300 text-sm">{registerError}</Text>
          </View>
        )}

        {/* Confirm button */}
        <TouchableOpacity
          className="rounded-xl h-[52px] items-center justify-center flex-row min-h-[48px]"
          style={{backgroundColor: COLORS.FOREST_GREEN}}
          onPress={onConfirm}
          disabled={isLoading}
          activeOpacity={0.7}>
          <Text className="text-white font-semibold text-base">
            {isLoading ? 'Registering your land...' : 'Yes, this is my land'}
          </Text>
          {!isLoading ? (
            <MaterialCommunityIcons color="#FFFFFF" name="check" size={18} />
          ) : null}
        </TouchableOpacity>

        {/* Try Again */}
        <TouchableOpacity
          className="mt-3 h-12 items-center justify-center min-h-[48px]"
          onPress={() => setShowRetryOptions(true)}
          activeOpacity={0.7}>
          <Text style={{color: COLORS.ERROR_RED}} className="text-sm font-medium">
            This boundary is wrong
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading overlay */}
      {isLoading && (
        <View className="absolute inset-0 bg-black/60 items-center justify-center">
          <LottieView
            source={require('../../../assets/lottie/spinning_leaf.json')}
            autoPlay
            loop
            style={{width: 120, height: 120}}
          />
          <Text className="text-white text-lg mt-4 font-medium">
            {loadingText}
          </Text>
        </View>
      )}

      <BottomSheet visible={showRetryOptions} onClose={() => setShowRetryOptions(false)}>
        <Text className="text-lg font-bold" style={{color: COLORS.DARK_SLATE}}>
          Boundary needs correction
        </Text>
        <Text className="mt-3 leading-6" style={{color: COLORS.DISABLED_GREY}}>
          Choose the next step TerraTrust should take for this land parcel.
        </Text>

        <TouchableOpacity
          className="mt-6 min-h-[48px] justify-center rounded-xl px-4 py-3"
          style={{backgroundColor: COLORS.FOREST_GREEN}}
          onPress={() => {
            void onRetryAutomaticFetch();
          }}
          activeOpacity={0.75}>
          <Text className="text-white text-base font-semibold">
            Retry automatic boundary fetch
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-3 min-h-[48px] justify-center rounded-xl border px-4 py-3"
          style={{borderColor: COLORS.FOREST_GREEN}}
          onPress={() => {
            setShowRetryOptions(false);
            navigation.navigate('ManualUploadGuideScreen');
          }}
          activeOpacity={0.75}>
          <Text className="text-base font-semibold" style={{color: COLORS.FOREST_GREEN}}>
            Upload boundary map manually
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-3 min-h-[48px] justify-center rounded-xl px-4 py-3"
          onPress={onRetakeDocument}
          activeOpacity={0.75}>
          <Text className="text-base font-semibold" style={{color: COLORS.ERROR_RED}}>
            Retake land document
          </Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
};

export default BoundaryConfirmScreen;
