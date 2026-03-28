import React, {useEffect} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import BackgroundFetch from 'react-native-background-fetch';
import NetInfo from '@react-native-community/netinfo';

import {store, persistor} from '../store';
import type {RootStackParamList} from '../types/navigation';
import {navigationRef} from '../services/navigationRef';
import {useAppSelector, useAppDispatch} from '../store/hooks';
import {hideBanner, showBanner} from '../store/uiSlice';
import Loader from '../common/components/Loader';
import {retryPendingAuditUpload} from '../services/api';
import {COLORS} from '../common/constants/colors';

// Auth screens
import SplashScreen from '../features/auth/screens/SplashScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
import OTPScreen from '../features/auth/screens/OTPScreen';
import KYCScreen from '../features/auth/screens/KYCScreen';

// Land screens
import LandListScreen from '../features/land/screens/LandListScreen';
import DocumentUploadScreen from '../features/land/screens/DocumentUploadScreen';
import BoundaryConfirmScreen from '../features/land/screens/BoundaryConfirmScreen';
import ManualUploadGuideScreen from '../features/land/screens/ManualUploadGuideScreen';

// AR-audit screens
import AuditStartScreen from '../features/ar-audit/screens/AuditStartScreen';
import ZoneNavigationScreen from '../features/ar-audit/screens/ZoneNavigationScreen';
import ARCameraScreen from '../features/ar-audit/screens/ARCameraScreen';
import ManualMeasureScreen from '../features/ar-audit/screens/ManualMeasureScreen';
import TreeResultScreen from '../features/ar-audit/screens/TreeResultScreen';
import AuditCompleteScreen from '../features/ar-audit/screens/AuditCompleteScreen';

// Dashboard screens
import HomeScreen from '../features/dashboard/screens/HomeScreen';
import CreditHistoryScreen from '../features/dashboard/screens/CreditHistoryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.FOREST_GREEN,
        tabBarInactiveTintColor: COLORS.DISABLED_GREY,
        tabBarStyle: {
          backgroundColor: COLORS.CARD_WHITE,
          borderTopColor: COLORS.OFF_WHITE,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}>
      <Tab.Screen
        name="DashboardHomeTab"
        component={HomeScreen}
        options={{title: 'Home'}}
      />
      <Tab.Screen
        name="DashboardHistoryTab"
        component={CreditHistoryScreen}
        options={{title: 'Credit History'}}
      />
    </Tab.Navigator>
  );
}

async function configureBackgroundFetch() {
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async taskId => {
      await retryPendingAuditUpload();
      BackgroundFetch.finish(taskId);
    },
    async taskId => {
      BackgroundFetch.finish(taskId);
    },
  );
}

function AppLifecycleEffects() {
  const dispatch = useAppDispatch();
  const bannerType = useAppSelector(state => state.ui.bannerType);

  useEffect(() => {
    void configureBackgroundFetch();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isOffline =
        state.isConnected === false || state.isInternetReachable === false;

      if (isOffline) {
        dispatch(
          showBanner({
            message: 'No internet connection. Your data is saved locally.',
            type: 'offline',
          }),
        );
        return;
      }

      if (bannerType === 'offline') {
        dispatch(hideBanner());
      }
    });

    return unsubscribe;
  }, [bannerType, dispatch]);

  return null;
}

function GlobalBanner() {
  const bannerMessage = useAppSelector(state => state.ui.bannerMessage);
  const bannerType = useAppSelector(state => state.ui.bannerType);
  const dispatch = useAppDispatch();

  if (!bannerMessage) return null;

  const backgroundColor =
    bannerType === 'error'
      ? COLORS.ERROR_RED
      : bannerType === 'offline'
        ? COLORS.WARNING_ORANGE
        : COLORS.TEAL;

  return (
    <TouchableOpacity
      className="px-4 py-3"
      style={{backgroundColor}}
      onPress={() => dispatch(hideBanner())}
      activeOpacity={0.8}>
      <Text className="text-center text-sm font-medium text-white">
        {bannerMessage}
      </Text>
    </TouchableOpacity>
  );
}

const App = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={<Loader />} persistor={persistor}>
        <AppLifecycleEffects />
        <NavigationContainer ref={navigationRef}>
          <GlobalBanner />
          <Stack.Navigator
            initialRouteName="SplashScreen"
            screenOptions={{headerShown: false}}>
            {/* Auth */}
            <Stack.Screen name="SplashScreen" component={SplashScreen} />
            <Stack.Screen name="LoginScreen" component={LoginScreen} />
            <Stack.Screen name="OTPScreen" component={OTPScreen} />
            <Stack.Screen
              name="KYCScreen"
              component={KYCScreen}
              options={{gestureEnabled: false}}
            />

            {/* Land */}
            <Stack.Screen name="LandListScreen" component={LandListScreen} />
            <Stack.Screen
              name="DocumentUploadScreen"
              component={DocumentUploadScreen}
            />
            <Stack.Screen
              name="BoundaryConfirmScreen"
              component={BoundaryConfirmScreen}
            />
            <Stack.Screen
              name="ManualUploadGuideScreen"
              component={ManualUploadGuideScreen}
            />

            {/* AR-Audit */}
            <Stack.Screen
              name="AuditStartScreen"
              component={AuditStartScreen}
            />
            <Stack.Screen
              name="ZoneNavigationScreen"
              component={ZoneNavigationScreen}
            />
            <Stack.Screen name="ARCameraScreen" component={ARCameraScreen} />
            <Stack.Screen
              name="ManualMeasureScreen"
              component={ManualMeasureScreen}
            />
            <Stack.Screen
              name="TreeResultScreen"
              component={TreeResultScreen}
            />
            <Stack.Screen
              name="AuditCompleteScreen"
              component={AuditCompleteScreen}
            />

            {/* Dashboard */}
            <Stack.Screen
              name="HomeScreen"
              component={MainTabs}
              options={{gestureEnabled: false}}
            />
            <Stack.Screen
              name="CreditHistoryScreen"
              component={CreditHistoryScreen}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PersistGate>
    </Provider>
  );
};

export default App;
