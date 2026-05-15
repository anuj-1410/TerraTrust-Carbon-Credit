import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  mergeLandParcels,
  normalizeLandParcels,
  type LandListResponse,
  setParcels,
  setLastSynced,
  type LandParcel,
} from '../store/landSlice';
import api from '../../../services/api';
import Badge from '../../../common/components/Badge';
import {hectaresToAcres} from '../../../common/utils/units';
import {COLORS} from '../../../common/constants/colors';
import {getLandStatusMeta} from '../../../common/utils/getLandStatus';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 10;

const LandListScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();
  const parcels = useAppSelector(s => s.land.parcels);
  const parcelsRef = useRef(parcels);
  const inFlightPagesRef = useRef<Set<number>>(new Set());

  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    parcelsRef.current = parcels;
  }, [parcels]);

  const fetchParcels = useCallback(async (pageToLoad = 1) => {
    const isLoadMore = pageToLoad > 1;
    if (inFlightPagesRef.current.has(pageToLoad)) {
      return;
    }

    inFlightPagesRef.current.add(pageToLoad);

    if (isLoadMore) {
      setIsLoadingMore(true);
    }

    try {
      const {data} = await api.get<
        LandListResponse | Array<Record<string, unknown>>
      >('/api/v1/land/list', {
        params: {page: pageToLoad, limit: PAGE_SIZE},
      });

      const currentParcels = parcelsRef.current;
      const items = Array.isArray(data) ? data : data.items ?? [];
      const incomingParcels = normalizeLandParcels(items, currentParcels);
      const nextParcels = isLoadMore
        ? mergeLandParcels(currentParcels, incomingParcels)
        : incomingParcels;

      dispatch(setParcels(nextParcels));
      dispatch(setLastSynced(new Date().toISOString()));
      setCurrentPage(pageToLoad);
      setHasMore(Array.isArray(data) ? false : Boolean(data.has_more));
      setIsOffline(false);
    } catch (err: unknown) {
      const axiosErr = err as {response?: unknown};
      if (!axiosErr.response) {
        setIsOffline(true);
      }
    } finally {
      inFlightPagesRef.current.delete(pageToLoad);
      if (isLoadMore) {
        setIsLoadingMore(false);
      }
    }
  }, [dispatch]);

  useEffect(() => {
    void fetchParcels(1);
  }, [fetchParcels]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchParcels(1);
    setRefreshing(false);
  }, [fetchParcels]);

  const onLoadMore = useCallback(() => {
    if (refreshing || isLoadingMore || !hasMore) {
      return;
    }

    void fetchParcels(currentPage + 1);
  }, [currentPage, fetchParcels, hasMore, isLoadingMore, refreshing]);

  const renderParcelCard = ({item}: {item: LandParcel}) => {
    const cardState = getLandStatusMeta(item);
    const badgeVariant =
      cardState.status === 'green'
        ? 'verified'
        : cardState.status === 'orange'
          ? 'pending'
          : 'rejected';

    const handlePrimaryAction = () => {
      if (cardState.primaryAction === 'view_status' && item.current_audit_id) {
        navigation.navigate('AuditStatusScreen', {auditId: item.current_audit_id});
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
        className="mb-3 rounded-xl bg-white p-4 flex-row self-center w-full"
        style={{elevation: 2, maxWidth: contentMaxWidth}}
        activeOpacity={0.82}
        onPress={() =>
          navigation.navigate('LandDetailScreen', {
            landId: item.id,
            originTab: 'LandTab',
          })
        }>
        {/* Satellite thumbnail */}
        {item.thumbnail_url ? (
          <Image
            source={{uri: item.thumbnail_url}}
            className="w-16 h-16 rounded-lg bg-gray-200"
            resizeMode="cover"
          />
        ) : (
          <View
            className="h-16 w-16 items-center justify-center rounded-lg"
            style={{backgroundColor: '#E5E7EB'}}>
            <MaterialCommunityIcons
              color={COLORS.FOREST_GREEN}
              name="sprout"
              size={24}
            />
          </View>
        )}

        {/* Card content */}
        <View className="flex-1 ml-3">
          <Text className="text-base font-semibold" style={{color: COLORS.DARK_SLATE}} numberOfLines={1}>
            {item.farm_name}
          </Text>
          <Text
            className="text-sm mt-0.5"
            style={{fontFamily: 'RobotoMono-Regular', color: COLORS.FOREST_GREEN}}>
            {hectaresToAcres(item.area_hectares).toFixed(2)} acres
          </Text>
          <Text className="mt-1 text-sm" style={{color: COLORS.DISABLED_GREY}}>
            Survey No. {item.survey_number}
          </Text>
          <Text className="mt-1 text-sm" style={{color: COLORS.DISABLED_GREY}}>
            Last audit: {item.last_audit_year ?? 'No audit yet'}
          </Text>
          <View className="flex-row items-center mt-1.5 gap-2">
            <Badge label={cardState.label} variant={badgeVariant} />
          </View>
          {cardState.secondaryLabel ? (
            <Text className="mt-2 text-sm" style={{color: COLORS.DISABLED_GREY}}>
              {cardState.secondaryLabel}
            </Text>
          ) : null}
          {cardState.primaryActionLabel ? (
            <TouchableOpacity
              className="mt-2 self-start rounded-lg px-4 py-2 min-h-[48px] justify-center"
              style={{borderWidth: 1, borderColor: COLORS.FOREST_GREEN}}
              onPress={handlePrimaryAction}
              activeOpacity={0.7}>
              <Text className="text-sm font-semibold" style={{color: COLORS.FOREST_GREEN}}>
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
      <View className="w-24 h-24 rounded-full items-center justify-center mb-6" style={{backgroundColor: COLORS.FOREST_GREEN + '20'}}>
        <MaterialCommunityIcons
          color={COLORS.FOREST_GREEN}
          name="sprout"
          size={44}
        />
      </View>
      <Text className="text-xl font-bold mb-2" style={{color: COLORS.DARK_SLATE}}>
        No land parcels yet
      </Text>
      <Text className="text-sm text-center mb-6" style={{color: COLORS.DISABLED_GREY}}>
        Add your first land parcel to get started
      </Text>
      <TouchableOpacity
        className="rounded-xl px-8 py-3.5 min-h-[48px] justify-center"
        style={{backgroundColor: COLORS.FOREST_GREEN}}
        onPress={() => navigation.navigate('DocumentUploadScreen')}
        activeOpacity={0.7}>
        <Text className="text-white font-semibold text-base">
          Register Your First Land
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      {/* Offline banner */}
      {isOffline && (
        <View
          className="py-2"
          style={{
            backgroundColor: COLORS.WARNING_ORANGE,
            paddingHorizontal: horizontalPadding,
          }}>
          <Text className="text-white text-sm text-center font-medium">
            You are offline. Showing saved data.
          </Text>
        </View>
      )}

      {/* Header */}
      <View
        className="self-center w-full pb-3"
        style={{
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: topSpacing,
        }}>
        <Text className="text-3xl font-bold tracking-tight" style={{color: COLORS.DARK_SLATE}}>
          My Lands
        </Text>
        <Text className="mt-2 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
          Review your verified parcels, current audit status, and add a new land record when needed.
        </Text>
      </View>

      {/* Parcel list */}
      <FlatList
        data={parcels}
        keyExtractor={item => item.id}
        renderItem={renderParcelCard}
        contentContainerStyle={
          parcels.length === 0
            ? {flex: 1, paddingHorizontal: horizontalPadding}
            : {
                paddingHorizontal: horizontalPadding,
                paddingTop: 4,
                paddingBottom: bottomSpacing + 64,
              }
        }
        ListEmptyComponent={renderEmptyState}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          isLoadingMore ? (
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
        className="absolute w-14 h-14 rounded-full items-center justify-center shadow-2xl"
        style={{
          backgroundColor: COLORS.FOREST_GREEN,
          right: horizontalPadding,
          bottom: bottomSpacing,
        }}
        onPress={() => navigation.navigate('DocumentUploadScreen')}
        activeOpacity={0.7}>
        <MaterialCommunityIcons color="#FFFFFF" name="plus" size={28} />
      </TouchableOpacity>
    </View>
  );
};

export default LandListScreen;
