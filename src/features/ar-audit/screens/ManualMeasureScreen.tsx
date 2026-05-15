import React, {useCallback, useEffect, useState} from 'react';
import {
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {CommonActions, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Badge from '../../../common/components/Badge';
import Button from '../../../common/components/Button';
import Card from '../../../common/components/Card';
import {COLORS} from '../../../common/constants/colors';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';
import type {RootStackParamList} from '../../../types/navigation';
import {mmkv} from '../../../store/mmkvStorage';

type NavProp = NativeStackNavigationProp<
  RootStackParamList,
  'ManualMeasureScreen'
>;
type RouteType = RouteProp<RootStackParamList, 'ManualMeasureScreen'>;

const ManualMeasureScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {zoneId, zoneIndex, mode = 'diameter'} = route.params;
  const {horizontalPadding, topSpacing, bottomSpacing, contentMaxWidth} =
    useResponsiveScreen();
  const isHeightMode = mode === 'height';

  const [showTutorial, setShowTutorial] = useState(false);
  const [measurementInput, setMeasurementInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [calculatedValue, setCalculatedValue] = useState<number | null>(null);

  useEffect(() => {
    if (isHeightMode) {
      return;
    }

    const tutorialShown = mmkv.getBoolean('manual_tutorial_shown');
    if (!tutorialShown) {
      setShowTutorial(true);
    }
  }, [isHeightMode]);

  const dismissTutorial = useCallback(() => {
    mmkv.set('manual_tutorial_shown', true);
    setShowTutorial(false);
  }, []);

  const handleCalculate = useCallback(() => {
    Keyboard.dismiss();
    const trimmed = measurementInput.trim();

    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      setError('Please enter a valid number.');
      setCalculatedValue(null);
      return;
    }

    const numericValue = parseFloat(trimmed);

    if (isHeightMode) {
      if (numericValue < 0.5 || numericValue > 80) {
        setError('Height must be between 0.5 m and 80 m.');
        setCalculatedValue(null);
        return;
      }

      setError(null);
      setCalculatedValue(Math.round(numericValue * 10) / 10);
      return;
    }

    if (numericValue <= 0) {
      setError('Circumference must be greater than zero.');
      setCalculatedValue(null);
      return;
    }

    const dbh = Math.round((numericValue / Math.PI) * 10) / 10;
    if (dbh < 5 || dbh > 200) {
      setError('Calculated DBH must be between 5 cm and 200 cm.');
      setCalculatedValue(null);
      return;
    }

    setError(null);
    setCalculatedValue(dbh);
  }, [isHeightMode, measurementInput]);

  const handleConfirm = useCallback(() => {
    if (calculatedValue === null) {
      return;
    }

    navigation.dispatch(
      CommonActions.navigate({
        name: 'ARCameraScreen',
        params: {
          zoneId,
          zoneIndex,
          ...(isHeightMode
            ? {returnHeight: calculatedValue}
            : {returnDiameter: calculatedValue}),
        },
        merge: true,
      }),
    );
  }, [calculatedValue, isHeightMode, navigation, zoneId, zoneIndex]);

  return (
    <View className="flex-1" style={{backgroundColor: COLORS.OFF_WHITE}}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          alignSelf: 'center',
          width: '100%',
          maxWidth: contentMaxWidth,
          paddingHorizontal: horizontalPadding,
          paddingTop: topSpacing,
          paddingBottom: bottomSpacing,
        }}
        keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full"
            style={{backgroundColor: COLORS.CARD_WHITE}}
            accessibilityLabel="Go back">
            <MaterialCommunityIcons
              color={COLORS.DARK_SLATE}
              name="arrow-left"
              size={22}
            />
          </TouchableOpacity>
          <View className="ml-3 flex-1">
            <Text
              className="text-[13px] font-semibold uppercase tracking-[1.6px]"
              style={{color: COLORS.FOREST_GREEN}}>
              Manual Fallback
            </Text>
            <Text
              className="mt-1 text-3xl font-bold"
              style={{color: COLORS.DARK_SLATE}}>
              {isHeightMode ? 'Enter tree height' : 'Measure with a string'}
            </Text>
          </View>
        </View>

        <Text className="mt-4 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
          {isHeightMode
            ? 'Use this only when GEDI or AR height is unavailable for the current tree.'
            : 'Measure the trunk circumference at chest height and TerraTrust will calculate the DBH for you.'}
        </Text>

        {!isHeightMode && showTutorial ? (
          <Card className="mt-6 items-center px-5 py-6">
            <LottieView
              source={require('../../../assets/lottie/string_wrap_tutorial.json')}
              autoPlay
              loop
              style={{width: 120, height: 120}}
            />
            <Text
              className="mt-4 text-center text-lg font-semibold"
              style={{color: COLORS.DARK_SLATE}}>
              Wrap the string once around the trunk at 1.3 m height
            </Text>
            <Text
              className="mt-2 text-center text-sm leading-6"
              style={{color: COLORS.DISABLED_GREY}}>
              Mark where the string meets, then measure that circumference using
              a ruler or measuring tape.
            </Text>
            <Button className="mt-5 self-stretch" label="Got it" onPress={dismissTutorial} />
          </Card>
        ) : null}

        <Card className="mt-6 px-5 py-5">
          <View className="flex-row items-center">
            <View
              className="h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: isHeightMode
                  ? 'rgba(56,178,172,0.12)'
                  : 'rgba(47,133,90,0.12)',
              }}>
              <MaterialCommunityIcons
                color={isHeightMode ? COLORS.TEAL : COLORS.FOREST_GREEN}
                name={isHeightMode ? 'arrow-expand-vertical' : 'ruler'}
                size={28}
              />
            </View>
            <View className="ml-4 flex-1">
              <Text
                className="text-lg font-semibold"
                style={{color: COLORS.DARK_SLATE}}>
                {isHeightMode ? 'Height in metres' : 'Circumference in centimetres'}
              </Text>
              <Text
                className="mt-1 text-sm leading-6"
                style={{color: COLORS.DISABLED_GREY}}>
                {isHeightMode
                  ? 'Enter the best available tree height.'
                  : 'TerraTrust converts circumference to DBH automatically.'}
              </Text>
            </View>
          </View>

          <View
            className="mt-6 flex-row items-center rounded-2xl border px-4 py-3"
            style={{
              borderColor: error
                ? '#FCA5A5'
                : measurementInput
                  ? '#A7D7BE'
                  : '#E2E8F0',
            }}>
            <TextInput
              className="flex-1 text-3xl font-bold"
              placeholder={isHeightMode ? 'e.g. 12.5' : 'e.g. 62.8'}
              placeholderTextColor="#A0AEC0"
              keyboardType="decimal-pad"
              value={measurementInput}
              onChangeText={text => {
                setMeasurementInput(text);
                setError(null);
              }}
              style={{color: COLORS.DARK_SLATE, fontFamily: 'RobotoMono-Bold'}}
              accessibilityLabel={
                isHeightMode
                  ? 'Height input in metres'
                  : 'Circumference input in centimetres'
              }
            />
            <Text className="ml-3 text-lg" style={{color: COLORS.DISABLED_GREY}}>
              {isHeightMode ? 'm' : 'cm'}
            </Text>
          </View>

          {error ? (
            <Text className="mt-3 text-sm" style={{color: COLORS.ERROR_RED}}>
              {error}
            </Text>
          ) : null}

          <Button
            className="mt-5"
            label={isHeightMode ? 'Use this height' : 'Calculate diameter'}
            onPress={handleCalculate}
            disabled={!measurementInput.trim()}
          />
        </Card>

        {calculatedValue !== null ? (
          <Card className="mt-6 px-5 py-5" style={{backgroundColor: '#F2FBF7'}}>
            <View className="flex-row items-center justify-between">
              <Text
                className="text-sm font-semibold uppercase tracking-[1.2px]"
                style={{color: COLORS.FOREST_GREEN}}>
                {isHeightMode ? 'Height ready' : 'Diameter ready'}
              </Text>
              <Badge label="Manual Measurement" variant="manual" />
            </View>
            <Text
              className="mt-3 text-4xl font-bold"
              style={{color: COLORS.DARK_SLATE, fontFamily: 'RobotoMono-Bold'}}>
              {calculatedValue.toFixed(1)} {isHeightMode ? 'm' : 'cm'}
            </Text>
            <Text className="mt-3 text-sm leading-6" style={{color: COLORS.DISABLED_GREY}}>
              {isHeightMode
                ? `This manual height will be attached to the current tree scan.`
                : `DBH calculated from ${measurementInput} cm circumference.`}
            </Text>
          </Card>
        ) : null}
      </ScrollView>

      <View
        className="border-t px-4 pt-4"
        style={{
          borderTopColor: '#E2E8F0',
          backgroundColor: COLORS.OFF_WHITE,
          paddingBottom: bottomSpacing,
        }}>
        <View className="self-center w-full" style={{maxWidth: contentMaxWidth}}>
          <Button
            label={
              isHeightMode
                ? 'Confirm and use this height'
                : 'Confirm and use this measurement'
            }
            onPress={handleConfirm}
            disabled={calculatedValue === null}
          />
          <Button
            className="mt-3"
            label="Go back"
            onPress={() => navigation.goBack()}
            variant="secondary"
          />
        </View>
      </View>
    </View>
  );
};

export default ManualMeasureScreen;
