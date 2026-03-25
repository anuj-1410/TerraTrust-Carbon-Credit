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

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_BADGE: Record<string, {label: string; variant: 'verified' | 'pending' | 'rejected'}> = {
  verified: {label: '✓ Verified', variant: 'verified'},
  pending: {label: '⏳ Pending', variant: 'pending'},
  rejected: {label: '✗ Rejected', variant: 'rejected'},
};

const LandListScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const parcels = useAppSelector(s => s.land.parcels);
  const lastSyncedAt = useAppSelector(s => s.land.lastSyncedAt);

  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currentYear = new Date().getFullYear();

  const fetchParcels = useCallback(async () => {
    try {
      const {data} = await api.get('/land/list');
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

  const formatSyncTime = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    const time = d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    return isToday ? `Last synced today at ${time}` : `Last synced ${d.toLocaleDateString()} at ${time}`;
  };

  const renderParcelCard = ({item}: {item: LandParcel}) => {
    const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.pending;
    const showStartAudit =
      item.is_verified && item.last_audit_year !== currentYear;

    return (
      <View className="mx-4 mb-3 rounded-xl bg-[#114D3A] p-4 flex-row">
        {/* Satellite thumbnail */}
        <Image
          source={item.thumbnail_url ? {uri: item.thumbnail_url} : undefined}
          className="w-16 h-16 rounded-lg bg-[#1B5E3B]"
          resizeMode="cover"
        />

        {/* Card content */}
        <View className="flex-1 ml-3">
          <Text className="text-white text-base font-semibold" numberOfLines={1}>
            {item.farm_name}
          </Text>
          <Text
            className="text-emerald-300 text-sm mt-0.5"
            style={{fontFamily: 'RobotoMono-Regular'}}>
            {hectaresToAcres(item.area_hectares).toFixed(2)} acres
          </Text>
          <View className="flex-row items-center mt-1.5 gap-2">
            <Badge label={badge.label} variant={badge.variant} />
            <Text className="text-white/50 text-xs">
              {item.last_audit_year
                ? `Last audited: ${item.last_audit_year}`
                : 'No audit yet'}
            </Text>
          </View>
          {showStartAudit && (
            <TouchableOpacity
              className="mt-2 self-start rounded-lg border border-emerald-400 px-4 py-2 min-h-[48px] justify-center"
              onPress={() =>
                navigation.navigate('AuditStartScreen', {landId: item.id, landName: item.farm_name})
              }
              activeOpacity={0.7}>
              <Text className="text-emerald-300 text-sm font-semibold">
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
      {/* Leaf illustration placeholder */}
      <View className="w-24 h-24 rounded-full bg-[#1B5E3B] items-center justify-center mb-6">
        <Text className="text-5xl">🌿</Text>
      </View>
      <Text className="text-white text-xl font-bold mb-2">
        No land parcels yet
      </Text>
      <Text className="text-white/50 text-sm text-center mb-6">
        Add your first land parcel to get started
      </Text>
      <TouchableOpacity
        className="bg-[#EC5B13] rounded-xl px-8 py-3.5 min-h-[48px] justify-center"
        onPress={() => navigation.navigate('DocumentUploadScreen')}
        activeOpacity={0.7}>
        <Text className="text-white font-semibold text-base">
          Add Your First Parcel
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-[#0A3D2E]">
      {/* Offline banner */}
      {isOffline && (
        <View className="bg-amber-600 px-4 py-2">
          <Text className="text-white text-sm text-center font-medium">
            You are offline. Showing saved data.
          </Text>
        </View>
      )}

      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold tracking-tight">
          My Land Parcels
        </Text>
        {lastSyncedAt && (
          <Text className="text-white/50 text-xs mt-1 tracking-wide uppercase">
            {formatSyncTime(lastSyncedAt)}
          </Text>
        )}
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
            tintColor="#B0C5BD"
            colors={['#1B5E3B']}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-6 right-5 w-14 h-14 rounded-full bg-[#EC5B13] items-center justify-center shadow-2xl"
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
