import React, {useEffect, useRef, useState} from 'react';
import {
  BackHandler,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import Card from '../../../common/components/Card';
import Button from '../../../common/components/Button';
import {markOnboardingComplete} from '../../../common/utils/onboarding';
import {COLORS} from '../../../common/constants/colors';
import {useAppDispatch} from '../../../store/hooks';
import {setOnboardingComplete} from '../../profile/store/profileSlice';
import type {RootStackParamList} from '../../../types/navigation';
import {useResponsiveScreen} from '../../../common/hooks/useResponsiveScreen';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OnboardingScreen'>;

const ONBOARDING_CARDS = [
  {
    title: 'Register Your Land',
    body: 'Upload your 7/12 document once. TerraTrust verifies the official boundary before any audit starts.',
    accentIcon: 'map-outline',
  },
  {
    title: 'Scan Trees Zone by Zone',
    body: 'Follow the guided route, scan trees inside each zone, and save progress even when the internet is weak.',
    accentIcon: 'camera-outline',
  },
  {
    title: 'Track Credits Clearly',
    body: 'See audit history, carbon credits earned, and certificates from one simple dashboard.',
    accentIcon: 'chart-line',
  },
];

const OnboardingScreen = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const {width} = useWindowDimensions();
  const {horizontalPadding, topSpacing, bottomSpacing} = useResponsiveScreen();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );

    return () => subscription.remove();
  }, []);

  const finishOnboarding = () => {
    markOnboardingComplete();
    dispatch(setOnboardingComplete(true));
    navigation.reset({index: 0, routes: [{name: 'HomeScreen'}]});
  };

  const scrollToIndex = (nextIndex: number) => {
    scrollRef.current?.scrollTo({
      x: width * nextIndex,
      animated: true,
    });
    setActiveIndex(nextIndex);
  };

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: COLORS.OFF_WHITE,
        paddingTop: topSpacing,
        paddingBottom: bottomSpacing,
      }}>
      <View className="items-end">
        {activeIndex < ONBOARDING_CARDS.length - 1 && (
          <TouchableOpacity
            className="min-h-[48px] min-w-[48px] items-center justify-center"
            style={{paddingHorizontal: horizontalPadding}}
            onPress={finishOnboarding}
            activeOpacity={0.7}>
            <Text style={{color: COLORS.DISABLED_GREY}}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-1 justify-center">
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={event => {
            const nextIndex = Math.round(
              event.nativeEvent.contentOffset.x / width,
            );
            setActiveIndex(nextIndex);
          }}>
          {ONBOARDING_CARDS.map(card => (
            <View
              key={card.title}
              style={{width, paddingHorizontal: horizontalPadding}}
              className="justify-center">
              <Card className="rounded-[24px] px-6 py-8">
                <View className="h-24 w-24 items-center justify-center self-center rounded-full" style={{backgroundColor: 'rgba(47,133,90,0.12)'}}>
                  <MaterialCommunityIcons
                    color={COLORS.FOREST_GREEN}
                    name={card.accentIcon}
                    size={46}
                  />
                </View>

                <Text className="mt-8 text-center text-3xl font-bold" style={{color: COLORS.DARK_SLATE}}>
                  {card.title}
                </Text>
                <Text className="mt-4 text-center text-base leading-7" style={{color: COLORS.DISABLED_GREY}}>
                  {card.body}
                </Text>
              </Card>
            </View>
          ))}
        </ScrollView>

        <View className="mt-8 flex-row justify-center gap-2">
          {ONBOARDING_CARDS.map((_, index) => (
            <View
              key={index}
              className="h-2.5 rounded-full"
              style={{
                width: index === activeIndex ? 28 : 10,
                backgroundColor:
                  index === activeIndex ? COLORS.FOREST_GREEN : COLORS.DISABLED_GREY,
              }}
            />
          ))}
        </View>
      </View>

      <Button
        label={activeIndex === ONBOARDING_CARDS.length - 1 ? 'Get Started' : 'Next'}
        onPress={() => {
          if (activeIndex === ONBOARDING_CARDS.length - 1) {
            finishOnboarding();
            return;
          }

          scrollToIndex(activeIndex + 1);
        }}
      />
    </View>
  );
};

export default OnboardingScreen;
