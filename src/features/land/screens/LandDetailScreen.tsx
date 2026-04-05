import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Badge from '../../../common/components/Badge';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {getLandStatusMeta} from '../../../common/utils/getLandStatus';
import {hectaresToAcres} from '../../../common/utils/units';
import {useAppSelector} from '../../../store/hooks';
import api from '../../../services/api';
import type {RootStackParamList} from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LandDetailScreen'>;
type RouteType = RouteProp<RootStackParamList, 'LandDetailScreen'>;

interface ParcelAuditHistory {
  audit_id?: string;
  audit_year: number;
  credits_issued: number;
  status?: string;
  ipfs_certificate_url?: string;
}

const PROCESSING_STATUSES = new Set(['PROCESSING', 'CALCULATING', 'READY_TO_MINT']);

const LandDetailScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const {landId, originTab = 'LandTab'} = route.params;
  const parcel = useAppSelector(state =>
    state.land.parcels.find(item => item.id === landId),
  );

  const [history, setHistory] = useState<ParcelAuditHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const response = await api.get(`/api/v1/audit/history/${landId}`);
        const records = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.items)
            ? response.data.items
            : [];

        if (isMounted) {
          setHistory(records as ParcelAuditHistory[]);
        }
      } catch {
        if (isMounted) {
          setHistory([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [landId]);

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
      <View className="flex-1 items-center justify-center px-6" style={{backgroundColor: COLORS.OFF_WHITE}}>
        <Text className="text-lg font-semibold" style={{color: COLORS.DARK_SLATE}}>
          Land parcel not found
        </Text>
        <TouchableOpacity className="mt-4" onPress={() => navigation.goBack()}>
          <Text style={{color: COLORS.FOREST_GREEN}}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <ScrollView contentContainerStyle={{paddingBottom: 32}}>
        <View className="flex-row items-center justify-between px-4 pb-4 pt-12">
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center"
            onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons
              color={COLORS.DARK_SLATE}
              name="arrow-left"
              size={24}
            />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-xl font-bold" style={{color: COLORS.DARK_SLATE}}>
            {parcel.farm_name}
          </Text>
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center"
            onPress={() => navigation.navigate('EditLandNameScreen', {landId: parcel.id})}>
            <Text style={{color: COLORS.FOREST_GREEN}}>Edit</Text>
          </TouchableOpacity>
        </View>

        {parcel.thumbnail_url ? (
          <Image source={{uri: parcel.thumbnail_url}} className="h-52 w-full" resizeMode="cover" />
        ) : (
          <View className="h-52 items-center justify-center" style={{backgroundColor: 'rgba(47,133,90,0.12)'}}>
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
                <Text className="text-2xl font-bold" style={{color: COLORS.DARK_SLATE}}>
                  {parcel.farm_name}
                </Text>
                <Text className="mt-1 text-sm" style={{color: COLORS.DISABLED_GREY}}>
                  Survey No. {parcel.survey_number}
                </Text>
              </View>
              {statusMeta && <Badge label={statusMeta.label} variant={statusMeta.variant} />}
            </View>

            <View className="mt-5 gap-3">
              <Text style={{color: COLORS.DARK_SLATE}}>
                <Text className="font-semibold">Area:</Text>{' '}
                {hectaresToAcres(parcel.area_hectares).toFixed(2)} acres
              </Text>
              <Text style={{color: COLORS.DARK_SLATE}}>
                <Text className="font-semibold">Village:</Text> {parcel.village}
              </Text>
              <Text style={{color: COLORS.DARK_SLATE}}>
                <Text className="font-semibold">Taluka:</Text> {parcel.taluka}
              </Text>
              <Text style={{color: COLORS.DARK_SLATE}}>
                <Text className="font-semibold">District:</Text> {parcel.district}
              </Text>
              <Text style={{color: COLORS.DARK_SLATE}}>
                <Text className="font-semibold">Boundary Source:</Text>{' '}
                {parcel.boundary_source === 'MANUAL'
                  ? 'Manual Map'
                  : 'Official Government Record'}
              </Text>
              <Text style={{color: COLORS.DARK_SLATE}}>
                <Text className="font-semibold">Registered:</Text>{' '}
                {new Date(parcel.created_at).toLocaleDateString('en-GB')}
              </Text>
            </View>
          </Card>

          <Card className="mt-4">
            <Text className="text-lg font-bold" style={{color: COLORS.DARK_SLATE}}>
              Audit History
            </Text>
            {isLoadingHistory ? (
              <Text className="mt-3" style={{color: COLORS.DISABLED_GREY}}>
                Loading audit history...
              </Text>
            ) : history.length === 0 ? (
              <Text className="mt-3" style={{color: COLORS.DISABLED_GREY}}>
                No audit history for this land yet.
              </Text>
            ) : (
              history.map(record => (
                <View key={`${record.audit_year}-${record.audit_id ?? record.status ?? 'audit'}`} className="mt-4 rounded-xl px-4 py-3" style={{backgroundColor: COLORS.OFF_WHITE}}>
                  <Text className="font-semibold" style={{color: COLORS.DARK_SLATE}}>
                    {record.audit_year}
                  </Text>
                  <Text className="mt-1" style={{color: COLORS.DISABLED_GREY}}>
                    {record.credits_issued} CTT
                  </Text>
                  {record.ipfs_certificate_url ? (
                    <TouchableOpacity
                      className="mt-2"
                      onPress={() => void Linking.openURL(record.ipfs_certificate_url as string)}>
                      <Text style={{color: COLORS.TEAL}}>View certificate</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </Card>

          <View className="mt-4 gap-3">
            {parcel.is_verified &&
            parcel.current_audit_id &&
            parcel.current_audit_status &&
            PROCESSING_STATUSES.has(parcel.current_audit_status) ? (
              <TouchableOpacity
                className="min-h-[52px] items-center justify-center rounded-xl"
                style={{backgroundColor: COLORS.FOREST_GREEN}}
                onPress={() =>
                  navigation.navigate('AuditStatusScreen', {
                    auditId: parcel.current_audit_id as string,
                  })
                }>
                <Text className="font-semibold text-white">View Audit Status</Text>
              </TouchableOpacity>
            ) : parcel.is_verified ? (
              <TouchableOpacity
                className="min-h-[52px] items-center justify-center rounded-xl"
                style={{backgroundColor: COLORS.FOREST_GREEN}}
                onPress={() =>
                  navigation.navigate('AuditStartScreen', {
                    landId: parcel.id,
                    landName: parcel.farm_name,
                    originTab,
                  })
                }>
                <Text className="font-semibold text-white">Start Audit</Text>
              </TouchableOpacity>
            ) : (
              <View
                className="min-h-[52px] items-center justify-center rounded-xl px-4"
                style={{backgroundColor: 'rgba(160,174,192,0.25)'}}>
                <Text style={{color: COLORS.DARK_SLATE}}>
                  Finish land verification before starting an audit.
                </Text>
              </View>
            )}

            {parcel.latest_certificate_url ? (
              <TouchableOpacity
                className="min-h-[52px] items-center justify-center rounded-xl border"
                style={{borderColor: COLORS.TEAL}}
                onPress={() => void Linking.openURL(parcel.latest_certificate_url as string)}>
                <Text style={{color: COLORS.TEAL}}>View Latest Certificate</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              className="min-h-[52px] items-center justify-center rounded-xl border"
              style={{borderColor: COLORS.ERROR_RED}}
              onPress={() => navigation.navigate('DocumentUploadScreen')}>
              <Text style={{color: COLORS.ERROR_RED}}>Report Boundary Issue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default LandDetailScreen;