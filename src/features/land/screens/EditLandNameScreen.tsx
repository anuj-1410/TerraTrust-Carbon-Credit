import React, {useMemo, useState} from 'react';
import {View, Text, TextInput, TouchableOpacity} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Button from '../../../common/components/Button';
import {COLORS} from '../../../common/constants/colors';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {updateParcel} from '../store/landSlice';
import api from '../../../services/api';
import type {RootStackParamList} from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'EditLandNameScreen'>;
type RouteType = RouteProp<RootStackParamList, 'EditLandNameScreen'>;

const EditLandNameScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const dispatch = useAppDispatch();
  const parcel = useAppSelector(state =>
    state.land.parcels.find(item => item.id === route.params.landId),
  );
  const [farmName, setFarmName] = useState(parcel?.farm_name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedFarmName = useMemo(() => farmName.trim(), [farmName]);

  if (!parcel) {
    return (
      <View className="flex-1 items-center justify-center" style={{backgroundColor: COLORS.OFF_WHITE}}>
        <Text style={{color: COLORS.DARK_SLATE}}>Land parcel not found.</Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (!trimmedFarmName) {
      setErrorMessage('Please enter a farm name.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      await api.patch(`/api/v1/land/${parcel.id}`, {
        farm_name: trimmedFarmName,
      });

      dispatch(
        updateParcel({
          id: parcel.id,
          changes: {farm_name: trimmedFarmName},
        }),
      );
      navigation.goBack();
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.error ?? 'Unable to save this farm name. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="flex-1 px-6 pt-12" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          className="min-h-[48px] min-w-[48px] items-center justify-center"
          onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            color={COLORS.DARK_SLATE}
            name="arrow-left"
            size={24}
          />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{color: COLORS.DARK_SLATE}}>
          Edit Farm Name
        </Text>
        <View className="h-12 w-12" />
      </View>

      <Text className="mt-8 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
        This name is only for your reference. It does not change official land records.
      </Text>

      <TextInput
        className="mt-6 rounded-xl border bg-white px-4 py-4 text-base"
        style={{borderColor: COLORS.DISABLED_GREY, color: COLORS.DARK_SLATE}}
        value={farmName}
        onChangeText={setFarmName}
        placeholder="Enter farm name"
        placeholderTextColor={COLORS.DISABLED_GREY}
        maxLength={100}
      />

      {errorMessage ? (
        <Text className="mt-3" style={{color: COLORS.ERROR_RED}}>
          {errorMessage}
        </Text>
      ) : null}

      <View className="mt-8">
        <Button label={isSaving ? 'Saving...' : 'Save'} onPress={handleSave} disabled={isSaving} />
      </View>
    </View>
  );
};

export default EditLandNameScreen;