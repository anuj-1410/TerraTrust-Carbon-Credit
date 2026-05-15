import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  BackHandler,
  Image,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Camera, useCameraDevice} from 'react-native-vision-camera';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
import Geolocation from 'react-native-geolocation-service';
import NetInfo from '@react-native-community/netinfo';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  clearCurrentDraft,
  setCurrentDraft,
  type OCRResult,
} from '../store/landSlice';
import api from '../../../services/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ScreenState =
  | 'capture'
  | 'camera'
  | 'preview'
  | 'loading'
  | 'ocr_result'
  | 'error';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const NAME_MATCH_THRESHOLD = 0.8;

const normalizeName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

function getLevenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({length: rows}, () => Array(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function getNameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeName(left).replace(/[^a-z ]/g, '');
  const normalizedRight = normalizeName(right).replace(/[^a-z ]/g, '');

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  const longestLength = Math.max(normalizedLeft.length, normalizedRight.length);
  if (longestLength === 0) {
    return 1;
  }

  const distance = getLevenshteinDistance(normalizedLeft, normalizedRight);
  return 1 - distance / longestLength;
}

const getGPS = (): Promise<{lat: number; lng: number} | null> =>
  new Promise(resolve => {
    Geolocation.getCurrentPosition(
      pos => resolve({lat: pos.coords.latitude, lng: pos.coords.longitude}),
      () => resolve(null),
      {timeout: 5000, enableHighAccuracy: false},
    );
  });

const DocumentUploadScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const registeredOwnerName = useAppSelector(
    state => state.auth.user?.name ?? '',
  );
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');

  const [screenState, setScreenState] = useState<ScreenState>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(
    'Reading your document...',
  );

  const closeRegistrationFlow = useCallback(() => {
    dispatch(clearCurrentDraft());
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'HomeScreen',
          params: {
            screen: 'LandTab',
            params: {screen: 'LandListScreen'},
          },
        },
      ],
    });
  }, [dispatch, navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        closeRegistrationFlow();
        return true;
      },
    );

    return () => subscription.remove();
  }, [closeRegistrationFlow]);

  const ownerNameMismatch = Boolean(
    ocrResult?.owner_name &&
      registeredOwnerName &&
      getNameSimilarity(ocrResult.owner_name, registeredOwnerName) <
        NAME_MATCH_THRESHOLD,
  );

  const openCamera = useCallback(async () => {
    const permission = await Camera.requestCameraPermission();
    if (permission !== 'granted') {
      setErrorMessage('Camera access is needed to photograph your document.');
      setScreenState('error');
      return;
    }
    setScreenState('camera');
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }

    const photo = await cameraRef.current.takePhoto({flash: 'off'});
    const uri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      if (blob.size > MAX_FILE_SIZE) {
        setErrorMessage(
          'Image is too large. Please take a clearer, smaller photo.',
        );
        setScreenState('error');
        return;
      }
    } catch {
      // Continue even if blob size cannot be checked.
    }

    setImageUri(uri);
    setImageMime('image/jpeg');
    setScreenState('preview');
  }, []);

  const pickFromGallery = useCallback(async () => {
    try {
      const [result] = await pick({type: [types.images]});

      if (result.size && result.size > MAX_FILE_SIZE) {
        setErrorMessage(
          'Image is too large. Please choose a clearer, smaller photo.',
        );
        setScreenState('error');
        return;
      }

      setImageUri(result.uri);
      setImageMime(result.nativeType ?? 'image/jpeg');
      setScreenState('preview');
    } catch (error: unknown) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        return;
      }

      setErrorMessage('Failed to pick image. Please try again.');
      setScreenState('error');
    }
  }, []);

  const onConfirmAndProcess = useCallback(async () => {
    if (!imageUri) {
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      setIsOffline(true);
      return;
    }

    setLoadingMessage('Reading your document...');
    setScreenState('loading');
    setIsOffline(false);

    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: imageMime,
      name: 'document.jpg',
    } as unknown as Blob);

    try {
      const {data} = await api.post('/api/v1/land/verify-document', formData, {
        headers: {'Content-Type': 'multipart/form-data'},
        timeout: 60_000,
      });

      const result = data as OCRResult;
      setOcrResult(result);
      dispatch(setCurrentDraft({ocrResult: result}));
      setScreenState('ocr_result');
    } catch (error: unknown) {
      const axiosErr = error as {
        response?: {status?: number; data?: {error?: string}};
      };

      if (!axiosErr.response) {
        setIsOffline(true);
        setScreenState('preview');
        return;
      }

      if (axiosErr.response.status === 422) {
        setErrorMessage(
          'Could not extract the required fields. Please retake the document in better lighting.',
        );
      } else {
        setErrorMessage(
          axiosErr.response.data?.error ??
            'Something went wrong. Please try again.',
        );
      }
      setScreenState('error');
    }
  }, [dispatch, imageMime, imageUri]);

  const onContinue = useCallback(async () => {
    if (!ocrResult || ownerNameMismatch) {
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      setIsOffline(true);
      return;
    }

    dispatch(setCurrentDraft({fetchStatus: 'fetching'}));
    setLoadingMessage('Fetching your official land boundary...');
    setScreenState('loading');

    const gps = await getGPS();

    try {
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
          geojson: {geometry: object; properties: object};
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
        navigation.navigate('BoundaryConfirmScreen');
        return;
      }

      if ((data as {status: string}).status === 'manual_required') {
        dispatch(setCurrentDraft({fetchStatus: 'manual_required'}));
        navigation.navigate('ManualUploadGuideScreen');
      }
    } catch (error: unknown) {
      const axiosErr = error as {response?: unknown};
      dispatch(setCurrentDraft({fetchStatus: 'error'}));
      if (!axiosErr.response) {
        setIsOffline(true);
      }
      setScreenState('ocr_result');
    }
  }, [dispatch, navigation, ocrResult, ownerNameMismatch]);

  const onTryAgain = useCallback(() => {
    dispatch(clearCurrentDraft());
    setOcrResult(null);
    setImageUri(null);
    setErrorMessage(null);
    setIsOffline(false);
    setScreenState('capture');
  }, [dispatch]);

  const onRetake = useCallback(() => {
    setImageUri(null);
    setErrorMessage(null);
    setScreenState('capture');
  }, []);

  if (screenState === 'camera' && device) {
    return (
      <View className="flex-1 bg-black">
        <Camera
          ref={cameraRef}
          style={{flex: 1}}
          device={device}
          isActive={true}
          photo={true}
        />
        <View className="absolute left-0 right-0 top-0 px-5 pt-12">
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] self-start items-center justify-center rounded-full bg-black/35"
            onPress={() => setScreenState('capture')}
            activeOpacity={0.7}>
            <MaterialCommunityIcons color="#FFFFFF" name="arrow-left" size={22} />
          </TouchableOpacity>
          <View className="mt-6 rounded-3xl bg-black/35 px-5 py-4">
            <Text className="text-lg font-semibold text-white">
              Capture the full document
            </Text>
            <Text className="mt-2 text-sm leading-6 text-white/75">
              Keep the page flat, readable, and fully inside the frame.
            </Text>
          </View>
        </View>

        <View className="absolute bottom-8 left-0 right-0 items-center">
          <TouchableOpacity
            className="h-16 w-16 items-center justify-center rounded-full bg-white"
            onPress={takePhoto}
            activeOpacity={0.7}>
            <View
              className="h-14 w-14 rounded-full border-4"
              style={{borderColor: COLORS.FOREST_GREEN}}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screenState === 'loading') {
    return (
      <View
        className="flex-1 items-center justify-center px-8"
        style={{backgroundColor: COLORS.DARK_SLATE}}>
        <LottieView
          source={require('../../../assets/lottie/spinning_leaf.json')}
          autoPlay
          loop
          style={{width: 120, height: 120}}
        />
        <Text className="mt-6 text-center text-lg font-medium text-white">
          {loadingMessage}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        paddingBottom: bottomSpacing,
      }}
      style={{backgroundColor: COLORS.OFF_WHITE}}>
      <View
        className="w-full"
        style={{
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: topSpacing,
        }}>
        <View className="flex-row items-start justify-between">
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full"
            style={{backgroundColor: COLORS.CARD_WHITE}}
            onPress={closeRegistrationFlow}
            activeOpacity={0.7}>
            <MaterialCommunityIcons color={COLORS.DARK_SLATE} name="close" size={22} />
          </TouchableOpacity>

          <View className="flex-1 px-4">
            <Text
              className="text-center text-[13px] font-semibold uppercase tracking-[1.8px]"
              style={{color: COLORS.FOREST_GREEN}}>
              Land Registration
            </Text>
            <Text
              className="mt-2 text-center text-[30px] font-bold leading-9"
              style={{color: COLORS.DARK_SLATE}}>
              Upload your land document
            </Text>
            <Text
              className="mt-3 text-center text-sm leading-6"
              style={{color: COLORS.DISABLED_GREY}}>
              Start with a clear 7/12 extract or record of rights so TerraTrust
              can verify the parcel correctly.
            </Text>
            <View className="mt-5 flex-row items-center justify-center gap-2">
              <View
                className="h-2.5 w-8 rounded-full"
                style={{backgroundColor: COLORS.FOREST_GREEN}}
              />
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{backgroundColor: '#CBD5E0'}}
              />
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{backgroundColor: '#CBD5E0'}}
              />
            </View>
          </View>

          <View className="h-12 w-12" />
        </View>

        {isOffline ? (
          <View
            className="mt-6 rounded-2xl px-4 py-3"
            style={{backgroundColor: 'rgba(221,107,32,0.12)'}}>
            <Text
              className="text-center text-sm font-medium"
              style={{color: COLORS.WARNING_ORANGE}}>
              You are offline. Reconnect to upload or verify this document.
            </Text>
          </View>
        ) : null}

        {screenState === 'capture' ? (
          <View className="pb-6 pt-8">
            <View className="gap-4">
              <TouchableOpacity
                className="rounded-[26px]"
                onPress={openCamera}
                activeOpacity={0.82}>
                <Card className="px-5 py-5">
                  <View className="flex-row items-center">
                    <View
                      className="h-14 w-14 items-center justify-center rounded-2xl"
                      style={{backgroundColor: 'rgba(47,133,90,0.12)'}}>
                      <MaterialCommunityIcons
                        color={COLORS.FOREST_GREEN}
                        name="camera-outline"
                        size={28}
                      />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text
                        className="text-lg font-semibold"
                        style={{color: COLORS.DARK_SLATE}}>
                        Take a fresh photo
                      </Text>
                      <Text
                        className="mt-1 text-sm leading-6"
                        style={{color: COLORS.DISABLED_GREY}}>
                        Use the phone camera for the clearest OCR result.
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      color={COLORS.FOREST_GREEN}
                      name="arrow-right"
                      size={22}
                    />
                  </View>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                className="rounded-[26px]"
                onPress={pickFromGallery}
                activeOpacity={0.82}>
                <Card className="px-5 py-5">
                  <View className="flex-row items-center">
                    <View
                      className="h-14 w-14 items-center justify-center rounded-2xl"
                      style={{backgroundColor: 'rgba(56,178,172,0.12)'}}>
                      <MaterialCommunityIcons
                        color={COLORS.TEAL}
                        name="image-outline"
                        size={28}
                      />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text
                        className="text-lg font-semibold"
                        style={{color: COLORS.DARK_SLATE}}>
                        Choose from gallery
                      </Text>
                      <Text
                        className="mt-1 text-sm leading-6"
                        style={{color: COLORS.DISABLED_GREY}}>
                        Upload an existing scan or photo from this device.
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      color={COLORS.TEAL}
                      name="arrow-right"
                      size={22}
                    />
                  </View>
                </Card>
              </TouchableOpacity>
            </View>

            <Card className="mt-6 px-5 py-5" style={{backgroundColor: '#F2FBF7'}}>
              <Text
                className="text-sm font-semibold uppercase tracking-[1.2px]"
                style={{color: COLORS.FOREST_GREEN}}>
                Helpful tips
              </Text>
              <Text
                className="mt-3 text-sm leading-6"
                style={{color: COLORS.DARK_SLATE}}>
                Keep the whole page inside the frame, avoid shadows, and make sure
                the owner name and survey number are easy to read.
              </Text>
              <Text className="mt-3 text-sm" style={{color: COLORS.DISABLED_GREY}}>
                Supported formats: JPG, PNG up to 10 MB
              </Text>
            </Card>
          </View>
        ) : null}

        {screenState === 'preview' && imageUri ? (
          <View className="pb-6 pt-8">
            <Card className="overflow-hidden p-0">
              <View className="px-5 pb-4 pt-5">
                <Text
                  className="text-lg font-semibold"
                  style={{color: COLORS.DARK_SLATE}}>
                  Review before continuing
                </Text>
                <Text
                  className="mt-2 text-sm leading-6"
                  style={{color: COLORS.DISABLED_GREY}}>
                  Make sure the document is straight, sharp, and fully visible.
                </Text>
              </View>
              <Image
                source={{uri: imageUri}}
                className="h-80 w-full"
                resizeMode="cover"
              />
            </Card>

            <View className="mt-5 gap-3">
              <Button
                label="Use this photo"
                onPress={() => {
                  void onConfirmAndProcess();
                }}
              />
              <Button
                label="Retake or choose again"
                onPress={onRetake}
                variant="secondary"
              />
            </View>
          </View>
        ) : null}

        {screenState === 'ocr_result' && ocrResult ? (
          <View className="pb-6 pt-8">
            <Card className="px-5 py-5">
              <Text
                className="text-lg font-semibold"
                style={{color: COLORS.DARK_SLATE}}>
                Document details
              </Text>
              <Text
                className="mt-2 text-sm leading-6"
                style={{color: COLORS.DISABLED_GREY}}>
                Confirm that the extracted fields match your land record before
                TerraTrust fetches the boundary.
              </Text>

              <View className="mt-5 gap-3">
                {[
                  {label: 'Survey Number', value: ocrResult.survey_number},
                  {label: 'Owner Name', value: ocrResult.owner_name},
                  {label: 'Village', value: ocrResult.village},
                  {label: 'Taluka', value: ocrResult.taluka},
                  {label: 'District', value: ocrResult.district},
                ].map(field => (
                  <View
                    key={field.label}
                    className="rounded-2xl px-4 py-3"
                    style={{backgroundColor: COLORS.OFF_WHITE}}>
                    <Text
                      className="text-[11px] font-semibold uppercase tracking-[1.4px]"
                      style={{color: COLORS.DISABLED_GREY}}>
                      {field.label}
                    </Text>
                    <Text
                      className="mt-1 text-base font-medium"
                      style={{color: COLORS.DARK_SLATE}}>
                      {field.value}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            {ownerNameMismatch ? (
              <Card
                className="mt-4 px-5 py-5"
                style={{backgroundColor: '#FFF5F5', borderColor: '#FED7D7'}}>
                <Text
                  className="text-base font-semibold"
                  style={{color: COLORS.ERROR_RED}}>
                  Owner name mismatch detected
                </Text>
                <Text
                  className="mt-2 text-sm leading-6"
                  style={{color: COLORS.DARK_SLATE}}>
                  This document lists {ocrResult.owner_name}, but your verified
                  TerraTrust profile is {registeredOwnerName}. Use the land
                  document where you are listed as the owner before continuing.
                </Text>
              </Card>
            ) : null}

            <View className="mt-5 gap-3">
              {!ownerNameMismatch ? (
                <Button
                  label="Continue to boundary check"
                  onPress={() => {
                    void onContinue();
                  }}
                />
              ) : null}
              <Button
                label="Try another document"
                onPress={onTryAgain}
                variant="secondary"
              />
            </View>
          </View>
        ) : null}

        {screenState === 'error' ? (
          <View className="pb-6 pt-8">
            <Card
              className="px-5 py-5"
              style={{backgroundColor: '#FFF5F5', borderColor: '#FED7D7'}}>
              <View className="flex-row items-center">
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{backgroundColor: 'rgba(229,62,62,0.12)'}}>
                  <MaterialCommunityIcons
                    color={COLORS.ERROR_RED}
                    name="alert-circle-outline"
                    size={24}
                  />
                </View>
                <View className="ml-4 flex-1">
                  <Text
                    className="text-lg font-semibold"
                    style={{color: COLORS.ERROR_RED}}>
                    Extraction failed
                  </Text>
                  <Text
                    className="mt-1 text-sm leading-6"
                    style={{color: COLORS.DARK_SLATE}}>
                    {errorMessage ??
                      'Could not extract the required fields from this document yet.'}
                  </Text>
                </View>
              </View>
            </Card>

            {errorMessage?.includes('Camera access') ? (
              <TouchableOpacity
                className="mt-4 self-start"
                onPress={() => Linking.openSettings()}
                activeOpacity={0.7}>
                <Text className="font-semibold" style={{color: COLORS.TEAL}}>
                  Open phone settings
                </Text>
              </TouchableOpacity>
            ) : null}

            <View className="mt-5 gap-3">
              <Button label="Retake document" onPress={onRetake} />
              <Button
                label="Back to upload options"
                onPress={onTryAgain}
                variant="secondary"
              />
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
};

export default DocumentUploadScreen;
