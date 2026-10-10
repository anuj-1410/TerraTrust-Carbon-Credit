import { isUsableLandRecord } from '../utils/landRecord';
import { readBoundaryResponse } from '../utils/boundaryResponse';
import { useLandOperation } from '../hooks/useLandOperation';
import ScreenHeader from '../../../common/components/ScreenHeader';
import { useTheme } from '../../../common/theme/theme';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, { Polygon } from 'react-native-maps';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from 'react-native-geolocation-service';
import LottieView from 'lottie-react-native';

import Button from '../../../common/components/Button';
import BottomSheet from '../../../common/components/BottomSheet';
import Card from '../../../common/components/Card';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';
import {
  calculateAreaHectares,
  isUsableBoundary,
} from '../../../common/utils/geoJson';
import { hectaresToAcres } from '../../../common/utils/units';
import api from '../../../services/api';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import type { RootStackParamList } from '../../../types/navigation';
import {
  addParcel,
  clearCurrentDraft,
  setCurrentDraft,
  type LandParcel,
} from '../store/landSlice';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const getGPS = (): Promise<{ lat: number; lng: number } | null> =>
  new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => resolve(null),
      { timeout: 5000, enableHighAccuracy: false },
    );
  });

const BoundaryConfirmScreen = () => {
  const { colors: COLORS } = useTheme();
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { run, cancel } = useLandOperation();
  const currentDraft = useAppSelector(state => state.land.currentDraft);
  const { bottomSpacing, contentMaxWidth, height } = useResponsiveScreen();

  const boundary = isUsableBoundary(currentDraft.boundary)
    ? currentDraft.boundary
    : null;
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
  useFocusEffect(
    useCallback(() => {
      setIsLoading(false);
    }, []),
  );
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showRetryOptions, setShowRetryOptions] = useState(false);
  const [loadingText, setLoadingText] = useState('Registering your land...');

  const { region, polygonCoords } = useMemo(() => {
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

  const onConfirm = useCallback(
    () =>
      run(
        async operation => {
          if (
            !isUsableLandRecord(ocrResult) ||
            !boundary ||
            !currentDraft.boundarySource ||
            calculateAreaHectares(boundary) <= 0
          ) {
            setRegisterError(
              'A valid boundary and land record are required. Retake the document to continue.',
            );
            return;
          }

          const netInfo = await NetInfo.fetch();
          if (!operation.isCurrent()) {
            return;
          }
          if (netInfo.isConnected === false || netInfo.isInternetReachable === false) {
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

            const { data } = await api.post('/api/v1/land/register', payload, {
              signal: operation.signal,
            });
            if (!operation.isCurrent()) {
              return;
            }
            const registerData = data as {
              land_id: string;
              area_hectares: number;
              status: 'verified';
            };

            if (
              !registerData.land_id ||
              registerData.status !== 'verified' ||
              !Number.isFinite(registerData.area_hectares) ||
              registerData.area_hectares <= 0
            ) {
              throw new Error('LAND_REGISTRATION_RESPONSE_INVALID');
            }
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
            if (!operation.isCurrent()) {
              return;
            }
            const axiosErr = error as {
              response?: { status?: number; data?: { error?: string } };
            };

            if (
              (error as Error).message === 'LAND_REGISTRATION_RESPONSE_INVALID'
            ) {
              setRegisterError(
                'The server did not confirm a valid registration. Refresh My Lands before retrying.',
              );
            } else if (
              (error as Error).message === 'BOUNDARY_RESPONSE_INVALID'
            ) {
              setRegisterError(
                'The server returned an invalid boundary. Retake the document or upload a map.',
              );
            } else if (!axiosErr.response) {
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
            if (operation.isCurrent()) {
              setIsLoading(false);
            }
          }
        },
        () => {
          setRegisterError('Could not finish this step. Please try again.');
          setIsLoading(false);
        },
      ),
    [
      boundary,
      currentDraft.boundarySource,
      currentDraft.satelliteThumbnailUrl,
      defaultFarmName,
      dispatch,
      navigation,
      ocrResult,
      run,
    ],
  );

  const onRetryAutomaticFetch = useCallback(
    () =>
      run(
        async operation => {
          if (!ocrResult) {
            return;
          }

          const netInfo = await NetInfo.fetch();
          if (!operation.isCurrent()) {
            return;
          }
          if (netInfo.isConnected === false || netInfo.isInternetReachable === false) {
            setIsOffline(true);
            setShowRetryOptions(false);
            return;
          }

          setShowRetryOptions(false);
          setIsLoading(true);
          setLoadingText('Trying to find your land boundary again...');
          setRegisterError(null);

          const gps = await getGPS();
          if (!operation.isCurrent()) {
            return;
          }

          try {
            dispatch(setCurrentDraft({ fetchStatus: 'fetching' }));

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

            const { data } = await api.get('/api/v1/land/fetch-boundary', {
              signal: operation.signal,
              params,
            });
            if (!operation.isCurrent()) {
              return;
            }

            if ((data as { status: string }).status === 'success') {
              dispatch(setCurrentDraft(readBoundaryResponse(data)));
              return;
            }

            dispatch(setCurrentDraft({ fetchStatus: 'manual_required' }));
            navigation.navigate('ManualUploadGuideScreen');
          } catch (error: unknown) {
            if (!operation.isCurrent()) {
              return;
            }
            const axiosErr = error as { response?: unknown };
            dispatch(setCurrentDraft({ fetchStatus: 'error' }));

            if (!axiosErr.response) {
              setIsOffline(true);
            }

            setRegisterError(
              'We still could not verify this boundary automatically. Upload the boundary map manually or retake the document.',
            );
          } finally {
            if (operation.isCurrent()) {
              setLoadingText('Registering your land...');
              setIsLoading(false);
            }
          }
        },
        () => {
          setRegisterError('Could not finish this step. Please try again.');
          setIsLoading(false);
        },
      ),
    [dispatch, navigation, ocrResult, run],
  );

  const onRetakeDocument = useCallback(() => {
    cancel();
    dispatch(clearCurrentDraft());
    navigation.replace('DocumentUploadScreen');
  }, [cancel, dispatch, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.HERO_BACKGROUND }}>
      <ScreenHeader
        title="Confirm your boundary"
        eyebrow="Land Registration"
        onBack={() => navigation.goBack()}
      />
      <MapView
        style={{ flex: 1 }}
        mapType="satellite"
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        liteMode={false}
      >
        {polygonCoords.length > 0 ? (
          <Polygon
            coordinates={polygonCoords}
            holes={boundary?.coordinates
              .slice(1)
              .map(ring =>
                ring.map(([longitude, latitude]) => ({ longitude, latitude })),
              )}
            fillColor="rgba(47,133,90,0.24)"
            strokeColor="rgba(47,133,90,0.95)"
            strokeWidth={2}
          />
        ) : null}
      </MapView>

      {isOffline ? (
        <View
          className="rounded-2xl px-4 py-3"
          style={{
            backgroundColor: COLORS.BANNER_WARNING,
          }}
        >
          <Text className="text-center text-sm font-medium text-white">
            You are offline. Reconnect before registering this land.
          </Text>
        </View>
      ) : null}

      <View
        className="self-center w-full rounded-t-[30px] px-6 pt-5"
        style={{
          backgroundColor: COLORS.CARD_WHITE,
          maxHeight: height * 0.55,
          overflow: 'hidden',
          maxWidth: contentMaxWidth,
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomSpacing }}
        >
          <View
            className="mb-4 self-center h-1.5 w-12 rounded-full"
            style={{ backgroundColor: COLORS.DISABLED_BACKGROUND }}
          />
          <Text
            className="text-2xl font-bold"
            style={{ color: COLORS.DARK_SLATE }}
          >
            Is this your land?
          </Text>
          <Text
            className="mt-2 text-sm leading-6"
            style={{ color: COLORS.DISABLED_GREY }}
          >
            Review the parcel shape and confirm the extracted record before
            TerraTrust registers it to your account.
          </Text>

          <View className="mt-5 gap-3">
            {[
              {
                label: 'Survey Number',
                value: ocrResult?.survey_number ?? '—',
              },
              { label: 'Owner', value: ocrResult?.owner_name ?? '—' },
              {
                label: 'Area',
                value: areaAcres
                  ? `Approx. ${areaAcres} acres`
                  : 'Boundary unavailable',
              },
              { label: 'Source', value: sourceLabel },
            ].map(item => (
              <Card key={item.label} className="rounded-2xl px-4 py-3">
                <Text
                  className="text-[11px] font-semibold uppercase tracking-[1.4px]"
                  style={{ color: COLORS.DISABLED_GREY }}
                >
                  {item.label}
                </Text>
                <Text
                  className="mt-1 text-base font-semibold"
                  style={{ color: COLORS.DARK_SLATE }}
                >
                  {item.value}
                </Text>
              </Card>
            ))}
          </View>

          {registerError ? (
            <Card
              className="mt-4 rounded-2xl px-4 py-3"
              style={{
                backgroundColor: COLORS.ERROR_SURFACE,
                borderColor: COLORS.ERROR_RED,
              }}
            >
              <Text className="text-sm" style={{ color: COLORS.ERROR_RED }}>
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
              disabled={isLoading || !boundary || !isUsableLandRecord(ocrResult)}
            />
            <Button
              label="This boundary looks wrong"
              onPress={() => setShowRetryOptions(true)}
              variant="destructive"
            />
          </View>
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="absolute inset-0 items-center justify-center bg-black/60">
          <LottieView
            source={require('../../../assets/lottie/spinning_leaf.json')}
            autoPlay
            loop
            style={{ width: 120, height: 120 }}
          />
          <Text className="mt-4 text-lg font-medium text-white">
            {loadingText}
          </Text>
        </View>
      ) : null}

      <BottomSheet
        visible={showRetryOptions}
        onClose={() => setShowRetryOptions(false)}
      >
        <Text
          className="text-lg font-bold"
          style={{ color: COLORS.DARK_SLATE }}
        >
          Boundary needs correction
        </Text>
        <Text
          className="mt-3 leading-6"
          style={{ color: COLORS.DISABLED_GREY }}
        >
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
