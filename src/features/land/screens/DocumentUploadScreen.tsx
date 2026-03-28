import React, {useCallback, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Camera, useCameraDevice} from 'react-native-vision-camera';
import {pick, types, isErrorWithCode, errorCodes} from '@react-native-documents/picker';
import Geolocation from 'react-native-geolocation-service';
import NetInfo from '@react-native-community/netinfo';
import LottieView from 'lottie-react-native';

import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch} from '../../../store/hooks';
import {setCurrentDraft, clearCurrentDraft, type OCRResult} from '../store/landSlice';
import api from '../../../services/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ScreenState = 'capture' | 'camera' | 'preview' | 'loading' | 'ocr_result' | 'error';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');

  const [screenState, setScreenState] = useState<ScreenState>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // ---- Capture handlers ----

  const openCamera = useCallback(async () => {
    const permission = await Camera.requestCameraPermission();
    if (permission !== 'granted') {
      setErrorMessage('Camera access is needed to photograph your document');
      setScreenState('error');
      return;
    }
    setScreenState('camera');
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePhoto({
      flash: 'off',
    });
    const uri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;
    // Size check
    try {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      if (blob.size > MAX_FILE_SIZE) {
        setErrorMessage('Image is too large. Please take a clearer, smaller photo.');
        setScreenState('error');
        return;
      }
    } catch {
      // Proceed if size check fails
    }
    setImageUri(uri);
    setImageMime('image/jpeg');
    setScreenState('preview');
  }, []);

  const pickFromGallery = useCallback(async () => {
    try {
      const [result] = await pick({type: [types.images]});
      if (result.size && result.size > MAX_FILE_SIZE) {
        setErrorMessage('Image is too large. Please take a clearer, smaller photo.');
        setScreenState('error');
        return;
      }
      setImageUri(result.uri);
      setImageMime(result.nativeType ?? 'image/jpeg');
      setScreenState('preview');
    } catch (err: unknown) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      setErrorMessage('Failed to pick image. Please try again.');
      setScreenState('error');
    }
  }, []);

  // ---- Upload + OCR ----

  const onConfirmAndProcess = useCallback(async () => {
    if (!imageUri) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      setIsOffline(true);
      return;
    }

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
    } catch (err: unknown) {
      const axiosErr = err as {response?: {status?: number; data?: {error?: string}}};
      if (!axiosErr.response) {
        setIsOffline(true);
        setScreenState('preview');
        return;
      }
      if (axiosErr.response.status === 422) {
        setErrorMessage(
          'Could not extract required fields. Image quality too low. Please retake photo.',
        );
      } else {
        setErrorMessage(
          axiosErr.response.data?.error ?? 'Something went wrong. Please try again.',
        );
      }
      setScreenState('error');
    }
  }, [imageUri, imageMime, dispatch]);

  // ---- Continue → boundary fetch ----

  const onContinue = useCallback(async () => {
    if (!ocrResult) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      setIsOffline(true);
      return;
    }

    dispatch(setCurrentDraft({fetchStatus: 'fetching'}));
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
        const props = successData.geojson.properties as {area_sqm?: number};
        dispatch(
          setCurrentDraft({
            boundary: successData.geojson.geometry as import('../store/landSlice').GeoJSONPolygon,
            boundarySource: successData.boundary_source as import('../store/landSlice').BoundarySource,
            satelliteThumbnailUrl: successData.satellite_thumbnail_url,
            fetchStatus: 'success',
          }),
        );
        navigation.navigate('BoundaryConfirmScreen');
      } else if ((data as {status: string}).status === 'manual_required') {
        dispatch(setCurrentDraft({fetchStatus: 'manual_required'}));
        navigation.navigate('ManualUploadGuideScreen');
      }
    } catch (err: unknown) {
      const axiosErr = err as {response?: unknown};
      dispatch(setCurrentDraft({fetchStatus: 'error'}));
      if (!axiosErr.response) {
        setIsOffline(true);
      }
      setScreenState('ocr_result');
    }
  }, [ocrResult, dispatch, navigation]);

  // ---- Try Again ----

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

  // ---- Render states ----

  // Camera view
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
        <View className="absolute bottom-8 left-0 right-0 items-center">
          <TouchableOpacity
            className="w-16 h-16 rounded-full bg-white items-center justify-center"
            onPress={takePhoto}
            activeOpacity={0.7}>
            <View className="w-14 h-14 rounded-full border-4 border-[#2F855A]" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          className="absolute top-12 left-4 min-w-[48px] min-h-[48px] justify-center"
          onPress={() => setScreenState('capture')}
          activeOpacity={0.7}>
          <Text className="text-white text-base font-semibold">← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading
  if (screenState === 'loading') {
    return (
      <View className="flex-1 bg-[#2D3748] items-center justify-center px-8">
        <LottieView
          source={require('../../../assets/lottie/spinning_leaf.json')}
          autoPlay
          loop
          style={{width: 120, height: 120}}
        />
        <Text className="text-white text-lg mt-6 font-medium">
          Reading your document…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-[#2D3748]"
      contentContainerStyle={{flexGrow: 1}}>
      {/* Offline banner */}
      {isOffline && (
        <View className="bg-amber-600 px-4 py-2">
          <Text className="text-white text-sm text-center font-medium">
            You are offline. Please check your connection.
          </Text>
        </View>
      )}

      {/* CAPTURE STATE */}
      {screenState === 'capture' && (
        <View className="flex-1 px-6 pt-6">
          <Text className="text-white text-2xl font-bold tracking-tight">
            Upload Land Document
          </Text>
          <Text className="text-white/50 text-sm mt-2 tracking-wide">
            Take a photo of your 7/12 Extract or Record of Rights
          </Text>

          <View className="mt-10 gap-4">
            <TouchableOpacity
              className="bg-[#114D3A] rounded-xl p-6 flex-row items-center min-h-[72px]"
              onPress={openCamera}
              activeOpacity={0.7}>
              <Text className="text-3xl mr-4">📷</Text>
              <View>
                <Text className="text-white text-base font-semibold">Take Photo</Text>
                <Text className="text-white/50 text-xs mt-0.5">
                  Use your camera to capture the document
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-[#114D3A] rounded-xl p-6 flex-row items-center min-h-[72px]"
              onPress={pickFromGallery}
              activeOpacity={0.7}>
              <Text className="text-3xl mr-4">🖼️</Text>
              <View>
                <Text className="text-white text-base font-semibold">
                  Upload from Gallery
                </Text>
                <Text className="text-white/50 text-xs mt-0.5">
                  Select a saved image from your device
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center mt-8 px-2">
            <Text className="text-white/40 text-xs">ℹ️</Text>
            <Text className="text-white/40 text-xs ml-2">
              Make sure the document text is clearly visible
            </Text>
          </View>
        </View>
      )}

      {/* PREVIEW STATE */}
      {screenState === 'preview' && imageUri && (
        <View className="flex-1 px-6 pt-6">
          <Text className="text-white text-2xl font-bold tracking-tight">
            Upload Land Document
          </Text>

          <View className="mt-6 rounded-xl overflow-hidden">
            <Image
              source={{uri: imageUri}}
              className="w-full h-72"
              resizeMode="cover"
            />
            <View className="absolute top-0 left-0 right-0 bg-black/60 px-4 py-3">
              <Text className="text-white text-xs text-center">
                Make sure all text is clearly visible and the document is not tilted
              </Text>
            </View>
          </View>

          <View className="mt-6 gap-3">
            <TouchableOpacity
              className="bg-[#EC5B13] rounded-xl h-12 items-center justify-center min-h-[48px]"
              onPress={onConfirmAndProcess}
              activeOpacity={0.7}>
              <Text className="text-white font-semibold text-base">
                Confirm and Process
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded-xl h-12 items-center justify-center border border-white/20 min-h-[48px]"
              onPress={onRetake}
              activeOpacity={0.7}>
              <Text className="text-white/80 font-semibold text-base">Retake</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* OCR RESULT STATE */}
      {screenState === 'ocr_result' && ocrResult && (
        <View className="flex-1 px-6 pt-6">
          <Text className="text-white text-2xl font-bold tracking-tight">
            Document Details
          </Text>

          <View className="mt-6 bg-[#114D3A] rounded-xl p-5 gap-4">
            {[
              {label: 'Survey Number', value: ocrResult.survey_number},
              {label: 'Owner Name', value: ocrResult.owner_name},
              {label: 'Village', value: ocrResult.village},
              {label: 'Taluka', value: ocrResult.taluka},
              {label: 'District', value: ocrResult.district},
            ].map(field => (
              <View key={field.label}>
                <Text className="text-white/50 text-xs uppercase tracking-widest">
                  {field.label}
                </Text>
                <Text className="text-white text-base font-medium mt-0.5">
                  {field.value}
                </Text>
              </View>
            ))}
          </View>

          <View className="mt-6 gap-3 pb-6">
            <TouchableOpacity
              className="bg-[#EC5B13] rounded-xl h-12 items-center justify-center flex-row min-h-[48px]"
              onPress={onContinue}
              activeOpacity={0.7}>
              <Text className="text-white font-semibold text-base">
                This is correct — Continue
              </Text>
              <Text className="text-white ml-2">→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded-xl h-12 items-center justify-center border border-white/20 min-h-[48px]"
              onPress={onTryAgain}
              activeOpacity={0.7}>
              <Text className="text-white/80 font-semibold text-base">
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ERROR STATE */}
      {screenState === 'error' && (
        <View className="flex-1 px-6 pt-6">
          <Text className="text-white text-2xl font-bold tracking-tight">
            Upload Land Document
          </Text>

          <View className="mt-8 bg-red-900/40 rounded-xl p-5">
            <Text className="text-red-300 text-base font-semibold mb-2">
              Extraction Failed
            </Text>
            <Text className="text-white/80 text-sm">
              {errorMessage ??
                'Could not extract required fields. Image quality too low. Please retake photo.'}
            </Text>
          </View>

          {errorMessage?.includes('Camera access') && (
            <TouchableOpacity
              className="mt-4 min-h-[48px] justify-center"
              onPress={() => Linking.openSettings()}
              activeOpacity={0.7}>
              <Text className="text-[#EC5B13] text-sm font-semibold underline">
                Go to Settings
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="mt-6 rounded-xl h-12 items-center justify-center border border-white/20 min-h-[48px]"
            onPress={onRetake}
            activeOpacity={0.7}>
            <Text className="text-white/80 font-semibold text-base">Retake</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

export default DocumentUploadScreen;
