import ScreenHeader from '../../../common/components/ScreenHeader';
import { useTheme } from '../../../common/theme/theme';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialDesignIcons as MaterialCommunityIcons } from '@react-native-vector-icons/material-design-icons';
import type { RootStackParamList } from '../../../types/navigation';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { fetchLandPage, type LandParcel } from '../store/landSlice';
import Badge from '../../../common/components/Badge';
import { hectaresToAcres } from '../../../common/utils/units';
import { getLandStatusMeta } from '../../../common/utils/getLandStatus';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const LandListScreen = () => {
  const { colors: COLORS } = useTheme();
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { horizontalPadding, bottomSpacing, contentMaxWidth } =
    useResponsiveScreen();
  const {
    parcels,
    currentPage = 1,
    hasMore = false,
  } = useAppSelector(s => s.land);
  const inFlightPagesRef = useRef<Set<number>>(new Set());

  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchParcels = useCallback(
    async (pageToLoad = 1) => {
      const isLoadMore = pageToLoad > 1;
      if (inFlightPagesRef.current.has(pageToLoad)) {
        return;
      }

      inFlightPagesRef.current.add(pageToLoad);

      if (isLoadMore) {
        setIsLoadingMore(true);
      }

      try {
        await dispatch(fetchLandPage(pageToLoad)).unwrap();
        setLoadError(null);
        setIsOffline(false);
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: unknown;
          name?: string;
          message?: string;
        };
        if (
          axiosErr.name === 'ConditionError' ||
          axiosErr.message?.startsWith('LAND_')
        ) {
          return;
        }
        if (!axiosErr.response) {
          setIsOffline(true);
        }
        setLoadError('Unable to refresh your lands. Please try again.');
      } finally {
        setInitialLoading(false);
        inFlightPagesRef.current.delete(pageToLoad);
        if (isLoadMore) {
          setIsLoadingMore(false);
        }
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void fetchParcels(1);
  }, [fetchParcels]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchParcels(1);
    setRefreshing(false);
  }, [fetchParcels]);

  const onLoadMore = useCallback(() => {
    if (
      refreshing ||
      isLoadingMore ||
      inFlightPagesRef.current.has(1) ||
      !hasMore
    ) {
      return;
    }

    void fetchParcels(currentPage + 1);
  }, [currentPage, fetchParcels, hasMore, isLoadingMore, refreshing]);

  const renderParcelCard = ({ item }: { item: LandParcel }) => {
    const cardState = getLandStatusMeta(item);
    const badgeVariant =
      cardState.status === 'green'
        ? 'verified'
        : cardState.status === 'orange'
        ? 'pending'
        : 'rejected';

    const handlePrimaryAction = () => {
      if (cardState.primaryAction === 'view_status' && item.current_audit_id) {
        navigation.navigate('AuditStatusScreen', {
          auditId: item.current_audit_id,
        });
        return;
      }

      navigation.navigate('AuditStartScreen', {
        landId: item.id,
        landName: item.farm_name,
        originTab: 'LandTab',
      });
    };

    return (
      <TouchableOpacity
        className="mb-3 rounded-xl bg-surface p-4 flex-row self-center w-full"
        style={{
          borderWidth: 1,
          borderColor: COLORS.BORDER,
          maxWidth: contentMaxWidth,
        }}
        activeOpacity={0.82}
        onPress={() =>
          navigation.navigate('LandDetailScreen', {
            landId: item.id,
            originTab: 'LandTab',
          })
        }
      >
        {/* Satellite thumbnail */}
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            className="w-16 h-16 rounded-lg bg-disabled"
            resizeMode="cover"
          />
        ) : (
          <View
            className="h-16 w-16 items-center justify-center rounded-lg"
            style={{ backgroundColor: COLORS.DISABLED_BACKGROUND }}
          >
            <MaterialCommunityIcons
              color={COLORS.FOREST_GREEN}
              name="sprout"
              size={24}
            />
          </View>
        )}

        {/* Card content */}
        <View className="flex-1 ml-3">
          <Text
            className="text-base font-semibold"
            style={{ color: COLORS.DARK_SLATE }}
            numberOfLines={1}
          >
            {item.farm_name}
          </Text>
          <Text
            className="text-sm mt-0.5"
            style={{
              fontFamily: 'RobotoMono-Regular',
              color: COLORS.FOREST_GREEN,
            }}
          >
            {hectaresToAcres(item.area_hectares).toFixed(2)} acres
          </Text>
          <Text
            className="mt-1 text-sm"
            style={{ color: COLORS.DISABLED_GREY }}
          >
            Survey No. {item.survey_number}
          </Text>
          <Text
            className="mt-1 text-sm"
            style={{ color: COLORS.DISABLED_GREY }}
          >
            Last audit: {item.last_audit_year ?? 'No audit yet'}
          </Text>
          <View className="flex-row items-center mt-1.5 gap-2">
            <Badge label={cardState.label} variant={badgeVariant} />
          </View>
          {cardState.secondaryLabel ? (
            <Text
              className="mt-2 text-sm"
              style={{ color: COLORS.DISABLED_GREY }}
            >
              {cardState.secondaryLabel}
            </Text>
          ) : null}
          {cardState.primaryActionLabel ? (
            <TouchableOpacity
              className="mt-2 self-start rounded-lg px-4 py-2 min-h-[48px] justify-center"
              style={{ borderWidth: 1, borderColor: COLORS.FOREST_GREEN }}
              onPress={handlePrimaryAction}
              activeOpacity={0.7}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: COLORS.FOREST_GREEN }}
              >
                {cardState.primaryActionLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-8 pt-24">
      <View
        className="w-24 h-24 rounded-full items-center justify-center mb-6"
        style={{ backgroundColor: COLORS.BUTTON_BACKGROUND + '20' }}
      >
        <MaterialCommunityIcons
          color={COLORS.FOREST_GREEN}
          name="sprout"
          size={44}
        />
      </View>
      <Text
        className="text-xl font-bold mb-2"
        style={{ color: COLORS.DARK_SLATE }}
      >
        No land parcels yet
      </Text>
      <Text
        className="text-sm text-center mb-6"
        style={{ color: COLORS.DISABLED_GREY }}
      >
        Add your first land parcel to get started
      </Text>
      <TouchableOpacity
        className="rounded-xl px-8 py-3.5 min-h-[48px] justify-center"
        style={{ backgroundColor: COLORS.BUTTON_BACKGROUND }}
        onPress={() => navigation.navigate('DocumentUploadScreen')}
        activeOpacity={0.7}
      >
        <Text className="text-white font-semibold text-base">
          Register Your First Land
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <ScreenHeader title="My Lands" />
      {/* Offline banner */}
      {isOffline && (
        <View
          className="py-2"
          style={{
            backgroundColor: COLORS.BANNER_WARNING,
            paddingHorizontal: horizontalPadding,
          }}
        >
          <Text className="text-white text-sm text-center font-medium">
            You are offline. Showing saved data.
          </Text>
        </View>
      )}

      {/* Header */}

      {/* Parcel list */}
      <FlatList
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        data={parcels}
        keyExtractor={item => item.id}
        renderItem={renderParcelCard}
        contentContainerStyle={
          parcels.length === 0
            ? { flex: 1, paddingHorizontal: horizontalPadding }
            : {
                paddingHorizontal: horizontalPadding,
                paddingTop: 4,
                paddingBottom: bottomSpacing,
              }
        }
        ListEmptyComponent={parcels.length === 0 ? initialLoading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator color={COLORS.FOREST_GREEN} /><Text className="mt-3" style={{ color: COLORS.DISABLED_GREY }}>Loading your lands...</Text></View>
        ) : renderEmptyState() : null}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          loadError ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void fetchParcels(1)}
              style={{ minHeight: 48, paddingVertical: 16 }}
            >
              <Text style={{ color: COLORS.ERROR_RED }}>
                {loadError} Tap to retry.
              </Text>
            </TouchableOpacity>
          ) : isLoadingMore ? (
            <View className="py-4">
              <ActivityIndicator color={COLORS.FOREST_GREEN} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.FOREST_GREEN}
            colors={[COLORS.FOREST_GREEN]}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        className="absolute w-14 h-14 rounded-full items-center justify-center "
        style={{
          backgroundColor: COLORS.BUTTON_BACKGROUND,
          right: horizontalPadding,
          bottom: bottomSpacing,
        }}
        onPress={() => navigation.navigate('DocumentUploadScreen')}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons color="#FFFFFF" name="plus" size={28} />
      </TouchableOpacity>
    </View>
  );
};

export default LandListScreen;
