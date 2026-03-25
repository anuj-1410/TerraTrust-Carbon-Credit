import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../types/navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ManualMeasureScreen'>;

const ManualMeasureScreen = () => {
  const navigation = useNavigation<NavProp>();
  const isFirstVisit = useRef(true);

  const [circumference, setCircumference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [calculatedDiameter, setCalculatedDiameter] = useState<number | null>(
    null,
  );

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
    isFirstVisit.current = false;
  }, [circumference]);

  const handleConfirm = useCallback(() => {
    if (calculatedDiameter === null) return;
    // Navigate back to ARCameraScreen with returnDiameter
    navigation.navigate('ARCameraScreen' as any, {
      returnDiameter: calculatedDiameter,
    });
  }, [calculatedDiameter, navigation]);

  return (
    <View className="flex-1 bg-[#F8FAF8]">
      {/* Header */}
      <View className="bg-[#1B4332] pt-12 pb-5 px-5">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-12 h-12 items-center justify-center rounded-full"
            accessibilityLabel="Go back">
            <Text className="text-white text-2xl">←</Text>
          </TouchableOpacity>
          <View className="flex-1 items-center mr-12">
            <Text className="text-white text-xl font-bold">
              Manual Measurement
            </Text>
            <Text className="text-white/60 text-sm mt-0.5">
              Tier 3 — Tape Measure
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{paddingBottom: 32}}
        keyboardShouldPersistTaps="handled">
        {/* Tutorial illustration area */}
        <View className="items-center mt-8 mb-6">
          {/* Trunk cross-section diagram */}
          <View className="w-36 h-36 rounded-full border-4 border-dashed border-[#F59E0B] bg-[#D1FAE5] items-center justify-center">
            <View className="w-24 h-24 rounded-full bg-[#2D6A4F] items-center justify-center">
              <Text className="text-white text-3xl">🌲</Text>
            </View>
          </View>
          <Text className="text-[#6B7280] text-sm text-center mt-4">
            Wrap tape at chest height{'\n'}(1.3m from ground)
          </Text>
          <Text className="text-[#2D6A4F] text-xs text-center mt-2">
            We'll calculate the diameter for you
          </Text>
        </View>

        {/* Input section */}
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <Text className="text-[#6B7280] text-sm mb-2">Circumference</Text>
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
              <View className="bg-[#F3F4F6] px-3 py-1 rounded-full">
                <Text className="text-[#6B7280] text-xs font-semibold">
                  ◎ Manual Measurement
                </Text>
              </View>
            </View>
            <Text
              className="text-[#191C1B] text-3xl font-bold mb-2"
              style={{fontFamily: 'RobotoMono-Bold'}}>
              {calculatedDiameter.toFixed(1)} cm
            </Text>
            <Text className="text-[#6B7280] text-xs">
              Diameter = Circumference ÷ π
            </Text>
            <Text className="text-[#6B7280] text-xs mt-1">
              Calculated from {circumference} cm circumference
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
