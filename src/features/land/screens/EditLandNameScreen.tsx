import ScreenHeader from '../../../common/components/ScreenHeader';
import { useTheme } from '../../../common/theme/theme';
import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';
import { useResponsiveScreen } from '../../../common/hooks/useResponsiveScreen';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { updateParcel } from '../store/landSlice';
import api from '../../../services/api';
import type { RootStackParamList } from '../../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'EditLandNameScreen'>;
type RouteType = RouteProp<RootStackParamList, 'EditLandNameScreen'>;

const EditLandNameScreen = () => {
  const { colors: COLORS } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const dispatch = useAppDispatch();
  const parcel = useAppSelector(state =>
    state.land.parcels.find(item => item.id === route.params.landId),
  );
  const { horizontalPadding, bottomSpacing, contentMaxWidth } =
    useResponsiveScreen();
  const [farmName, setFarmName] = useState(parcel?.farm_name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedFarmName = useMemo(() => farmName.trim(), [farmName]);

  if (!parcel) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: COLORS.OFF_WHITE }}
      >
        <Text style={{ color: COLORS.DARK_SLATE }}>Land parcel not found.</Text>
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
          changes: { farm_name: trimmedFarmName },
        }),
      );
      navigation.goBack();
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.error ??
          'Unable to save this farm name. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.OFF_WHITE }}>
      <ScreenHeader
        title="Edit Farm Name"
        eyebrow="Land Label"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          paddingBottom: bottomSpacing,
        }}
      >
        <Text
          className="mt-4 text-sm leading-6"
          style={{ color: COLORS.DISABLED_GREY }}
        >
          This name is only for your reference in TerraTrust. It does not change
          any official land record.
        </Text>

        <Card className="mt-6 px-5 py-5">
          <Text
            className="text-sm font-semibold uppercase tracking-[1.2px]"
            style={{ color: COLORS.DISABLED_GREY }}
          >
            Survey Number
          </Text>
          <Text
            className="mt-2 text-lg font-semibold"
            style={{ color: COLORS.DARK_SLATE }}
          >
            {parcel.survey_number}
          </Text>

          <Text className="mb-2 mt-6 text-sm font-medium text-content">
            Farm name
          </Text>
          <TextInput
            className="rounded-[20px] border bg-surface px-4 py-4 text-base"
            style={{
              borderColor: errorMessage ? COLORS.ERROR_RED : COLORS.BORDER,
              color: COLORS.DARK_SLATE,
            }}
            value={farmName}
            onChangeText={text => {
              setFarmName(text);
              setErrorMessage(null);
            }}
            placeholder="Enter farm name"
            placeholderTextColor={COLORS.DISABLED_GREY}
            maxLength={100}
          />

          {errorMessage ? (
            <Text className="mt-3 text-sm" style={{ color: COLORS.ERROR_RED }}>
              {errorMessage}
            </Text>
          ) : null}
        </Card>

        <View className="mt-8">
          <Button
            label={isSaving ? 'Saving...' : 'Save'}
            onPress={handleSave}
            disabled={isSaving}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default EditLandNameScreen;
