import React, {useCallback, useMemo, useState} from 'react';
import {View, Text, Image, TouchableOpacity, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MapView, {Polygon} from 'react-native-maps';
import NetInfo from '@react-native-community/netinfo';
import LottieView from 'lottie-react-native';

import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  addParcel,
  clearCurrentDraft,
  type LandParcel,
} from '../store/landSlice';
import api from '../../../services/api';
import {hectaresToAcres, sqmToHectares} from '../../../common/utils/units';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BoundaryConfirmScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const currentDraft = useAppSelector(s => s.land.currentDraft);

  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const boundary = currentDraft.boundary;
  const ocrResult = currentDraft.ocr_result;

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

    const farmName = `Survey ${ocrResult.survey_number}`;

    try {
      const payload = {
        farm_name: farmName,
        survey_number: ocrResult.survey_number,
        district: ocrResult.district,
        taluka: ocrResult.taluka,
        village: ocrResult.village,
        state: ocrResult.state,
        boundary_source: currentDraft.boundary_source,
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

      const {data} = await api.post('/land/register', payload);
      const registerData = data as {land_id: string; area_hectares: number; status: 'verified'};

      const newParcel: LandParcel = {
        id: registerData.land_id,
        farm_name: farmName,
        survey_number: ocrResult.survey_number,
        district: ocrResult.district,
        taluka: ocrResult.taluka,
        village: ocrResult.village,
        state: ocrResult.state,
        area_hectares: registerData.area_hectares,
        boundary_geojson: boundary,
        boundary_source: currentDraft.boundary_source!,
        is_verified: true,
        status: 'verified',
        last_audit_year: null,
        thumbnail_url: currentDraft.satellite_thumbnail_url,
        created_at: new Date().toISOString(),
      };

      dispatch(addParcel(newParcel));
      dispatch(clearCurrentDraft());
      navigation.navigate('LandListScreen');
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
  }, [ocrResult, boundary, currentDraft, dispatch, navigation]);

  // Try Again → back to document upload
  const onTryAgain = useCallback(() => {
    dispatch(clearCurrentDraft());
    navigation.navigate('DocumentUploadScreen');
  }, [dispatch, navigation]);

  // Area display
  const areaAcres = useMemo(() => {
    if (currentDraft.area_sqm != null && currentDraft.area_sqm > 0) {
      return hectaresToAcres(sqmToHectares(currentDraft.area_sqm)).toFixed(2);
    }
    return '—';
  }, [currentDraft.area_sqm]);

  return (
    <View className="flex-1 bg-[#0A3D2E]">
      {/* Satellite image background */}
      {!imageLoadFailed && currentDraft.satellite_thumbnail_url && (
        <Image
          source={{uri: currentDraft.satellite_thumbnail_url}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImageLoadFailed(true)}
        />
      )}

      {/* Fallback green background when image fails */}
      {(imageLoadFailed || !currentDraft.satellite_thumbnail_url) && (
        <View className="absolute inset-0 bg-green-100" />
      )}

      {/* MapView with polygon overlay */}
      <MapView
        style={StyleSheet.absoluteFill}
        mapType="none"
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        liteMode={false}
      >
        {polygonCoords.length > 0 && (
          <Polygon
            coordinates={polygonCoords}
            fillColor="rgba(34,197,94,0.3)"
            strokeColor="rgba(34,197,94,0.9)"
            strokeWidth={2}
          />
        )}
      </MapView>

      {/* Back button */}
      <TouchableOpacity
        className="absolute top-12 left-4 min-w-[48px] min-h-[48px] justify-center items-center bg-black/30 rounded-full w-12 h-12"
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}>
        <Text className="text-white text-lg font-bold">←</Text>
      </TouchableOpacity>

      {/* Offline banner */}
      {isOffline && (
        <View className="absolute top-0 left-0 right-0 bg-amber-600 px-4 py-2">
          <Text className="text-white text-sm text-center font-medium">
            You are offline. Please check your connection.
          </Text>
        </View>
      )}

      {/* Bottom sheet */}
      <View className="absolute bottom-0 left-0 right-0 bg-[#114D3A] rounded-t-2xl px-6 pt-6 pb-8">
        {/* Survey Number */}
        <View className="mb-4">
          <Text className="text-white/50 text-xs uppercase tracking-widest">
            Survey Number
          </Text>
          <Text className="text-white text-xl font-bold mt-0.5">
            {ocrResult?.survey_number ?? '—'}
          </Text>
        </View>

        {/* Area */}
        <View className="mb-4">
          <Text className="text-white/50 text-xs uppercase tracking-widest">
            Area
          </Text>
          <Text
            className="text-emerald-300 text-xl mt-0.5"
            style={{fontFamily: 'RobotoMono-Regular'}}>
            {areaAcres} acres
          </Text>
        </View>

        {/* Owner */}
        <View className="mb-6">
          <Text className="text-white/50 text-xs uppercase tracking-widest">
            Owner
          </Text>
          <Text className="text-white text-base font-medium mt-0.5">
            {ocrResult?.owner_name ?? '—'}
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
          className="bg-[#EC5B13] rounded-xl h-12 items-center justify-center flex-row min-h-[48px]"
          onPress={onConfirm}
          disabled={isLoading}
          activeOpacity={0.7}>
          <Text className="text-white font-semibold text-base">
            Yes, this is my land — Confirm
          </Text>
          <Text className="text-white ml-2">✓</Text>
        </TouchableOpacity>

        {/* Try Again */}
        <TouchableOpacity
          className="mt-3 h-12 items-center justify-center min-h-[48px]"
          onPress={onTryAgain}
          activeOpacity={0.7}>
          <Text className="text-red-400 text-sm font-medium">
            This boundary is wrong — Report and Try Again
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
            Registering your land…
          </Text>
        </View>
      )}
    </View>
  );
};

export default BoundaryConfirmScreen;
