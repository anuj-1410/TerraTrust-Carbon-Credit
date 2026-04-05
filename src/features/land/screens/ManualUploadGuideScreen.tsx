import React, {useCallback, useState} from 'react';
import {View, Text, TouchableOpacity, ScrollView, Linking} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {pick, types, isErrorWithCode, errorCodes} from '@react-native-documents/picker';
import NetInfo from '@react-native-community/netinfo';
import LottieView from 'lottie-react-native';

import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch} from '../../../store/hooks';
import {setCurrentDraft, type BoundarySource, type GeoJSONPolygon} from '../store/landSlice';
import api from '../../../services/api';
import {COLORS} from '../../../common/constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const BHUNAKSHA_URL = 'https://bhunaksha.mahabhumi.gov.in';

interface Step {
  number: number;
  title: string;
  description: string;
}

interface ManualBoundaryResponse {
  status?: string;
  geojson?: {geometry: GeoJSONPolygon};
  boundary?: GeoJSONPolygon;
  boundary_source?: string;
  satellite_thumbnail_url?: string;
}

const STEPS: Step[] = [
  {number: 1, title: 'Open bhunaksha.mahabhumi.gov.in', description: ''},
  {number: 2, title: 'Select your District, Taluka, Village from the menus', description: ''},
  {number: 3, title: 'Find your Survey Number and tap Download', description: ''},
  {number: 4, title: 'Come back here and upload the downloaded image', description: ''},
];

const ManualUploadGuideScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing your map…');
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
      const [result] = await pick({type: [types.images]});

      if (result.size && result.size > MAX_FILE_SIZE) {
        setErrorMessage('Image is too large. Please use a smaller file.');
        return;
      }

      setIsLoading(true);
      setLoadingText('Processing your map…');

      const buildFormData = () => {
        const formData = new FormData();
        formData.append('map_image', {
          uri: result.uri,
          type: result.nativeType ?? 'image/jpeg',
          name: result.name ?? 'map.jpg',
        } as unknown as Blob);

        return formData;
      };

      let responseData: ManualBoundaryResponse;

      try {
        const response = await api.post<ManualBoundaryResponse>(
          '/api/v1/land/fetch-boundary',
          buildFormData(),
          {headers: {'Content-Type': 'multipart/form-data'}},
        );
        responseData = response.data;
      } catch (error: unknown) {
        const axiosErr = error as {response?: {status?: number}};

        if (axiosErr.response?.status !== 404 && axiosErr.response?.status !== 405) {
          throw error;
        }

        const fallbackResponse = await api.post<ManualBoundaryResponse>(
          '/api/v1/land/process-manual-map',
          buildFormData(),
          {headers: {'Content-Type': 'multipart/form-data'}},
        );
        responseData = fallbackResponse.data;
      }

      const boundary = responseData.geojson?.geometry ?? responseData.boundary;

      if (!boundary) {
        throw new Error('BOUNDARY_EXTRACTION_FAILED');
      }

      dispatch(
        setCurrentDraft({
          boundary,
          boundarySource: (responseData.boundary_source as BoundarySource) ?? 'MANUAL',
          satelliteThumbnailUrl: responseData.satellite_thumbnail_url ?? null,
          fetchStatus: 'success',
        }),
      );
      navigation.navigate('BoundaryConfirmScreen');
    } catch (err: unknown) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      const axiosErr = err as {response?: {status?: number}};
      if (!axiosErr.response) {
        setIsOffline(true);
      } else if (axiosErr.response.status === 422) {
        setErrorMessage('Could not extract boundary from this image. Please try a different file.');
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, navigation]);

  return (
    <View style={{flex: 1, backgroundColor: COLORS.DARK_SLATE}}>
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
                    ? 'bg-[#2F855A]'
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
              {step.number === 1 && (
                <TouchableOpacity
                  className="rounded-lg p-3 mt-2 flex-row items-center min-h-[48px]"
                  style={{backgroundColor: 'rgba(47,133,90,0.2)'}}
                  onPress={openPortal}
                  activeOpacity={0.7}>
                  <Text style={{color: COLORS.TEAL}} className="text-sm font-medium flex-1">
                    Open bhunaksha.mahabhumi.gov.in
                  </Text>
                  <Text style={{color: COLORS.TEAL}} className="text-base ml-2">→</Text>
                </TouchableOpacity>
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
          className="rounded-xl h-[52px] items-center justify-center flex-row min-h-[48px]"
          style={{backgroundColor: COLORS.FOREST_GREEN}}
          onPress={onUpload}
          disabled={isLoading}
          activeOpacity={0.7}>
          <Text className="text-white text-lg mr-2">↑</Text>
          <Text className="text-white font-semibold text-base">
            Upload Downloaded Image
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
