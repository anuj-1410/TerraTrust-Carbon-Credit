import React, {useCallback, useState} from 'react';
import {View, Text, TouchableOpacity, ScrollView, Linking} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import DocumentPicker, {types} from 'react-native-document-picker';
import Geolocation from 'react-native-geolocation-service';
import NetInfo from '@react-native-community/netinfo';
import LottieView from 'lottie-react-native';

import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch} from '../../../store/hooks';
import {setCurrentDraft, type OCRResult, type BoundarySource, type GeoJSONPolygon} from '../store/landSlice';
import api from '../../../services/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const BHUNAKSHA_URL = 'https://bhunaksha.mahabhumi.gov.in';

interface Step {
  number: number;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {number: 1, title: 'Visit the Government Portal', description: ''},
  {number: 2, title: 'Locate Your Plot', description: 'Use your Survey Number and village name to find your land parcel on the map.'},
  {number: 3, title: 'Take a Screenshot', description: 'Capture a clear screenshot showing your entire land boundary on the map.'},
  {number: 4, title: 'Upload the Screenshot', description: "We'll extract the boundary from your screenshot automatically."},
];

const getGPS = (): Promise<{lat: number; lng: number} | null> =>
  new Promise(resolve => {
    Geolocation.getCurrentPosition(
      pos => resolve({lat: pos.coords.latitude, lng: pos.coords.longitude}),
      () => resolve(null),
      {timeout: 5000, enableHighAccuracy: false},
    );
  });

const ManualUploadGuideScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Reading your document…');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const openPortal = useCallback(() => {
    Linking.openURL(BHUNAKSHA_URL);
  }, []);

  const onUpload = useCallback(async () => {
    setErrorMessage(null);
    setIsOffline(false);

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      setIsOffline(true);
      return;
    }

    try {
      const result = await DocumentPicker.pickSingle({type: [types.images]});

      if (result.size && result.size > MAX_FILE_SIZE) {
        setErrorMessage('Image is too large. Please take a clearer, smaller photo.');
        return;
      }

      setIsLoading(true);
      setLoadingText('Reading your document…');

      // Step 1: OCR via verify-document
      const formData = new FormData();
      formData.append('image', {
        uri: result.uri,
        type: result.type ?? 'image/jpeg',
        name: result.name ?? 'boundary_screenshot.jpg',
      } as unknown as Blob);

      const {data: ocrData} = await api.post('/land/verify-document', formData, {
        headers: {'Content-Type': 'multipart/form-data'},
      });

      const ocrResult = (ocrData as {ocr_result: OCRResult}).ocr_result;
      dispatch(setCurrentDraft({ocr_result: ocrResult}));

      // Step 2: Fetch boundary
      setLoadingText('Fetching boundary…');

      const gps = await getGPS();
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

      dispatch(setCurrentDraft({fetch_status: 'fetching'}));
      const {data: boundaryData} = await api.get('/land/fetch-boundary', {params});

      if ((boundaryData as {status: string}).status === 'success') {
        const successData = boundaryData as {
          status: 'success';
          boundary_source: string;
          geojson: {geometry: object; properties: {area_sqm?: number}};
          satellite_thumbnail_url: string;
        };
        dispatch(
          setCurrentDraft({
            boundary: successData.geojson.geometry as GeoJSONPolygon,
            boundary_source: successData.boundary_source as BoundarySource,
            satellite_thumbnail_url: successData.satellite_thumbnail_url,
            area_sqm: successData.geojson.properties.area_sqm ?? null,
            fetch_status: 'success',
          }),
        );
        navigation.navigate('BoundaryConfirmScreen');
      } else {
        setErrorMessage('Could not extract boundary from this image. Please try a different screenshot.');
        dispatch(setCurrentDraft({fetch_status: 'error'}));
      }
    } catch (err: unknown) {
      const axiosErr = err as {response?: {status?: number}; code?: string};
      if (axiosErr.code === 'DOCUMENT_PICKER_CANCELED') {
        return;
      }
      if (!axiosErr.response) {
        setIsOffline(true);
      } else if (axiosErr.response.status === 422) {
        setErrorMessage('Could not extract required fields. Image quality too low. Please retake screenshot.');
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, navigation]);

  return (
    <View className="flex-1 bg-[#0A3D2E]">
      {/* Header */}
      <View className="px-6 pt-14 pb-4">
        <TouchableOpacity
          className="min-w-[48px] min-h-[48px] w-12 h-12 justify-center items-center self-start mb-4"
          onPress={() => navigation.navigate('DocumentUploadScreen')}
          activeOpacity={0.7}>
          <Text className="text-white text-xl font-bold">←</Text>
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold tracking-tight">
          Manual Upload Guide
        </Text>
        <Text className="text-white/50 text-sm mt-2 leading-5">
          We couldn't find your boundary automatically. Follow these steps to
          upload it manually.
        </Text>
      </View>

      {/* Offline banner */}
      {isOffline && (
        <View className="bg-amber-600 px-4 py-2">
          <Text className="text-white text-sm text-center font-medium">
            You are offline. Please check your connection.
          </Text>
        </View>
      )}

      {/* Steps */}
      <ScrollView className="flex-1 px-6" contentContainerStyle={{paddingBottom: 24}}>
        {STEPS.map((step, index) => (
          <View key={step.number} className="flex-row mb-0">
            {/* Step indicator column */}
            <View className="items-center mr-4">
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  step.number === 1
                    ? 'bg-[#EC5B13]'
                    : 'bg-white/10 border-2 border-white/20'
                }`}>
                <Text className="text-white font-bold text-base">
                  {step.number}
                </Text>
              </View>
              {index < STEPS.length - 1 && (
                <View className="w-0.5 flex-1 bg-white/10 my-1 min-h-[48px]" />
              )}
            </View>

            {/* Step content */}
            <View className="flex-1 pb-6">
              <Text className="text-white text-base font-bold mt-2">
                {step.title}
              </Text>
              {step.number === 1 ? (
                <TouchableOpacity
                  className="bg-[#114D3A] rounded-lg p-3 mt-2 flex-row items-center min-h-[48px]"
                  onPress={openPortal}
                  activeOpacity={0.7}>
                  <Text className="text-[#EC5B13] text-sm font-medium flex-1">
                    Open bhunaksha.mahabhumi.gov.in
                  </Text>
                  <Text className="text-[#EC5B13] text-base ml-2">→</Text>
                </TouchableOpacity>
              ) : (
                <Text className="text-white/50 text-sm mt-1 leading-5">
                  {step.description}
                </Text>
              )}
            </View>
          </View>
        ))}

        {/* Error message */}
        {errorMessage && (
          <View className="bg-red-900/40 rounded-lg p-3 mb-4">
            <Text className="text-red-300 text-sm">{errorMessage}</Text>
          </View>
        )}
      </ScrollView>

      {/* Upload button + footer */}
      <View className="px-6 pb-8 pt-4">
        <TouchableOpacity
          className="bg-[#EC5B13] rounded-xl h-14 items-center justify-center flex-row min-h-[48px]"
          onPress={onUpload}
          disabled={isLoading}
          activeOpacity={0.7}>
          <Text className="text-white text-lg mr-2">↑</Text>
          <Text className="text-white font-semibold text-base">
            Upload Boundary Screenshot
          </Text>
        </TouchableOpacity>
        <Text className="text-white/30 text-xs text-center mt-3">
          Supported formats: JPG, PNG • Max 10 MB
        </Text>
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
    </View>
  );
};

export default ManualUploadGuideScreen;
