import ScreenHeader from '../../../common/components/ScreenHeader';
import { useTheme } from '../../../common/theme/theme';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';

import Badge from '../../../common/components/Badge';
import Card from '../../../common/components/Card';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';
import { getLandStatusMeta } from '../../../common/utils/getLandStatus';
import { hectaresToAcres } from '../../../common/utils/units';
import { useLandOperation } from '../hooks/useLandOperation';
import { useLandParcel } from '../hooks/useLandParcel';
import { openExternalLink } from '../../../common/utils/openExternalLink';
import api from '../../../services/api';
import type { RootStackParamList } from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LandDetailScreen'>;
type RouteType = RouteProp<RootStackParamList, 'LandDetailScreen'>;

interface ParcelAuditHistory {
  audit_id?: string;
  audit_year: number;
  credits_issued: number;
  status?: string;
  ipfs_certificate_url?: string;
}

const LandDetailScreen = () => {
  const { colors: COLORS } = useTheme();
  const { bottomSpacing } = useResponsiveScreen();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const { landId, originTab = 'LandTab' } = route.params;
  const parcel = useLandParcel(landId);
  const { run, cancel } = useLandOperation();

  const [history, setHistory] = useState<ParcelAuditHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [failedPage, setFailedPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const loadHistory = useCallback(
    (page = 1) =>
      run(
        async operation => {
          try {
            setIsLoadingHistory(true);
            setHistoryError(null);
            setFailedPage(page);
            const response = await api.get(`/api/v1/audit/history/${landId}`, {
              params: { page, limit: 20 },
              signal: operation.signal,
            });
            if (!operation.isCurrent()) {
              return;
            }
            const records = Array.isArray(response.data)
              ? response.data
              : Array.isArray(response.data?.items)
              ? response.data.items
              : [];

            setHistory(previous =>
              page === 1
                ? records
                : [...previous, ...records].filter(
                    (record, index, all) =>
                      all.findIndex(
                        other =>
                          (other.audit_id ??
                            `${other.audit_year}:${other.status}`) ===
                          (record.audit_id ??
                            `${record.audit_year}:${record.status}`),
                      ) === index,
                  ),
            );
            setHistoryPage(page);
            setHasMore(
              Boolean(
                response.data?.has_more ??
                  page * 20 < Number(response.data?.total ?? records.length),
              ),
            );
          } catch {
            if (operation.isCurrent()) {
              setHistoryError('Could not load audit history. Tap to retry.');
            }
          } finally {
            if (operation.isCurrent()) {
              setIsLoadingHistory(false);
            }
          }
        },
        () => {
          setIsLoadingHistory(false);
          setHistoryError('Could not load audit history. Tap to retry.');
        },
      ),
    [landId, run],
  );
  useFocusEffect(
    useCallback(() => {
      void loadHistory(1);
      return cancel;
    }, [cancel, loadHistory]),
  );

  const statusMeta = useMemo(() => {
    if (!parcel) {
      return null;
    }

    const meta = getLandStatusMeta(parcel);
    return {
      ...meta,
      variant:
        meta.status === 'green'
          ? 'verified'
          : meta.status === 'orange'
          ? 'pending'
          : 'rejected',
    } as const;
  }, [parcel]);

  if (!parcel) {
    return (
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: COLORS.OFF_WHITE }}
      >
        <Text
          className="text-lg font-semibold"
          style={{ color: COLORS.DARK_SLATE }}
        >
          Land parcel not found
        </Text>
        <TouchableOpacity className="mt-4" onPress={() => navigation.goBack()}>
          <Text style={{ color: COLORS.FOREST_GREEN }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <ScreenHeader
        title={parcel.farm_name}
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center"
            onPress={() =>
              navigation.navigate('EditLandNameScreen', { landId: parcel.id })
            }
          >
            <MaterialCommunityIcons
              color={COLORS.FOREST_GREEN}
              name="pencil-outline"
              size={22}
            />
          </TouchableOpacity>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(32, bottomSpacing) }}
      >
        {parcel.thumbnail_url ? (
          <Image
            source={{ uri: parcel.thumbnail_url }}
            className="h-52 w-full"
            resizeMode="cover"
          />
        ) : (
          <View
            className="h-52 items-center justify-center"
            style={{ backgroundColor: COLORS.SUCCESS_SURFACE }}
          >
            <MaterialCommunityIcons
              color={COLORS.FOREST_GREEN}
              name="map-outline"
              size={56}
            />
          </View>
        )}

        <View className="px-4 pt-4">
          <Card>
            <View className="flex-row items-center justify-between">
              <View>
                <Text
                  className="text-2xl font-bold"
                  style={{ color: COLORS.DARK_SLATE }}
                >
                  {parcel.farm_name}
                </Text>
                <Text
                  className="mt-1 text-sm"
                  style={{ color: COLORS.DISABLED_GREY }}
                >
                  Survey No. {parcel.survey_number}
                </Text>
              </View>
              {statusMeta && (
                <Badge label={statusMeta.label} variant={statusMeta.variant} />
              )}
            </View>

            <View className="mt-5 gap-3">
              <Text style={{ color: COLORS.DARK_SLATE }}>
                <Text className="font-semibold">Area:</Text>{' '}
                {hectaresToAcres(parcel.area_hectares).toFixed(2)} acres
              </Text>
              <Text style={{ color: COLORS.DARK_SLATE }}>
                <Text className="font-semibold">Village:</Text> {parcel.village}
              </Text>
              <Text style={{ color: COLORS.DARK_SLATE }}>
                <Text className="font-semibold">Taluka:</Text> {parcel.taluka}
              </Text>
              <Text style={{ color: COLORS.DARK_SLATE }}>
                <Text className="font-semibold">District:</Text>{' '}
                {parcel.district}
              </Text>
              <Text style={{ color: COLORS.DARK_SLATE }}>
                <Text className="font-semibold">Boundary Source:</Text>{' '}
                {parcel.boundary_source === 'MANUAL'
                  ? 'Manual Map'
                  : 'Official Government Record'}
              </Text>
              <Text style={{ color: COLORS.DARK_SLATE }}>
                <Text className="font-semibold">Registered:</Text>{' '}
                {Number.isNaN(Date.parse(parcel.created_at))
                  ? 'Unavailable'
                  : new Date(parcel.created_at).toLocaleDateString('en-GB')}
              </Text>
            </View>
          </Card>

          <Card className="mt-4">
            <Text
              className="text-lg font-bold"
              style={{ color: COLORS.DARK_SLATE }}
            >
              Audit History
            </Text>
            {isLoadingHistory ? (
              <Text className="mt-3" style={{ color: COLORS.DISABLED_GREY }}>
                Loading audit history...
              </Text>
            ) : historyError && history.length === 0 ? null : history.length ===
              0 ? (
              <Text className="mt-3" style={{ color: COLORS.DISABLED_GREY }}>
                No audit history for this land yet.
              </Text>
            ) : (
              history.map(record => (
                <View
                  key={`${record.audit_year}-${
                    record.audit_id ?? record.status ?? 'audit'
                  }`}
                  className="mt-4 rounded-xl px-4 py-3"
                  style={{ backgroundColor: COLORS.OFF_WHITE }}
                >
                  <Text
                    className="font-semibold"
                    style={{ color: COLORS.DARK_SLATE }}
                  >
                    {record.audit_year}
                  </Text>
                  <Text
                    className="mt-1"
                    style={{ color: COLORS.DISABLED_GREY }}
                  >
                    {record.credits_issued} CTT
                  </Text>
                  {record.ipfs_certificate_url ? (
                    <TouchableOpacity
                      className="mt-2"
                      onPress={() =>
                        void openExternalLink(
                          record.ipfs_certificate_url as string,
                        )
                      }
                    >
                      <Text style={{ color: COLORS.TEAL }}>
                        View certificate
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
            {historyError ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => void loadHistory(failedPage)}
                style={{
                  minHeight: 48,
                  justifyContent: 'center',
                  marginTop: 12,
                }}
              >
                <Text style={{ color: COLORS.ERROR_RED }}>{historyError}</Text>
              </TouchableOpacity>
            ) : null}
            {hasMore && !historyError ? (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isLoadingHistory}
                onPress={() => void loadHistory(historyPage + 1)}
                style={{
                  minHeight: 48,
                  justifyContent: 'center',
                  marginTop: 12,
                }}
              >
                <Text style={{ color: COLORS.FOREST_GREEN }}>
                  Load more audits
                </Text>
              </TouchableOpacity>
            ) : null}
          </Card>

          <View className="mt-4 gap-3">
            {statusMeta?.primaryAction === 'view_status' &&
            parcel.current_audit_id ? (
              <TouchableOpacity
                className="min-h-[52px] items-center justify-center rounded-xl"
                style={{ backgroundColor: COLORS.BANNER_INFO }}
                onPress={() =>
                  navigation.navigate('AuditStatusScreen', {
                    auditId: parcel.current_audit_id as string,
                  })
                }
              >
                <Text className="font-semibold text-white">
                  View Audit Status
                </Text>
              </TouchableOpacity>
            ) : statusMeta?.primaryAction === 'start_audit' ? (
              <TouchableOpacity
                className="min-h-[52px] items-center justify-center rounded-xl"
                style={{ backgroundColor: COLORS.BUTTON_BACKGROUND }}
                onPress={() =>
                  navigation.navigate('AuditStartScreen', {
                    landId: parcel.id,
                    landName: parcel.farm_name,
                    originTab,
                  })
                }
              >
                <Text className="font-semibold text-white">Start Audit</Text>
              </TouchableOpacity>
            ) : parcel.is_verified ? null : (
              <View
                className="min-h-[52px] items-center justify-center rounded-xl px-4"
                style={{ backgroundColor: COLORS.INPUT_BACKGROUND }}
              >
                <Text style={{ color: COLORS.DARK_SLATE }}>
                  Finish land verification before starting an audit.
                </Text>
              </View>
            )}

            {parcel.latest_certificate_url ? (
              <TouchableOpacity
                className="min-h-[52px] items-center justify-center rounded-xl border"
                style={{ borderColor: COLORS.TEAL }}
                onPress={() =>
                  void openExternalLink(parcel.latest_certificate_url as string)
                }
              >
                <Text style={{ color: COLORS.TEAL }}>
                  View Latest Certificate
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default LandDetailScreen;
