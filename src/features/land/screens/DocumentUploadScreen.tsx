import { isUsableLandRecord } from '../utils/landRecord';
import { readBoundaryResponse } from '../utils/boundaryResponse';
import { useLandOperation } from '../hooks/useLandOperation';
import ScreenHeader from '../../../common/components/ScreenHeader';
import { useTheme } from '../../../common/theme/theme';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
import Geolocation from 'react-native-geolocation-service';
import NetInfo from '@react-native-community/netinfo';
import LottieView from 'lottie-react-native';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';

import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';
import type { RootStackParamList } from '../../../types/navigation';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
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
  | 'manual_entry'
  | 'ocr_result'
  | 'error';

type ManualRecordFields = Pick<
  OCRResult,
  'survey_number' | 'owner_name' | 'village' | 'taluka' | 'district' | 'state'
>;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const NAME_MATCH_THRESHOLD = 0.8;

const normalizeName = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

function getLevenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(columns).fill(0));

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

const getGPS = (): Promise<{ lat: number; lng: number } | null> =>
  new Promise(resolve => {
    Geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, enableHighAccuracy: false },
    );
  });

function createManualRecordDefaults(ownerName: string): ManualRecordFields {
  return {
    survey_number: '',
    owner_name: ownerName.trim(),
    village: '',
    taluka: '',
    district: '',
    state: 'Maharashtra',
  };
}

const DocumentUploadScreen = () => {
  const { colors: COLORS } = useTheme();
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { run, cancel } = useLandOperation();
  const registeredOwnerName = useAppSelector(
    state => state.auth.user?.name ?? '',
  );
  const {
    horizontalPadding,
    topInset,
    bottomInset,
    bottomSpacing,
    contentMaxWidth,
  } = useResponsiveScreen();
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');

  const [screenState, setScreenState] = useState<ScreenState>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualEntryError, setManualEntryError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(
    'Reading your document...',
  );
  const [manualRecord, setManualRecord] = useState<ManualRecordFields>(() =>
    createManualRecordDefaults(registeredOwnerName),
  );

  const closeRegistrationFlow = useCallback(() => {
    cancel();
    dispatch(clearCurrentDraft());
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'HomeScreen',
          params: {
            screen: 'LandTab',
            params: { screen: 'LandListScreen' },
          },
        },
      ],
    });
  }, [cancel, dispatch, navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (screenState === 'camera') {
            setScreenState('capture');
            return true;
          }
          closeRegistrationFlow();
          return true;
        },
      );

      return () => subscription.remove();
    }, [closeRegistrationFlow, screenState]),
  );

  useEffect(() => {
    setManualRecord(currentRecord => {
      if (currentRecord.owner_name.trim()) {
        return currentRecord;
      }

      return {
        ...currentRecord,
        owner_name: registeredOwnerName.trim(),
      };
    });
  }, [registeredOwnerName]);

  const ownerNameMismatch = Boolean(
    ocrResult?.owner_name &&
      registeredOwnerName &&
      getNameSimilarity(ocrResult.owner_name, registeredOwnerName) <
        NAME_MATCH_THRESHOLD,
  );

  const handleManualFieldChange = useCallback(
    (field: keyof ManualRecordFields, value: string) => {
      setManualRecord(currentRecord => ({
        ...currentRecord,
        [field]: value,
      }));
      setManualEntryError(null);
      setErrorMessage(null);
    },
    [],
  );

  const openCamera = useCallback(
    () =>
      run(
        async operation => {
          const permission = await Camera.requestCameraPermission();
          if (!operation.isCurrent()) {
            return;
          }
          if (permission !== 'granted') {
            setErrorMessage(
              'Camera access is needed to photograph your document.',
            );
            setScreenState('error');
            return;
          }
          if (!device) {
            setErrorMessage(
              'Camera is unavailable. Choose a document from your gallery.',
            );
            setScreenState('error');
            return;
          }
          setScreenState('camera');
        },
        () => {
          setErrorMessage('Could not finish this step. Please try again.');
          setScreenState('error');
        },
      ),
    [device, run],
  );

  const takePhoto = useCallback(
    () =>
      run(
        async operation => {
          if (!cameraRef.current) {
            return;
          }

          const photo = await cameraRef.current.takePhoto({ flash: 'off' });
          if (!operation.isCurrent()) {
            return;
          }
          const uri = photo.path.startsWith('file://')
            ? photo.path
            : `file://${photo.path}`;

          try {
            const response = await fetch(uri);
            if (!operation.isCurrent()) {
              return;
            }
            const blob = await response.blob();
            if (!operation.isCurrent()) {
              return;
            }
            if (blob.size > MAX_FILE_SIZE) {
              setErrorMessage(
                'Image is too large. Please take a clearer, smaller photo.',
              );
              setScreenState('error');
              return;
            }
          } catch {
            if (!operation.isCurrent()) {
              return;
            }
            // Continue even if blob size cannot be checked.
          }

          setImageUri(uri);
          setImageMime('image/jpeg');
          setManualEntryError(null);
          setErrorMessage(null);
          setScreenState('preview');
        },
        () => {
          setErrorMessage('Could not finish this step. Please try again.');
          setScreenState('error');
        },
      ),
    [run],
  );

  const pickFromGallery = useCallback(
    () =>
      run(
        async operation => {
          try {
            const [result] = await pick({ type: [types.images] });
            if (!operation.isCurrent()) {
              return;
            }

            if (result.size && result.size > MAX_FILE_SIZE) {
              setErrorMessage(
                'Image is too large. Please choose a clearer, smaller photo.',
              );
              setScreenState('error');
              return;
            }

            setImageUri(result.uri);
            setImageMime(result.nativeType ?? 'image/jpeg');
            setManualEntryError(null);
            setErrorMessage(null);
            setScreenState('preview');
          } catch (error: unknown) {
            if (!operation.isCurrent()) {
              return;
            }
            if (
              isErrorWithCode(error) &&
              error.code === errorCodes.OPERATION_CANCELED
            ) {
              return;
            }

            setErrorMessage('Failed to pick image. Please try again.');
            setScreenState('error');
          }
        },
        () => {
          setErrorMessage('Could not finish this step. Please try again.');
          setScreenState('error');
        },
      ),
    [run],
  );

  const onConfirmAndProcess = useCallback(
    () =>
      run(
        async operation => {
          if (!imageUri) {
            return;
          }

          const netInfo = await NetInfo.fetch();
          if (!operation.isCurrent()) {
            return;
          }
          if (
            netInfo.isConnected === false ||
            netInfo.isInternetReachable === false
          ) {
            setIsOffline(true);
            return;
          }

          setErrorMessage(null);
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
            const { data } = await api.post(
              '/api/v1/land/verify-document',
              formData,
              {
                signal: operation.signal,
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60_000,
              },
            );
            if (!operation.isCurrent()) {
              return;
            }

            if (!isUsableLandRecord(data)) {
              throw new Error('LAND_RECORD_INVALID');
            }
            const result = data;
            setOcrResult(result);
            dispatch(clearCurrentDraft());
            dispatch(setCurrentDraft({ ocrResult: result }));
            setScreenState('ocr_result');
          } catch (error: unknown) {
            if (!operation.isCurrent()) {
              return;
            }
            const axiosErr = error as {
              response?: { status?: number; data?: { error?: string } };
            };

            if ((error as Error).message === 'LAND_RECORD_INVALID') {
              setErrorMessage(
                'The document did not contain complete land details. Enter the record fields manually to continue.',
              );
              setScreenState('manual_entry');
              return;
            }
            if (!axiosErr.response) {
              setIsOffline(true);
              setScreenState('preview');
              return;
            }

            if (axiosErr.response.status === 422) {
              setErrorMessage(
                'Could not extract the required fields. Please retake the document in better lighting.',
              );
            } else if (
              axiosErr.response.status &&
              axiosErr.response.status >= 500
            ) {
              setManualEntryError(null);
              setErrorMessage(
                'Automatic document reading is temporarily unavailable on TerraTrust servers. Enter the land record details manually to continue.',
              );
              setScreenState('manual_entry');
              return;
            } else {
              setErrorMessage(
                axiosErr.response.data?.error ??
                  'Something went wrong. Please try again.',
              );
            }
            setScreenState('error');
          }
        },
        () => {
          setErrorMessage('Could not finish this step. Please try again.');
          setScreenState('error');
        },
      ),
    [dispatch, imageMime, imageUri, run],
  );

  const onContinue = useCallback(
    () =>
      run(
        async operation => {
          if (!ocrResult || ownerNameMismatch) {
            return;
          }

          const netInfo = await NetInfo.fetch();
          if (!operation.isCurrent()) {
            return;
          }
          if (
            netInfo.isConnected === false ||
            netInfo.isInternetReachable === false
          ) {
            setIsOffline(true);
            return;
          }

          setErrorMessage(null);
          setIsOffline(false);
          dispatch(setCurrentDraft({ fetchStatus: 'fetching' }));
          setLoadingMessage('Fetching your official land boundary...');
          setScreenState('loading');

          const gps = await getGPS();
          if (!operation.isCurrent()) {
            return;
          }

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

            const { data } = await api.get('/api/v1/land/fetch-boundary', {
              signal: operation.signal,
              params,
            });
            if (!operation.isCurrent()) {
              return;
            }

            if ((data as { status: string }).status === 'success') {
              dispatch(setCurrentDraft(readBoundaryResponse(data)));
              setScreenState('ocr_result');
              navigation.navigate('BoundaryConfirmScreen');
              return;
            }

            if ((data as { status: string }).status === 'manual_required') {
              dispatch(setCurrentDraft({ fetchStatus: 'manual_required' }));
              setScreenState('ocr_result');
              navigation.navigate('ManualUploadGuideScreen');
            } else {
              throw new Error('BOUNDARY_RESPONSE_INVALID');
            }
          } catch (error: unknown) {
            if (!operation.isCurrent()) {
              return;
            }
            const axiosErr = error as {
              response?: unknown;
              isAxiosError?: boolean;
            };
            dispatch(setCurrentDraft({ fetchStatus: 'error' }));
            if (axiosErr.isAxiosError && !axiosErr.response) {
              setIsOffline(true);
            }
            setErrorMessage(
              'Could not fetch a valid land boundary. Please retry or upload your map manually.',
            );
            setScreenState('ocr_result');
          }
        },
        () => {
          setErrorMessage('Could not finish this step. Please try again.');
          setScreenState('error');
        },
      ),
    [dispatch, navigation, ocrResult, ownerNameMismatch, run],
  );

  const onTryAgain = useCallback(() => {
    cancel();
    dispatch(clearCurrentDraft());
    setOcrResult(null);
    setImageUri(null);
    setErrorMessage(null);
    setManualEntryError(null);
    setManualRecord(createManualRecordDefaults(registeredOwnerName));
    setIsOffline(false);
    setScreenState('capture');
  }, [cancel, dispatch, registeredOwnerName]);

  const onRetake = useCallback(() => {
    cancel();
    dispatch(clearCurrentDraft());
    setOcrResult(null);
    setImageUri(null);
    setErrorMessage(null);
    setManualEntryError(null);
    setManualRecord(createManualRecordDefaults(registeredOwnerName));
    setScreenState('capture');
  }, [cancel, dispatch, registeredOwnerName]);

  const onUseManualRecord = useCallback(() => {
    const normalizedRecord: ManualRecordFields = {
      survey_number: manualRecord.survey_number.trim(),
      owner_name: manualRecord.owner_name.trim(),
      village: manualRecord.village.trim(),
      taluka: manualRecord.taluka.trim(),
      district: manualRecord.district.trim(),
      state: manualRecord.state.trim(),
    };

    const missingField = Object.entries(normalizedRecord).find(
      ([, value]) => !value,
    );

    if (missingField) {
      setManualEntryError(
        `Enter ${missingField[0].replace(/_/g, ' ')} to continue.`,
      );
      return;
    }

    const manualResult: OCRResult = {
      ...normalizedRecord,
      extraction_confidence: 0,
    };

    setOcrResult(manualResult);
    dispatch(clearCurrentDraft());
    dispatch(setCurrentDraft({ ocrResult: manualResult }));
    setErrorMessage(null);
    setManualEntryError(null);
    setScreenState('ocr_result');
  }, [dispatch, manualRecord]);

  if (screenState === 'camera' && device) {
    return (
      <View className="flex-1 bg-black">
        <StatusBar barStyle="light-content" />
        <Camera
          ref={cameraRef}
          style={{ flex: 1 }}
          device={device}
          isActive={true}
          photo={true}
        />
        <View
          className="absolute left-0 right-0 top-0 px-5"
          style={{ paddingTop: topInset + 8 }}
        >
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] self-start items-center justify-center rounded-full bg-black/35"
            onPress={() => setScreenState('capture')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              color="#FFFFFF"
              name="arrow-left"
              size={22}
            />
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

        <View
          className="absolute left-0 right-0 items-center"
          style={{ bottom: bottomInset + 24 }}
        >
          <TouchableOpacity
            className="h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: '#FFFFFF' }}
            onPress={takePhoto}
            activeOpacity={0.7}
          >
            <View
              className="h-14 w-14 rounded-full border-4"
              style={{ borderColor: COLORS.FOREST_GREEN }}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screenState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.OFF_WHITE }}>
        <ScreenHeader
          title="Land Registration"
          onBack={closeRegistrationFlow}
          backIcon="close"
        />
        <View className="flex-1 items-center justify-center px-8">
          <LottieView
            source={require('../../../assets/lottie/spinning_leaf.json')}
            autoPlay
            loop
            style={{ width: 120, height: 120 }}
          />
          <Text
            style={{ color: COLORS.DARK_SLATE }}
            className="mt-6 text-center text-lg font-medium"
          >
            {loadingMessage}
          </Text>
          <Button
            label="Cancel"
            variant="secondary"
            style={{ marginTop: 24, width: '100%' }}
            onPress={closeRegistrationFlow}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.OFF_WHITE }}>
      <ScreenHeader
        title="Upload your land document"
        eyebrow="Land Registration"
        onBack={closeRegistrationFlow}
        backIcon="close"
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          paddingBottom: bottomSpacing,
        }}
        style={{ backgroundColor: COLORS.OFF_WHITE }}
      >
        <View
          className="w-full"
          style={{
            maxWidth: contentMaxWidth,
            paddingHorizontal: horizontalPadding,
            paddingTop: 16,
          }}
        >
          <Text style={{ color: COLORS.DISABLED_GREY }}>
            Start with a clear 7/12 extract or record of rights so TerraTrust
            can verify the parcel correctly.
          </Text>

          {isOffline ? (
            <View
              className="mt-6 rounded-2xl px-4 py-3"
              style={{ backgroundColor: COLORS.WARNING_SURFACE }}
            >
              <Text
                className="text-center text-sm font-medium"
                style={{ color: COLORS.WARNING_ORANGE }}
              >
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
                  activeOpacity={0.82}
                >
                  <Card className="px-5 py-5">
                    <View className="flex-row items-center">
                      <View
                        className="h-14 w-14 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: COLORS.SUCCESS_SURFACE }}
                      >
                        <MaterialCommunityIcons
                          color={COLORS.FOREST_GREEN}
                          name="camera-outline"
                          size={28}
                        />
                      </View>
                      <View className="ml-4 flex-1">
                        <Text
                          className="text-lg font-semibold"
                          style={{ color: COLORS.DARK_SLATE }}
                        >
                          Take a fresh photo
                        </Text>
                        <Text
                          className="mt-1 text-sm leading-6"
                          style={{ color: COLORS.DISABLED_GREY }}
                        >
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
                  activeOpacity={0.82}
                >
                  <Card className="px-5 py-5">
                    <View className="flex-row items-center">
                      <View
                        className="h-14 w-14 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: COLORS.INFO_SURFACE }}
                      >
                        <MaterialCommunityIcons
                          color={COLORS.TEAL}
                          name="image-outline"
                          size={28}
                        />
                      </View>
                      <View className="ml-4 flex-1">
                        <Text
                          className="text-lg font-semibold"
                          style={{ color: COLORS.DARK_SLATE }}
                        >
                          Choose from gallery
                        </Text>
                        <Text
                          className="mt-1 text-sm leading-6"
                          style={{ color: COLORS.DISABLED_GREY }}
                        >
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

              <Card
                className="mt-6 px-5 py-5"
                style={{ backgroundColor: COLORS.SUCCESS_SURFACE }}
              >
                <Text
                  className="text-sm font-semibold uppercase tracking-[1.2px]"
                  style={{ color: COLORS.FOREST_GREEN }}
                >
                  Helpful tips
                </Text>
                <Text
                  className="mt-3 text-sm leading-6"
                  style={{ color: COLORS.DARK_SLATE }}
                >
                  Keep the whole page inside the frame, avoid shadows, and make
                  sure the owner name and survey number are easy to read.
                </Text>
                <Text
                  className="mt-3 text-sm"
                  style={{ color: COLORS.DISABLED_GREY }}
                >
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
                    style={{ color: COLORS.DARK_SLATE }}
                  >
                    Review before continuing
                  </Text>
                  <Text
                    className="mt-2 text-sm leading-6"
                    style={{ color: COLORS.DISABLED_GREY }}
                  >
                    Make sure the document is straight, sharp, and fully
                    visible.
                  </Text>
                </View>
                <Image
                  source={{ uri: imageUri }}
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

          {screenState === 'manual_entry' ? (
            <View className="pb-6 pt-8">
              <Card
                className="px-5 py-5"
                style={{
                  backgroundColor: COLORS.WARNING_SURFACE,
                  borderColor: COLORS.WARNING_ORANGE,
                }}
              >
                <View className="flex-row items-start">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: COLORS.WARNING_SURFACE }}
                  >
                    <MaterialCommunityIcons
                      color={COLORS.WARNING_ORANGE}
                      name="file-document-edit-outline"
                      size={24}
                    />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text
                      className="text-lg font-semibold"
                      style={{ color: COLORS.DARK_SLATE }}
                    >
                      Automatic OCR is unavailable
                    </Text>
                    <Text
                      className="mt-2 text-sm leading-6"
                      style={{ color: COLORS.DARK_SLATE }}
                    >
                      {errorMessage ??
                        'TerraTrust could not read this document automatically right now. Use the same document and enter the details manually to keep going.'}
                    </Text>
                  </View>
                </View>
              </Card>

              {imageUri ? (
                <Card className="mt-4 overflow-hidden p-0">
                  <View className="px-5 pb-4 pt-5">
                    <Text
                      className="text-lg font-semibold"
                      style={{ color: COLORS.DARK_SLATE }}
                    >
                      Use this document as reference
                    </Text>
                    <Text
                      className="mt-2 text-sm leading-6"
                      style={{ color: COLORS.DISABLED_GREY }}
                    >
                      Enter the survey and owner details exactly as shown in the
                      uploaded record.
                    </Text>
                  </View>
                  <Image
                    source={{ uri: imageUri }}
                    className="h-64 w-full"
                    resizeMode="cover"
                  />
                </Card>
              ) : null}

              <Card className="mt-4 px-5 py-5">
                <Text
                  className="text-lg font-semibold"
                  style={{ color: COLORS.DARK_SLATE }}
                >
                  Enter land record details manually
                </Text>
                <Text
                  className="mt-2 text-sm leading-6"
                  style={{ color: COLORS.DISABLED_GREY }}
                >
                  TerraTrust will use these fields to fetch the parcel boundary
                  or guide you to manual map upload if needed.
                </Text>

                <View className="mt-5 gap-4">
                  {[
                    {
                      key: 'survey_number',
                      label: 'Survey Number',
                      placeholder: 'Example: 47',
                      autoCapitalize: 'characters' as const,
                    },
                    {
                      key: 'owner_name',
                      label: 'Owner Name',
                      placeholder: 'Enter the name on the document',
                      autoCapitalize: 'words' as const,
                    },
                    {
                      key: 'village',
                      label: 'Village',
                      placeholder: 'Enter village name',
                      autoCapitalize: 'words' as const,
                    },
                    {
                      key: 'taluka',
                      label: 'Taluka',
                      placeholder: 'Enter taluka name',
                      autoCapitalize: 'words' as const,
                    },
                    {
                      key: 'district',
                      label: 'District',
                      placeholder: 'Enter district name',
                      autoCapitalize: 'words' as const,
                    },
                    {
                      key: 'state',
                      label: 'State',
                      placeholder: 'Enter state name',
                      autoCapitalize: 'words' as const,
                    },
                  ].map(field => (
                    <View key={field.key}>
                      <Text
                        className="text-[11px] font-semibold uppercase tracking-[1.4px]"
                        style={{ color: COLORS.DISABLED_GREY }}
                      >
                        {field.label}
                      </Text>
                      <TextInput
                        value={
                          manualRecord[field.key as keyof ManualRecordFields]
                        }
                        onChangeText={value =>
                          handleManualFieldChange(
                            field.key as keyof ManualRecordFields,
                            value,
                          )
                        }
                        placeholder={field.placeholder}
                        placeholderTextColor={COLORS.DISABLED_GREY}
                        autoCapitalize={field.autoCapitalize}
                        className="mt-2 rounded-2xl border px-4 py-3 text-base"
                        style={{
                          minHeight: 56,
                          borderColor: COLORS.BORDER,
                          backgroundColor: COLORS.OFF_WHITE,
                          color: COLORS.DARK_SLATE,
                        }}
                      />
                    </View>
                  ))}
                </View>
              </Card>

              {manualEntryError ? (
                <Card
                  className="mt-4 px-4 py-3"
                  style={{
                    backgroundColor: COLORS.ERROR_SURFACE,
                    borderColor: COLORS.ERROR_RED,
                  }}
                >
                  <Text className="text-sm" style={{ color: COLORS.ERROR_RED }}>
                    {manualEntryError}
                  </Text>
                </Card>
              ) : null}

              <View className="mt-5 gap-3">
                <Button
                  label="Continue with these details"
                  onPress={onUseManualRecord}
                />
                <Button
                  label="Retake or choose another document"
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
                  style={{ color: COLORS.DARK_SLATE }}
                >
                  Document details
                </Text>
                <Text
                  className="mt-2 text-sm leading-6"
                  style={{ color: COLORS.DISABLED_GREY }}
                >
                  Confirm that the extracted fields match your land record
                  before TerraTrust fetches the boundary.
                </Text>

                <View className="mt-5 gap-3">
                  {[
                    { label: 'Survey Number', value: ocrResult.survey_number },
                    { label: 'Owner Name', value: ocrResult.owner_name },
                    { label: 'Village', value: ocrResult.village },
                    { label: 'Taluka', value: ocrResult.taluka },
                    { label: 'District', value: ocrResult.district },
                  ].map(field => (
                    <View
                      key={field.label}
                      className="rounded-2xl px-4 py-3"
                      style={{ backgroundColor: COLORS.OFF_WHITE }}
                    >
                      <Text
                        className="text-[11px] font-semibold uppercase tracking-[1.4px]"
                        style={{ color: COLORS.DISABLED_GREY }}
                      >
                        {field.label}
                      </Text>
                      <Text
                        className="mt-1 text-base font-medium"
                        style={{ color: COLORS.DARK_SLATE }}
                      >
                        {field.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>

              {ownerNameMismatch ? (
                <Card
                  className="mt-4 px-5 py-5"
                  style={{
                    backgroundColor: COLORS.ERROR_SURFACE,
                    borderColor: COLORS.ERROR_RED,
                  }}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{ color: COLORS.ERROR_RED }}
                  >
                    Owner name mismatch detected
                  </Text>
                  <Text
                    className="mt-2 text-sm leading-6"
                    style={{ color: COLORS.DARK_SLATE }}
                  >
                    This document lists {ocrResult.owner_name}, but your
                    verified TerraTrust profile is {registeredOwnerName}. Use
                    the land document where you are listed as the owner before
                    continuing.
                  </Text>
                </Card>
              ) : null}

              {errorMessage && !ownerNameMismatch ? (
                <Card
                  className="mt-4 px-5 py-4"
                  style={{ backgroundColor: COLORS.ERROR_SURFACE }}
                >
                  <Text
                    accessibilityRole="alert"
                    style={{ color: COLORS.ERROR_RED }}
                  >
                    {errorMessage}
                  </Text>
                  <Button
                    label="Upload map manually"
                    variant="secondary"
                    onPress={() => {
                      cancel();
                      dispatch(
                        setCurrentDraft({ fetchStatus: 'manual_required' }),
                      );
                      navigation.navigate('ManualUploadGuideScreen');
                    }}
                  />
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
                style={{
                  backgroundColor: COLORS.ERROR_SURFACE,
                  borderColor: COLORS.ERROR_RED,
                }}
              >
                <View className="flex-row items-center">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: COLORS.ERROR_SURFACE }}
                  >
                    <MaterialCommunityIcons
                      color={COLORS.ERROR_RED}
                      name="alert-circle-outline"
                      size={24}
                    />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text
                      className="text-lg font-semibold"
                      style={{ color: COLORS.ERROR_RED }}
                    >
                      Extraction failed
                    </Text>
                    <Text
                      className="mt-1 text-sm leading-6"
                      style={{ color: COLORS.DARK_SLATE }}
                    >
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
                  activeOpacity={0.7}
                >
                  <Text
                    className="font-semibold"
                    style={{ color: COLORS.TEAL }}
                  >
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
    </View>
  );
};

export default DocumentUploadScreen;
