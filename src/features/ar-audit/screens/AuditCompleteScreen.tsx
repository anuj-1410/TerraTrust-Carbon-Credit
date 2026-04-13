import React, {useCallback, useEffect, useMemo} from 'react';
import {
  Alert,
  BackHandler,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {submitAudit} from '../store/auditSlice';
import {estimateTco2eFromTrees} from '../../../common/utils/chave';
import {COLORS} from '../../../common/constants/colors';
import {setPendingMint} from '../../dashboard/store/creditsSlice';
import Badge from '../../../common/components/Badge';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AuditCompleteScreen'>;

const AuditCompleteScreen = () => {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();
  const audit = useAppSelector(state => state.audit);
  const {
    scannedTrees,
    zones,
    currentZoneIndex,
    uploadStatus,
    activeAuditId,
    minTreesRequired,
    sessionComplete,
    errorMessage,
  } = audit;

  const totalTrees = scannedTrees.length;
  const zonesCompleted = Math.min(currentZoneIndex + 1, zones.length);
  const treesPerZone = Math.max(
    3,
    Math.floor(minTreesRequired / Math.max(zones.length, 1)),
  );

  const preliminaryEstimate = useMemo(() => {
    return estimateTco2eFromTrees(scannedTrees);
  }, [scannedTrees]);

  const groupedTrees = useMemo(
    () =>
      zones.map((zone, index) => ({
        zone,
        zoneLabel: String.fromCharCode(65 + index),
        trees: scannedTrees.filter(tree => tree.zone_id === zone.zone_id),
      })),
    [scannedTrees, zones],
  );

  const zonesWithShortfall = useMemo(
    () =>
      groupedTrees.filter(group => group.trees.length < treesPerZone),
    [groupedTrees, treesPerZone],
  );
  const canSubmitAudit = zonesWithShortfall.length === 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmitAudit) {
      return;
    }

    try {
      const result = await dispatch(submitAudit()).unwrap();
      const auditId = result.audit_id ?? activeAuditId;

      if (auditId) {
        dispatch(setPendingMint(true));
        navigation.replace('AuditStatusScreen', {auditId});
      }
    } catch {
      // Error handled by Redux — uploadStatus will be 'error'
    }
  }, [activeAuditId, canSubmitAudit, dispatch, navigation]);

  const handleExitReview = useCallback(() => {
    Alert.alert(
      'Exit without submitting?',
      'You cannot go back once submitted. Exit now if you want to leave review without sending this audit yet.',
      [
        {text: 'Stay', style: 'cancel'},
        {
          text: 'Exit Review',
          style: 'destructive',
          onPress: () =>
            navigation.reset({index: 0, routes: [{name: 'HomeScreen'}]}),
        },
      ],
    );
  }, [navigation]);

  const isProcessing =
    uploadStatus === 'uploading' || uploadStatus === 'processing';
  const isError = uploadStatus === 'error';
  const isOffline = uploadStatus === 'offline';

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!isProcessing) {
          handleExitReview();
        }
        return true;
      },
    );

    return () => subscription.remove();
  }, [handleExitReview, isProcessing]);

  const getTierBadgeVariant = (tier: 1 | 2 | 3) => {
    if (tier === 1) {
      return 'high-precision' as const;
    }

    if (tier === 2) {
      return 'standard-precision' as const;
    }

    return 'manual' as const;
  };

  const getTierLabel = (tier: 1 | 2 | 3) => {
    if (tier === 1) {
      return 'High Precision';
    }

    if (tier === 2) {
      return 'Standard Precision';
    }

    return 'Manual';
  };

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      {/* Header */}
      <View className="pt-12 pb-5 px-5" style={{backgroundColor: COLORS.DARK_SLATE}}>
        <Text className="text-white text-xl font-bold text-center">
          Audit Summary
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

            <View className="items-center">
              <Text className="text-sm" style={{color: '#6B7280'}}>
                Preliminary Carbon Estimate
              </Text>
              <Text
                className="text-2xl font-bold mt-1"
                style={{fontFamily: 'RobotoMono-Bold', color: COLORS.FOREST_GREEN}}>
                Estimated credits: approximately {preliminaryEstimate} CTT
              </Text>
              <Text className="text-xs text-center mt-1 italic" style={{color: COLORS.DISABLED_GREY}}>
                Final number is calculated using satellite data after submission.
              </Text>
            </View>
          </View>
        )}

        {!isProcessing && groupedTrees.length > 0 && (
          <View className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
            <Text className="text-lg font-bold" style={{color: COLORS.DARK_SLATE}}>
              Trees Collected
            </Text>
            <Text className="mt-2 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
              Review each zone before you submit. TerraTrust uploads this tree list,
              the GPS points, and each hashed evidence photo for satellite verification.
            </Text>

            {groupedTrees.map(group => (
              <View key={group.zone.zone_id} className="mt-5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-bold" style={{color: COLORS.DARK_SLATE}}>
                    Zone {group.zoneLabel}: {group.trees.length} trees
                  </Text>
                  <Text className="text-xs" style={{color: COLORS.DISABLED_GREY}}>
                    Minimum {treesPerZone}
                  </Text>
                </View>

                {group.trees.length === 0 ? (
                  <Text className="mt-2 text-sm" style={{color: COLORS.ERROR_RED}}>
                    No trees saved in this zone yet.
                  </Text>
                ) : null}

                {group.trees.map((tree, index) => (
                  <View
                    key={tree.tree_id}
                    className="mt-3 rounded-xl border px-4 py-3"
                    style={{borderColor: '#E5E7EB'}}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold" style={{color: COLORS.DARK_SLATE}}>
                        Tree {index + 1}: {tree.species}
                      </Text>
                      <Badge
                        label={getTierLabel(tree.measurement_tier)}
                        variant={getTierBadgeVariant(tree.measurement_tier)}
                      />
                    </View>
                    <Text className="mt-2 text-sm" style={{color: COLORS.DISABLED_GREY}}>
                      Diameter {tree.dbh_cm.toFixed(1)} cm
                      {tree.ar_height_m !== null
                        ? `, Height ${tree.ar_height_m.toFixed(1)} m`
                        : ''}
                    </Text>
                    <Text className="mt-1 text-xs" style={{color: COLORS.DISABLED_GREY}}>
                      GPS accuracy ±{Math.round(tree.gps_accuracy_m)} m
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {!isProcessing && !canSubmitAudit && (
          <View className="mt-4 rounded-2xl bg-[#FEE2E2] px-4 py-4 flex-row items-start">
            <MaterialCommunityIcons color={COLORS.ERROR_RED} name="alert-circle-outline" size={20} />
            <Text className="ml-3 flex-1 text-sm leading-6" style={{color: COLORS.ERROR_RED}}>
              Submit is locked until every zone has at least {treesPerZone} saved trees.
            </Text>
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
            disabled={!canSubmitAudit}
            className="h-14 rounded-xl items-center justify-center"
            style={{
              backgroundColor: canSubmitAudit
                ? COLORS.FOREST_GREEN
                : COLORS.DISABLED_GREY,
            }}
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
