import React, {useCallback} from 'react';
import {View, Text, TouchableOpacity, ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LottieView from 'lottie-react-native';

import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import type {AuditState} from '../store/auditSlice';
import {submitAudit, pollAuditResult} from '../store/auditSlice';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AuditCompleteScreen'>;

const AuditCompleteScreen = () => {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  const audit = useAppSelector(state => state.audit as unknown as AuditState);
  const {
    scannedTrees,
    zones,
    currentZoneIndex,
    uploadStatus,
    activeAuditId,
    sessionComplete,
    errorMessage,
  } = audit;

  const totalTrees = scannedTrees.length;
  const zonesCompleted = Math.min(currentZoneIndex + 1, zones.length);

  const handleSubmit = useCallback(async () => {
    try {
      await dispatch(submitAudit()).unwrap();
      // After successful submission, start polling
      if (activeAuditId) {
        dispatch(pollAuditResult(activeAuditId));
      }
    } catch {
      // Error handled by Redux — uploadStatus will be 'error'
    }
  }, [dispatch, activeAuditId]);

  const handleGoHome = useCallback(() => {
    navigation.navigate('HomeScreen' as any);
  }, [navigation]);

  const isProcessing =
    uploadStatus === 'uploading' || uploadStatus === 'processing';
  const isSuccess = uploadStatus === 'success';
  const isError = uploadStatus === 'error';
  const isOffline = uploadStatus === 'offline';

  return (
    <View className="flex-1 bg-[#F8FAF8]">
      {/* Header */}
      <View className="bg-[#1B4332] pt-12 pb-5 px-5">
        <Text className="text-white text-xl font-bold text-center">
          Audit Complete
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{paddingBottom: 32}}>
        {/* Success state — Credit Minted */}
        {isSuccess && (
          <View className="items-center mt-10">
            <LottieView
              source={require('../../../assets/lottie/credit_earned.json')}
              autoPlay
              loop={false}
              style={{width: 180, height: 180}}
            />
            <Text className="text-[#2D6A4F] text-2xl font-bold mt-4">
              Carbon Credits Minted!
            </Text>
            <Text className="text-[#6B7280] text-sm mt-2">
              Your credits are now in your wallet
            </Text>
          </View>
        )}

        {/* Processing state */}
        {isProcessing && (
          <View className="items-center mt-10">
            <LottieView
              source={require('../../../assets/lottie/spinning_leaf.json')}
              autoPlay
              loop
              style={{width: 160, height: 160}}
            />
            <Text className="text-[#191C1B] text-base text-center mt-4 font-semibold">
              Calculating your carbon credits using satellite data...
            </Text>
            <Text className="text-[#6B7280] text-sm text-center mt-2">
              This takes about 30-60 seconds.
            </Text>
          </View>
        )}

        {/* Error state */}
        {isError && (
          <View className="items-center mt-10">
            <View className="w-16 h-16 rounded-full bg-[#FEE2E2] items-center justify-center">
              <Text className="text-3xl">⚠️</Text>
            </View>
            <Text className="text-[#EF4444] text-lg font-bold mt-4">
              Verification Failed
            </Text>
            <Text className="text-[#6B7280] text-sm text-center mt-2 px-4">
              {errorMessage || 'An error occurred during verification. Please try again.'}
            </Text>
          </View>
        )}

        {/* Offline state banner */}
        {isOffline && (
          <View className="mt-6 bg-[#FEF3C7] rounded-2xl px-4 py-4 flex-row items-center">
            <Text className="text-lg mr-3">☁️</Text>
            <Text className="flex-1 text-[#92400E] text-sm leading-5">
              Saved for upload when you're back online.
            </Text>
          </View>
        )}

        {/* Summary card — always visible */}
        {!isProcessing && (
          <View className="mt-6 bg-white rounded-2xl p-5 shadow-sm">
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-[#D1FAE5] items-center justify-center">
                <Text className="text-3xl">✓</Text>
              </View>
              <Text className="text-[#191C1B] text-xl font-bold mt-3">
                All Zones Completed!
              </Text>
            </View>

            {/* Stats grid */}
            <View className="flex-row mt-4">
              <View className="flex-1 items-center">
                <Text className="text-[#6B7280] text-sm">Total Trees</Text>
                <Text
                  className="text-[#191C1B] text-3xl font-bold mt-1"
                  style={{fontFamily: 'RobotoMono-Bold'}}>
                  {totalTrees}
                </Text>
              </View>
              <View className="w-px bg-[#F2F4F2]" />
              <View className="flex-1 items-center">
                <Text className="text-[#6B7280] text-sm">
                  Zones Completed
                </Text>
                <Text
                  className="text-[#191C1B] text-3xl font-bold mt-1"
                  style={{fontFamily: 'RobotoMono-Bold'}}>
                  {zonesCompleted}/{zones.length}
                </Text>
              </View>
            </View>

            <View className="h-px bg-[#F2F4F2] my-4" />

            {/* Carbon estimate */}
            <View className="items-center">
              <Text className="text-[#6B7280] text-sm">
                Preliminary Carbon Estimate
              </Text>
              <Text
                className="text-[#2D6A4F] text-2xl font-bold mt-1"
                style={{fontFamily: 'RobotoMono-Bold'}}>
                — tCO₂e
              </Text>
              <Text className="text-[#9CA3AF] text-xs text-center mt-1 italic">
                Estimated — final number calculated by satellite verification.
              </Text>
            </View>
          </View>
        )}

        {/* Session complete message */}
        {sessionComplete && (
          <View className="mt-4 bg-[#D1FAE5] rounded-2xl p-4">
            <Text className="text-[#065F46] text-sm text-center">
              Session 1 saved. Return tomorrow for Session 2.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View className="px-5 pb-8 pt-3 bg-[#F8FAF8]">
        {uploadStatus === 'idle' && (
          <TouchableOpacity
            onPress={handleSubmit}
            className="h-14 rounded-xl bg-[#2D6A4F] items-center justify-center"
            activeOpacity={0.7}>
            <Text className="text-white text-base font-bold">
              Submit for Satellite Verification
            </Text>
          </TouchableOpacity>
        )}
        {isSuccess && (
          <TouchableOpacity
            onPress={handleGoHome}
            className="h-14 rounded-xl bg-[#2D6A4F] items-center justify-center"
            activeOpacity={0.7}>
            <Text className="text-white text-base font-bold">
              Return to Home
            </Text>
          </TouchableOpacity>
        )}
        {isError && (
          <TouchableOpacity
            onPress={handleSubmit}
            className="h-14 rounded-xl border-2 border-[#2D6A4F] items-center justify-center"
            activeOpacity={0.7}>
            <Text className="text-[#2D6A4F] text-base font-bold">
              Try Again
            </Text>
          </TouchableOpacity>
        )}
        {isOffline && (
          <TouchableOpacity
            onPress={handleGoHome}
            className="h-14 rounded-xl bg-[#2D6A4F] items-center justify-center"
            activeOpacity={0.7}>
            <Text className="text-white text-base font-bold">
              Return to Home
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default AuditCompleteScreen;
