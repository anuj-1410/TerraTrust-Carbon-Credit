import React, {useCallback, useMemo, useState} from 'react';
import {View, Text, Image, TouchableOpacity, TextInput, StyleSheet} from 'react-native';
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
import {COLORS} from '../../../common/constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BoundaryConfirmScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const currentDraft = useAppSelector(s => s.land.currentDraft);

  const boundary = currentDraft.boundary;
  const ocrResult = currentDraft.ocrResult;

  const [farmName, setFarmName] = useState(ocrResult?.survey_number ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

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
    if (!farmName.trim()) {
      setRegisterError('Please give your land a name.');
      return;
    }

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
        farm_name: farmName.trim(),
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
        farm_name: farmName.trim(),
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
  }, [ocrResult, boundary, currentDraft, farmName, dispatch, navigation]);

  // Try Again → back to document upload
  const onTryAgain = useCallback(() => {
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
        mapType="none"
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
      <View
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl px-6 pt-6 pb-8"
        style={{backgroundColor: COLORS.DARK_SLATE}}>
        {/* Survey Number */}
        <View className="mb-4">
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

        {/* Farm Name Input (Flaw #68) */}
        <View className="mb-6">
          <Text className="text-white/50 text-xs uppercase tracking-widest mb-1">
            Give this land a name
          </Text>
          <TextInput
            className="bg-white/10 rounded-lg px-4 h-12 text-white text-base"
            value={farmName}
            onChangeText={setFarmName}
            placeholder="e.g. North Field"
            placeholderTextColor="rgba(255,255,255,0.3)"
            maxLength={100}
          />
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
            Yes, this is my land — Confirm
          </Text>
          <Text className="text-white ml-2">✓</Text>
        </TouchableOpacity>

        {/* Try Again */}
        <TouchableOpacity
          className="mt-3 h-12 items-center justify-center min-h-[48px]"
          onPress={onTryAgain}
          activeOpacity={0.7}>
          <Text style={{color: COLORS.ERROR_RED}} className="text-sm font-medium">
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
