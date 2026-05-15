import React, {useCallback, useMemo, useState} from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MapView, {Polygon} from 'react-native-maps';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from 'react-native-geolocation-service';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Button from '../../../common/components/Button';
import BottomSheet from '../../../common/components/BottomSheet';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';
import {calculateAreaHectares} from '../../../common/utils/geoJson';
import {hectaresToAcres} from '../../../common/utils/units';
import api from '../../../services/api';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import type {RootStackParamList} from '../../../types/navigation';
import {
  addParcel,
  clearCurrentDraft,
  setCurrentDraft,
  type LandParcel,
} from '../store/landSlice';

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
  const currentDraft = useAppSelector(state => state.land.currentDraft);
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();

  const boundary = currentDraft.boundary;
  const ocrResult = currentDraft.ocrResult;
  const defaultFarmName = ocrResult?.survey_number?.trim() || 'My Land';
  const areaAcres = boundary
    ? hectaresToAcres(calculateAreaHectares(boundary)).toFixed(2)
    : null;
  const sourceLabel =
    currentDraft.boundarySource === 'MANUAL'
      ? 'Manual Map'
      : 'Official Government Record';

  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [showRetryOptions, setShowRetryOptions] = useState(false);
  const [loadingText, setLoadingText] = useState('Registering your land...');

  const {region, polygonCoords} = useMemo(() => {
    if (!boundary?.coordinates?.[0]) {
      return {
        region: {
          latitude: 18.5,
          longitude: 73.9,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        polygonCoords: [],
      };
    }

    const coords = boundary.coordinates[0];
    const lats = coords.map(point => point[1]);
    const lngs = coords.map(point => point[0]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const padding = 1.3;

    return {
      region: {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: (maxLat - minLat) * padding || 0.005,
        longitudeDelta: (maxLng - minLng) * padding || 0.005,
      },
      polygonCoords: coords.map(point => ({
        latitude: point[1],
        longitude: point[0],
      })),
    };
  }, [boundary]);

  const onConfirm = useCallback(async () => {
    if (!ocrResult || !boundary) {
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
      const registerData = data as {
        land_id: string;
        area_hectares: number;
        status: 'verified';
      };

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
    } catch (error: unknown) {
      const axiosErr = error as {
        response?: {status?: number; data?: {error?: string}};
      };

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
          axiosErr.response.data?.error ??
            'Registration failed. Please try again.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [boundary, currentDraft.boundarySource, currentDraft.satelliteThumbnailUrl, defaultFarmName, dispatch, navigation, ocrResult]);

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
            boundary:
              successData.geojson
                .geometry as import('../store/landSlice').GeoJSONPolygon,
            boundarySource:
              successData.boundary_source as import('../store/landSlice').BoundarySource,
            satelliteThumbnailUrl: successData.satellite_thumbnail_url,
            fetchStatus: 'success',
          }),
        );
        return;
      }

      dispatch(setCurrentDraft({fetchStatus: 'manual_required'}));
      navigation.navigate('ManualUploadGuideScreen');
    } catch (error: unknown) {
      const axiosErr = error as {response?: unknown};
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
    navigation.replace('DocumentUploadScreen');
  }, [dispatch, navigation]);

  return (
    <View style={{flex: 1, backgroundColor: COLORS.DARK_SLATE}}>
      {!imageLoadFailed && currentDraft.satelliteThumbnailUrl ? (
        <Image
          source={{uri: currentDraft.satelliteThumbnailUrl}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImageLoadFailed(true)}
        />
      ) : (
        <View className="absolute inset-0" style={{backgroundColor: '#E6F4EA'}} />
      )}

      <MapView
        style={StyleSheet.absoluteFill}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        liteMode={false}>
        {polygonCoords.length > 0 ? (
          <Polygon
            coordinates={polygonCoords}
            fillColor="rgba(47,133,90,0.24)"
            strokeColor="rgba(47,133,90,0.95)"
            strokeWidth={2}
          />
        ) : null}
      </MapView>

      <View
        className="absolute left-0 right-0 top-0 flex-row items-start justify-between"
        style={{
          paddingHorizontal: horizontalPadding,
          paddingTop: topSpacing,
        }}>
        <TouchableOpacity
          className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full"
          style={{backgroundColor: 'rgba(17, 24, 39, 0.42)'}}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <MaterialCommunityIcons color="#FFFFFF" name="arrow-left" size={22} />
        </TouchableOpacity>

        <View className="flex-1 px-4">
          <Text className="text-center text-[13px] font-semibold uppercase tracking-[1.8px] text-white/80">
            Land Registration
          </Text>
          <Text className="mt-2 text-center text-[28px] font-bold text-white">
            Confirm your boundary
          </Text>
          <Text className="mt-3 text-center text-sm leading-6 text-white/75">
            Compare the parcel outline with your actual land before saving it to
            your TerraTrust account.
          </Text>
          <View className="mt-4 flex-row items-center justify-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full bg-white/90" />
            <View className="h-2.5 w-8 rounded-full bg-white/90" />
            <View className="h-2.5 w-2.5 rounded-full bg-white/40" />
          </View>
        </View>

        <View className="h-12 w-12" />
      </View>

      {isOffline ? (
        <View
          className="absolute left-0 right-0 rounded-2xl px-4 py-3"
          style={{
            top: topSpacing + 110,
            marginHorizontal: horizontalPadding,
            backgroundColor: 'rgba(221,107,32,0.92)',
          }}>
          <Text className="text-center text-sm font-medium text-white">
            You are offline. Reconnect before registering this land.
          </Text>
        </View>
      ) : null}

      <View
        className="absolute bottom-0 left-0 right-0 self-center rounded-t-[30px] px-6 pt-5"
        style={{
          backgroundColor: COLORS.CARD_WHITE,
          paddingBottom: bottomSpacing,
          maxWidth: contentMaxWidth,
        }}>
        <View
          className="mb-4 self-center h-1.5 w-12 rounded-full"
          style={{backgroundColor: '#CBD5E0'}}
        />
        <Text className="text-2xl font-bold" style={{color: COLORS.DARK_SLATE}}>
          Is this your land?
        </Text>
        <Text className="mt-2 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
          Review the official parcel shape and confirm the extracted record
          before TerraTrust registers it to your account.
        </Text>

        <View className="mt-5 gap-3">
          {[
            {label: 'Survey Number', value: ocrResult?.survey_number ?? '—'},
            {label: 'Owner', value: ocrResult?.owner_name ?? '—'},
            {
              label: 'Area',
              value: areaAcres ? `${areaAcres} acres` : 'Calculating...',
            },
            {label: 'Source', value: sourceLabel},
          ].map(item => (
            <Card key={item.label} className="rounded-2xl px-4 py-3">
              <Text
                className="text-[11px] font-semibold uppercase tracking-[1.4px]"
                style={{color: COLORS.DISABLED_GREY}}>
                {item.label}
              </Text>
              <Text
                className="mt-1 text-base font-semibold"
                style={{color: COLORS.DARK_SLATE}}>
                {item.value}
              </Text>
            </Card>
          ))}
        </View>

        {registerError ? (
          <Card
            className="mt-4 rounded-2xl px-4 py-3"
            style={{backgroundColor: '#FFF5F5', borderColor: '#FED7D7'}}>
            <Text className="text-sm" style={{color: COLORS.ERROR_RED}}>
              {registerError}
            </Text>
          </Card>
        ) : null}

        <View className="mt-5 gap-3">
          <Button
            label={
              isLoading ? 'Registering your land...' : 'Yes, this is my land'
            }
            onPress={() => {
              void onConfirm();
            }}
            disabled={isLoading}
          />
          <Button
            label="This boundary looks wrong"
            onPress={() => setShowRetryOptions(true)}
            variant="destructive"
          />
        </View>
      </View>

      {isLoading ? (
        <View className="absolute inset-0 items-center justify-center bg-black/60">
          <LottieView
            source={require('../../../assets/lottie/spinning_leaf.json')}
            autoPlay
            loop
            style={{width: 120, height: 120}}
          />
          <Text className="mt-4 text-lg font-medium text-white">{loadingText}</Text>
        </View>
      ) : null}

      <BottomSheet
        visible={showRetryOptions}
        onClose={() => setShowRetryOptions(false)}>
        <Text className="text-lg font-bold" style={{color: COLORS.DARK_SLATE}}>
          Boundary needs correction
        </Text>
        <Text className="mt-3 leading-6" style={{color: COLORS.DISABLED_GREY}}>
          Choose the next step TerraTrust should take for this land parcel.
        </Text>

        <Button
          className="mt-6"
          label="Retry automatic boundary fetch"
          onPress={() => {
            void onRetryAutomaticFetch();
          }}
        />
        <Button
          className="mt-3"
          label="Upload boundary map manually"
          onPress={() => {
            setShowRetryOptions(false);
            navigation.navigate('ManualUploadGuideScreen');
          }}
          variant="secondary"
        />
        <Button
          className="mt-3"
          label="Retake land document"
          onPress={onRetakeDocument}
          variant="destructive"
        />
      </BottomSheet>
    </View>
  );
};

export default BoundaryConfirmScreen;
