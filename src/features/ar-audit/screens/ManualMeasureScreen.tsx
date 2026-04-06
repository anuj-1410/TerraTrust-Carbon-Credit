import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from 'react-native';
import {CommonActions, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type {RootStackParamList} from '../../../types/navigation';
import Badge from '../../../common/components/Badge';
import {mmkv} from '../../../store/mmkvStorage';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ManualMeasureScreen'>;
type RouteType = RouteProp<RootStackParamList, 'ManualMeasureScreen'>;

const ManualMeasureScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const {zoneId, zoneIndex} = route.params;

  const [showTutorial, setShowTutorial] = useState(false);
  const [circumference, setCircumference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [calculatedDiameter, setCalculatedDiameter] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const tutorialShown = mmkv.getBoolean('manual_tutorial_shown');
    if (!tutorialShown) {
      setShowTutorial(true);
    }
  }, []);

  const dismissTutorial = useCallback(() => {
    mmkv.set('manual_tutorial_shown', true);
    setShowTutorial(false);
  }, []);

  const handleCalculate = useCallback(() => {
    Keyboard.dismiss();
    const trimmed = circumference.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      setError('Please enter a valid number');
      setCalculatedDiameter(null);
      return;
    }
    const num = parseFloat(trimmed);
    if (num <= 0) {
      setError('Circumference must be greater than zero');
      setCalculatedDiameter(null);
      return;
    }
    setError(null);
    const dbh = Math.round((num / Math.PI) * 10) / 10;
    setCalculatedDiameter(dbh);
  }, [circumference]);

  const handleConfirm = useCallback(() => {
    if (calculatedDiameter === null) return;
    navigation.dispatch(
      CommonActions.navigate({
        name: 'ARCameraScreen',
        params: {
          zoneId,
          zoneIndex,
          returnDiameter: calculatedDiameter,
        },
        merge: true,
      }),
    );
  }, [calculatedDiameter, navigation, zoneId, zoneIndex]);

  return (
    <View className="flex-1 bg-[#F8FAF8]">
      {/* Header */}
      <View className="bg-[#1B4332] pt-12 pb-5 px-5">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-12 h-12 items-center justify-center rounded-full"
            accessibilityLabel="Go back">
            <MaterialCommunityIcons color="#FFFFFF" name="arrow-left" size={24} />
          </TouchableOpacity>
          <View className="flex-1 items-center mr-12">
            <Text className="text-white text-xl font-bold">
              Manual Measurement
            </Text>
            <Text className="text-white/60 text-sm mt-0.5">
              Measure Using a String
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{paddingBottom: 32}}
        keyboardShouldPersistTaps="handled">
        {showTutorial && (
          <View className="items-center mt-8 mb-6 bg-white rounded-2xl p-5 shadow-sm">
            <LottieView
              source={require('../../../assets/lottie/string_wrap_tutorial.json')}
              autoPlay
              loop
              style={{width: 120, height: 120}}
            />
            <Text className="text-[#191C1B] text-base font-bold mt-4 text-center">
              Wrap a string around the tree trunk at chest height (1.3m from ground)
            </Text>
            <Text className="text-[#6B7280] text-sm text-center mt-2">
              Mark where the string meets, then measure the length with a ruler
            </Text>
            <TouchableOpacity
              onPress={dismissTutorial}
              className="mt-4 h-12 px-8 rounded-xl bg-[#2D6A4F] items-center justify-center"
              activeOpacity={0.7}>
              <Text className="text-white text-base font-bold">Got it</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tutorial illustration area */}
        <View className="items-center mt-8 mb-6">
          {/* Trunk cross-section diagram */}
          <View className="w-36 h-36 rounded-full border-4 border-dashed border-[#F59E0B] bg-[#D1FAE5] items-center justify-center">
            <View className="w-24 h-24 rounded-full bg-[#2D6A4F] items-center justify-center">
              <MaterialCommunityIcons color="#FFFFFF" name="sprout" size={32} />
            </View>
          </View>
          <Text className="text-[#6B7280] text-sm text-center mt-4">
            Wrap string at chest height{' '}(1.3m from ground)
          </Text>
          <Text className="text-[#2D6A4F] text-xs text-center mt-2">
            We'll calculate the diameter for you
          </Text>
        </View>

        {/* Input section */}
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <Text className="text-[#6B7280] text-sm mb-2">Length in centimetres</Text>
          <View className="flex-row items-center">
            <TextInput
              className={`flex-1 text-[#191C1B] text-2xl font-bold border-b-2 pb-2 ${
                error
                  ? 'border-[#EF4444]'
                  : circumference
                    ? 'border-[#2D6A4F]'
                    : 'border-[#E5E7EB]'
              }`}
              placeholder="e.g. 62.8"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              value={circumference}
              onChangeText={t => {
                setCircumference(t);
                setError(null);
              }}
              style={{fontFamily: 'RobotoMono-Bold'}}
              accessibilityLabel="Circumference input in centimeters"
            />
            <Text className="text-[#6B7280] text-lg ml-3">cm</Text>
          </View>
          {error && (
            <Text className="text-[#EF4444] text-xs mt-2">{error}</Text>
          )}

          {/* Calculate button */}
          <TouchableOpacity
            onPress={handleCalculate}
            disabled={!circumference.trim()}
            className={`mt-4 h-12 rounded-xl items-center justify-center ${
              circumference.trim() ? 'bg-[#40916C]' : 'bg-[#9CA3AF]'
            }`}>
            <Text className="text-white text-base font-semibold">
              Calculate Diameter
            </Text>
          </TouchableOpacity>
        </View>

        {/* Result display */}
        {calculatedDiameter !== null && (
          <View className="mt-5 bg-[#D1FAE5]/40 rounded-2xl p-5 border border-[#D1FAE5]">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[#6B7280] text-sm">
                Calculated Diameter
              </Text>
              <Badge label="Manual Measurement" variant="manual" />
            </View>
            <Text className="text-[#191C1B] text-3xl font-bold mb-2"
              style={{fontFamily: 'RobotoMono-Bold'}}>
              {calculatedDiameter.toFixed(1)} cm
            </Text>
            <Text className="text-[#6B7280] text-xs">
              Diameter: {calculatedDiameter.toFixed(1)} cm (calculated from {circumference} cm circumference)
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <View className="px-5 pb-8 pt-3 bg-[#F8FAF8]">
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={calculatedDiameter === null}
          className={`h-14 rounded-xl items-center justify-center ${
            calculatedDiameter !== null ? 'bg-[#2D6A4F]' : 'bg-[#9CA3AF]'
          }`}
          activeOpacity={0.7}>
          <Text className="text-white text-base font-bold">
            Confirm & Use This Measurement
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-3 h-12 rounded-xl border-2 border-[#D1D5DB] items-center justify-center"
          activeOpacity={0.7}>
          <Text className="text-[#6B7280] text-base font-semibold">
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ManualMeasureScreen;
