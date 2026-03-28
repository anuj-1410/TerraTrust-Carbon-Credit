import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../types/navigation';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {
  setParcels,
  setLastSynced,
  type LandParcel,
} from '../store/landSlice';
import api from '../../../services/api';
import Badge from '../../../common/components/Badge';
import {hectaresToAcres} from '../../../common/utils/units';
import {COLORS} from '../../../common/constants/colors';
import {getLandStatusMeta} from '../../../common/utils/getLandStatus';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const LandListScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const parcels = useAppSelector(s => s.land.parcels);

  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchParcels = useCallback(async () => {
    try {
      const {data} = await api.get('/api/v1/land/list');
      const merged = (data as Array<Record<string, unknown>>).map(item => {
        const cached = parcels.find((p: LandParcel) => p.id === (item as {id: string}).id);
        return {
          ...(cached ?? {}),
          ...item,
          boundary_geojson: cached?.boundary_geojson ?? null,
          district: cached?.district ?? '',
          taluka: cached?.taluka ?? '',
          village: cached?.village ?? '',
          state: cached?.state ?? '',
          created_at: cached?.created_at ?? '',
        } as LandParcel;
      });
      dispatch(setParcels(merged));
      dispatch(setLastSynced(new Date().toISOString()));
      setIsOffline(false);
    } catch (err: unknown) {
      const axiosErr = err as {response?: unknown};
      if (!axiosErr.response) {
        setIsOffline(true);
      }
    }
  }, [dispatch, parcels]);

  useEffect(() => {
    fetchParcels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchParcels();
    setRefreshing(false);
  }, [fetchParcels]);

  const renderParcelCard = ({item}: {item: LandParcel}) => {
    const cardState = getLandStatusMeta(item);
    const badgeVariant =
      cardState.status === 'green'
        ? 'verified'
        : cardState.status === 'orange'
          ? 'pending'
          : 'rejected';

    return (
      <View className="mx-4 mb-3 rounded-xl bg-white p-4 flex-row" style={{elevation: 2}}>
        {/* Satellite thumbnail */}
        <Image
          source={item.thumbnail_url ? {uri: item.thumbnail_url} : undefined}
          className="w-16 h-16 rounded-lg bg-gray-200"
          resizeMode="cover"
        />

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
          <View className="flex-row items-center mt-1.5 gap-2">
            <Badge label={cardState.label} variant={badgeVariant} />
          </View>
          {cardState.showAudit && (
            <TouchableOpacity
              className="mt-2 self-start rounded-lg px-4 py-2 min-h-[48px] justify-center"
              style={{borderWidth: 1, borderColor: COLORS.FOREST_GREEN}}
              onPress={() =>
                navigation.navigate('AuditStartScreen', {landId: item.id, landName: item.farm_name})
              }
              activeOpacity={0.7}>
              <Text className="text-sm font-semibold" style={{color: COLORS.FOREST_GREEN}}>
                Start Audit
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-8 pt-24">
      <View className="w-24 h-24 rounded-full items-center justify-center mb-6" style={{backgroundColor: COLORS.FOREST_GREEN + '20'}}>
        <Text className="text-5xl">🌿</Text>
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
          Add Your First Parcel
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      {/* Offline banner */}
      {isOffline && (
        <View className="px-4 py-2" style={{backgroundColor: COLORS.WARNING_ORANGE}}>
          <Text className="text-white text-sm text-center font-medium">
            You are offline. Showing saved data.
          </Text>
        </View>
      )}

      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold tracking-tight" style={{color: COLORS.DARK_SLATE}}>
          My Lands
        </Text>
      </View>

      {/* Parcel list */}
      <FlatList
        data={parcels}
        keyExtractor={item => item.id}
        renderItem={renderParcelCard}
        contentContainerStyle={parcels.length === 0 ? {flex: 1} : {paddingBottom: 80}}
        ListEmptyComponent={renderEmptyState}
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
        className="absolute bottom-6 right-5 w-14 h-14 rounded-full items-center justify-center shadow-2xl"
        style={{backgroundColor: COLORS.FOREST_GREEN}}
        onPress={() => navigation.navigate('DocumentUploadScreen')}
        activeOpacity={0.7}>
        <Text className="text-white text-3xl font-light leading-none" style={{marginTop: -2}}>
          +
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default LandListScreen;
