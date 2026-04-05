import React, {useCallback, useMemo} from 'react';
import {View, Text, TouchableOpacity, ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import type {AuditState} from '../store/auditSlice';
import {submitAudit} from '../store/auditSlice';
import {estimateTco2eFromTrees} from '../../../common/utils/chave';
import {COLORS} from '../../../common/constants/colors';

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

  const preliminaryEstimate = useMemo(() => {
    return estimateTco2eFromTrees(scannedTrees);
  }, [scannedTrees]);

  const handleSubmit = useCallback(async () => {
    try {
      const result = await dispatch(submitAudit()).unwrap();
      const auditId = result.audit_id ?? activeAuditId;

      if (auditId) {
        navigation.replace('AuditStatusScreen', {auditId});
      }
    } catch {
      // Error handled by Redux — uploadStatus will be 'error'
    }
  }, [activeAuditId, dispatch, navigation]);

  const isProcessing =
    uploadStatus === 'uploading' || uploadStatus === 'processing';
  const isError = uploadStatus === 'error';
  const isOffline = uploadStatus === 'offline';

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      {/* Header */}
      <View className="pt-12 pb-5 px-5" style={{backgroundColor: COLORS.DARK_SLATE}}>
        <Text className="text-white text-xl font-bold text-center">
          Audit Complete
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{paddingBottom: 32}}>
        {/* Processing state */}
        {isProcessing && (
          <View className="items-center mt-10">
            <LottieView
              source={require('../../../assets/lottie/spinning_leaf.json')}
              autoPlay
              loop
              style={{width: 160, height: 160}}
            />
            <Text className="text-base text-center mt-4 font-semibold" style={{color: COLORS.DARK_SLATE}}>
              Submitting your audit and opening status tracking...
            </Text>
            <Text className="text-sm text-center mt-2" style={{color: '#6B7280'}}>
              TerraTrust will keep checking the result until processing finishes.
            </Text>
          </View>
        )}

        {/* Error state */}
        {isError && (
          <View className="items-center mt-10">
            <View className="w-16 h-16 rounded-full bg-[#FEE2E2] items-center justify-center">
              <MaterialCommunityIcons color={COLORS.ERROR_RED} name="alert-circle-outline" size={32} />
            </View>
            <Text className="text-lg font-bold mt-4" style={{color: COLORS.ERROR_RED}}>
              Verification Failed
            </Text>
            <Text className="text-sm text-center mt-2 px-4" style={{color: '#6B7280'}}>
              {errorMessage || 'An error occurred during verification. Please try again.'}
            </Text>
          </View>
        )}

        {/* Offline state banner */}
        {isOffline && (
          <View className="mt-6 bg-[#FEF3C7] rounded-2xl px-4 py-4 flex-row items-center">
            <MaterialCommunityIcons color="#92400E" name="cloud-upload-outline" size={20} />
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
                <MaterialCommunityIcons color={COLORS.FOREST_GREEN} name="check-circle-outline" size={32} />
              </View>
              <Text className="text-xl font-bold mt-3" style={{color: COLORS.DARK_SLATE}}>
                All Zones Completed!
              </Text>
            </View>

            {/* Stats grid */}
            <View className="flex-row mt-4">
              <View className="flex-1 items-center">
                <Text className="text-sm" style={{color: '#6B7280'}}>Total Trees</Text>
                <Text
                  className="text-3xl font-bold mt-1"
                  style={{fontFamily: 'RobotoMono-Bold', color: COLORS.DARK_SLATE}}>
                  {totalTrees}
                </Text>
              </View>
              <View className="w-px bg-[#F2F4F2]" />
              <View className="flex-1 items-center">
                <Text className="text-sm" style={{color: '#6B7280'}}>
                  Zones Completed
                </Text>
                <Text
                  className="text-3xl font-bold mt-1"
                  style={{fontFamily: 'RobotoMono-Bold', color: COLORS.DARK_SLATE}}>
                  {zonesCompleted}/{zones.length}
                </Text>
              </View>
            </View>

            <View className="h-px bg-[#F2F4F2] my-4" />

            {/* Carbon estimate — Flaw #88 */}
            <View className="items-center">
              <Text className="text-sm" style={{color: '#6B7280'}}>
                Preliminary Carbon Estimate
              </Text>
              <Text
                className="text-2xl font-bold mt-1"
                style={{fontFamily: 'RobotoMono-Bold', color: COLORS.FOREST_GREEN}}>
                ~{preliminaryEstimate} tCO₂e
              </Text>
              <Text className="text-xs text-center mt-1 italic" style={{color: COLORS.DISABLED_GREY}}>
                Estimated — subject to satellite verification.
              </Text>
            </View>
          </View>
        )}

        {/* Session complete message */}
        {sessionComplete && zones.length > 3 && (
          <View className="mt-4 bg-[#D1FAE5] rounded-2xl p-4">
            <Text className="text-sm text-center" style={{color: '#065F46'}}>
              Session 1 saved. Return tomorrow for Session 2.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View className="px-5 pb-8 pt-3" style={{backgroundColor: COLORS.OFF_WHITE}}>
        {uploadStatus === 'idle' && (
          <TouchableOpacity
            onPress={handleSubmit}
            className="h-14 rounded-xl items-center justify-center"
            style={{backgroundColor: COLORS.FOREST_GREEN}}
            activeOpacity={0.7}>
            <Text className="text-white text-base font-bold">
              Submit for Satellite Verification
            </Text>
          </TouchableOpacity>
        )}
        {isError && (
          <TouchableOpacity
            onPress={handleSubmit}
            className="h-14 rounded-xl items-center justify-center"
            style={{borderWidth: 2, borderColor: COLORS.FOREST_GREEN}}
            activeOpacity={0.7}>
            <Text className="text-base font-bold" style={{color: COLORS.FOREST_GREEN}}>
              Try Again
            </Text>
          </TouchableOpacity>
        )}
        {isOffline && (
          <TouchableOpacity
            onPress={() => navigation.reset({index: 0, routes: [{name: 'HomeScreen'}]})}
            className="h-14 rounded-xl items-center justify-center"
            style={{backgroundColor: COLORS.FOREST_GREEN}}
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
