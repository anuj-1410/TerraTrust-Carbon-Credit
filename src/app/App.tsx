import React, {useEffect, useRef} from 'react';
import {
  BackHandler,
  Platform,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {
  NavigationContainer,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import BackgroundFetch from 'react-native-background-fetch';
import NetInfo from '@react-native-community/netinfo';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {store, persistor, type RootState} from '../store';
import type {
  HistoryStackParamList,
  HomeStackParamList,
  LandStackParamList,
  MainTabParamList,
  ProfileStackParamList,
  RootStackParamList,
} from '../types/navigation';
import {navigationRef} from '../services/navigationRef';
import {useAppSelector, useAppDispatch} from '../store/hooks';
import {hideBanner, setMaintenance, showBanner} from '../store/uiSlice';
import Loader from '../common/components/Loader';
import api, {retryPendingAuditUpload} from '../services/api';
import {COLORS} from '../common/constants/colors';
import {setPendingMint} from '../features/dashboard/store/creditsSlice';
import {
  setAuditResult,
  setUploadStatus,
} from '../features/ar-audit/store/auditSlice';
import {syncAuditStatus} from '../features/ar-audit/utils/auditStatus';
import {isOnboardingComplete} from '../common/utils/onboarding';
import {setOnboardingComplete} from '../features/profile/store/profileSlice';

// Auth screens
import SplashScreen from '../features/auth/screens/SplashScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
import OTPScreen from '../features/auth/screens/OTPScreen';
import KYCScreen from '../features/auth/screens/KYCScreen';
import OnboardingScreen from '../features/auth/screens/OnboardingScreen';

// Land screens
import LandListScreen from '../features/land/screens/LandListScreen';
import LandDetailScreen from '../features/land/screens/LandDetailScreen';
import EditLandNameScreen from '../features/land/screens/EditLandNameScreen';
import DocumentUploadScreen from '../features/land/screens/DocumentUploadScreen';
import BoundaryConfirmScreen from '../features/land/screens/BoundaryConfirmScreen';
import ManualUploadGuideScreen from '../features/land/screens/ManualUploadGuideScreen';
import LandRegistrationSuccessScreen from '../features/land/screens/LandRegistrationSuccessScreen';

// AR-audit screens
import AuditStartScreen from '../features/ar-audit/screens/AuditStartScreen';
import ZoneNavigationScreen from '../features/ar-audit/screens/ZoneNavigationScreen';
import ARCameraScreen from '../features/ar-audit/screens/ARCameraScreen';
import ManualMeasureScreen from '../features/ar-audit/screens/ManualMeasureScreen';
import TreeResultScreen from '../features/ar-audit/screens/TreeResultScreen';
import AuditCompleteScreen from '../features/ar-audit/screens/AuditCompleteScreen';
import AuditStatusScreen from '../features/ar-audit/screens/AuditStatusScreen';

// Dashboard screens
import HomeScreen from '../features/dashboard/screens/HomeScreen';
import CreditHistoryScreen from '../features/dashboard/screens/CreditHistoryScreen';

// Profile and utility screens
import ProfileScreen from '../features/profile/screens/ProfileScreen';
import SettingsScreen from '../features/profile/screens/SettingsScreen';
import WalletRecoveryScreen from '../features/profile/screens/WalletRecoveryScreen';
import NotificationsScreen from '../features/notifications/screens/NotificationsScreen';
import MaintenanceScreen from '../common/screens/MaintenanceScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const LandStack = createNativeStackNavigator<LandStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

type NavigationBranch = {
  index: number;
  routes: Array<{
    name: string;
    state?: NavigationBranch;
  }>;
};

function getNavigationBranch(value: unknown): NavigationBranch | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const branch = value as {
    index?: unknown;
    routes?: unknown;
  };

  if (typeof branch.index !== 'number' || !Array.isArray(branch.routes)) {
    return null;
  }

  return branch as NavigationBranch;
}

function isAtMainTabRoot(): boolean {
  const rootState = getNavigationBranch(navigationRef.getRootState());
  if (!rootState) {
    return false;
  }

  const rootRoute = rootState.routes[rootState.index];
  if (!rootRoute || rootRoute.name !== 'HomeScreen') {
    return false;
  }

  const tabState = getNavigationBranch(rootRoute.state);
  if (!tabState) {
    return true;
  }

  const activeTab = tabState.routes[tabState.index];
  if (!activeTab) {
    return false;
  }

  const nestedStackState = getNavigationBranch(activeTab.state);
  return !nestedStackState || nestedStackState.index === 0;
}

function shouldSyncActiveAudit(
  auditState: RootState['audit'],
  retriedUpload = false,
): boolean {
  if (!auditState.activeAuditId) {
    return false;
  }

  if (retriedUpload || auditState.uploadStatus === 'processing') {
    return true;
  }

  return (
    auditState.auditResult?.status === 'PROCESSING' ||
    auditState.auditResult?.status === 'CALCULATING' ||
    auditState.auditResult?.status === 'READY_TO_MINT'
  );
}

function primeAuditProcessingState(dispatch: typeof store.dispatch) {
  dispatch(setUploadStatus('processing'));
  dispatch(setPendingMint(true));
  dispatch(setAuditResult({status: 'PROCESSING'}));
}

function TabIcon({
  name,
  color,
  size,
  showDot = false,
}: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  size: number;
  showDot?: boolean;
}) {
  return (
    <View>
      <MaterialCommunityIcons color={color} name={name} size={size} />
      {showDot ? (
        <View
          className="absolute -right-1 top-0 h-2.5 w-2.5 rounded-full"
          style={{backgroundColor: COLORS.ERROR_RED}}
        />
      ) : null}
    </View>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{headerShown: false}}>
      <HomeStack.Screen name="DashboardHomeScreen" component={HomeScreen} />
      <HomeStack.Screen
        name="CreditHistoryScreen"
        component={CreditHistoryScreen}
      />
      <HomeStack.Screen name="LandDetailScreen" component={LandDetailScreen} />
      <HomeStack.Screen
        name="EditLandNameScreen"
        component={EditLandNameScreen}
      />
    </HomeStack.Navigator>
  );
}

function LandStackNavigator() {
  return (
    <LandStack.Navigator screenOptions={{headerShown: false}}>
      <LandStack.Screen name="LandListScreen" component={LandListScreen} />
      <LandStack.Screen name="LandDetailScreen" component={LandDetailScreen} />
      <LandStack.Screen
        name="EditLandNameScreen"
        component={EditLandNameScreen}
      />
    </LandStack.Navigator>
  );
}

function HistoryStackNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={{headerShown: false}}>
      <HistoryStack.Screen
        name="CreditHistoryScreen"
        component={CreditHistoryScreen}
        initialParams={{source: 'history'}}
      />
    </HistoryStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{headerShown: false}}>
      <ProfileStack.Screen name="ProfileScreen" component={ProfileScreen} />
      <ProfileStack.Screen name="SettingsScreen" component={SettingsScreen} />
      <ProfileStack.Screen
        name="WalletRecoveryScreen"
        component={WalletRecoveryScreen}
      />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const unreadNotifications = useAppSelector(state => state.notifications.unreadCount);
  const walletRecoveryPending = useAppSelector(
    state => state.profile.walletRecoveryPending,
  );
  const baseTabBarStyle = {
    backgroundColor: COLORS.CARD_WHITE,
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    height: 56 + insets.bottom,
    paddingBottom: Math.max(insets.bottom, 8),
    paddingTop: 6,
  };

  return (
    <Tab.Navigator
      id="MainTabs"
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.FOREST_GREEN,
        tabBarInactiveTintColor: COLORS.DISABLED_GREY,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Roboto-Regular',
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarStyle: baseTabBarStyle,
      }}>
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({color, size}) => (
            <TabIcon
              color={color}
              name="home-outline"
              showDot={unreadNotifications > 0}
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="LandTab"
        component={LandStackNavigator}
        options={{
          title: 'My Lands',
          tabBarIcon: ({color, size}) => (
            <TabIcon color={color} name="sprout-outline" size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{
          title: 'History',
          tabBarIcon: ({color, size}) => (
            <TabIcon color={color} name="chart-timeline-variant" size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={({route}) => {
          const focusedRoute =
            getFocusedRouteNameFromRoute(route) ?? 'ProfileScreen';
          const shouldHideTabBar = focusedRoute === 'WalletRecoveryScreen';

          return {
            title: 'Profile',
            tabBarStyle: shouldHideTabBar
              ? {...baseTabBarStyle, display: 'none'}
              : baseTabBarStyle,
            tabBarIcon: ({color, size}) => (
              <TabIcon
                color={color}
                name="account-outline"
                showDot={walletRecoveryPending}
                size={size}
              />
            ),
          };
        }}
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
      try {
        const retriedUpload = await retryPendingAuditUpload();

        if (retriedUpload) {
          primeAuditProcessingState(store.dispatch);
        }

        const auditState = store.getState().audit;

        if (shouldSyncActiveAudit(auditState, retriedUpload)) {
          await syncAuditStatus({
            auditId: auditState.activeAuditId as string,
            dispatch: store.dispatch,
            getState: store.getState,
          });
        }
      } finally {
        BackgroundFetch.finish(taskId);
      }
    },
    async taskId => {
      BackgroundFetch.finish(taskId);
    },
  );
}

function AppLifecycleEffects() {
  const dispatch = useAppDispatch();
  const bannerType = useAppSelector(state => state.ui.bannerType);
  const maintenanceMode = useAppSelector(state => state.ui.maintenanceMode);
  const maintenanceMessage = useAppSelector(
    state => state.ui.maintenanceMessage,
  );
  const activeAuditId = useAppSelector(state => state.audit.activeAuditId);
  const auditUploadStatus = useAppSelector(state => state.audit.uploadStatus);
  const auditResultStatus = useAppSelector(
    state => state.audit.auditResult?.status ?? null,
  );
  const onboardingComplete = useAppSelector(
    state => state.profile.onboardingComplete,
  );
  const wasOfflineRef = useRef(false);
  const lastBackPressRef = useRef(0);

  useEffect(() => {
    const persistedOnboardingComplete = isOnboardingComplete();
    if (persistedOnboardingComplete !== onboardingComplete) {
      dispatch(setOnboardingComplete(persistedOnboardingComplete));
    }
  }, [dispatch, onboardingComplete]);

  useEffect(() => {
    let isMounted = true;

    const bootstrapApp = async () => {
      await configureBackgroundFetch();

      try {
        const networkState = await NetInfo.fetch();
        const isOnline =
          networkState.isConnected !== false &&
          networkState.isInternetReachable !== false;

        if (isOnline) {
          const retriedUpload = await retryPendingAuditUpload();

          if (retriedUpload) {
            primeAuditProcessingState(dispatch);
          }

          const auditState = store.getState().audit;
          if (shouldSyncActiveAudit(auditState, retriedUpload)) {
            await syncAuditStatus({
              auditId: auditState.activeAuditId as string,
              dispatch,
              getState: store.getState,
            });
          }
        }
      } catch {
        // Ignore bootstrap retry failures.
      }

      try {
        const response = await api.get('/api/v1/status');
        if (isMounted && response.data?.maintenance === true) {
          dispatch(
            setMaintenance({
              message: response.data?.message,
            }),
          );
        }
      } catch {
        // Ignore bootstrap status failures.
      }
    };

    void bootstrapApp();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isOffline =
        state.isConnected === false || state.isInternetReachable === false;

      if (isOffline) {
        wasOfflineRef.current = true;
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

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        void (async () => {
          const retriedUpload = await retryPendingAuditUpload();

          if (retriedUpload) {
            primeAuditProcessingState(dispatch);
          }

          const auditState = store.getState().audit;
          if (shouldSyncActiveAudit(auditState, retriedUpload)) {
            await syncAuditStatus({
              auditId: auditState.activeAuditId as string,
              dispatch,
              getState: store.getState,
            });
          }
        })();
      }

      void api.get('/api/v1/status').catch(() => undefined);
    });

    return unsubscribe;
  }, [activeAuditId, auditUploadStatus, bannerType, dispatch]);

  useEffect(() => {
    if (
      !activeAuditId ||
      !shouldSyncActiveAudit(
        {
          ...store.getState().audit,
          activeAuditId,
          uploadStatus: auditUploadStatus,
          auditResult:
            auditResultStatus === null ? null : {status: auditResultStatus},
        },
      )
    ) {
      return;
    }

    if (auditUploadStatus !== 'processing') {
      primeAuditProcessingState(dispatch);
    }

    const pollAuditInShell = async () => {
      if (navigationRef.getCurrentRoute()?.name === 'AuditStatusScreen') {
        return;
      }

      try {
        await syncAuditStatus({
          auditId: activeAuditId,
          dispatch,
          getState: store.getState,
        });
      } catch {
        // Ignore transient polling failures in the app shell.
      }
    };

    void pollAuditInShell();

    const intervalId = setInterval(() => {
      void pollAuditInShell();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeAuditId, auditResultStatus, auditUploadStatus, dispatch]);

  useEffect(() => {
    if (!maintenanceMode || !navigationRef.isReady()) {
      return;
    }

    if (navigationRef.getCurrentRoute()?.name === 'MaintenanceScreen') {
      return;
    }

    navigationRef.navigate(
      'MaintenanceScreen',
      maintenanceMessage ? {message: maintenanceMessage} : undefined,
    );
  }, [maintenanceMessage, maintenanceMode]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!navigationRef.isReady() || !isAtMainTabRoot()) {
          return false;
        }

        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          BackHandler.exitApp();
          return true;
        }

        lastBackPressRef.current = now;
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        return true;
      },
    );

    return () => subscription.remove();
  }, []);

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
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            const uiState = store.getState().ui;
            if (uiState.maintenanceMode && navigationRef.isReady()) {
              navigationRef.navigate(
                'MaintenanceScreen',
                uiState.maintenanceMessage
                  ? {message: uiState.maintenanceMessage}
                  : undefined,
              );
            }
          }}>
          <GlobalBanner />
          <RootStack.Navigator
            initialRouteName="SplashScreen"
            screenOptions={{headerShown: false}}>
            {/* Auth */}
            <RootStack.Screen name="SplashScreen" component={SplashScreen} />
            <RootStack.Screen name="LoginScreen" component={LoginScreen} />
            <RootStack.Screen name="OTPScreen" component={OTPScreen} />
            <RootStack.Screen
              name="KYCScreen"
              component={KYCScreen}
              options={{gestureEnabled: false}}
            />
            <RootStack.Screen
              name="OnboardingScreen"
              component={OnboardingScreen}
              options={{gestureEnabled: false}}
            />

            {/* Main app */}
            <RootStack.Screen
              name="HomeScreen"
              component={MainTabs}
              options={{gestureEnabled: false}}
            />

            {/* Land flows */}
            <RootStack.Screen
              name="DocumentUploadScreen"
              component={DocumentUploadScreen}
              options={{presentation: 'fullScreenModal'}}
            />
            <RootStack.Screen
              name="BoundaryConfirmScreen"
              component={BoundaryConfirmScreen}
              options={{presentation: 'fullScreenModal'}}
            />
            <RootStack.Screen
              name="ManualUploadGuideScreen"
              component={ManualUploadGuideScreen}
              options={{presentation: 'fullScreenModal'}}
            />
            <RootStack.Screen
              name="LandRegistrationSuccessScreen"
              component={LandRegistrationSuccessScreen}
              options={{gestureEnabled: false, presentation: 'fullScreenModal'}}
            />

            {/* AR-Audit */}
            <RootStack.Screen
              name="AuditStartScreen"
              component={AuditStartScreen}
              options={{presentation: 'fullScreenModal'}}
            />
            <RootStack.Screen
              name="ZoneNavigationScreen"
              component={ZoneNavigationScreen}
              options={{presentation: 'fullScreenModal'}}
            />
            <RootStack.Screen
              name="ARCameraScreen"
              component={ARCameraScreen}
              options={{presentation: 'fullScreenModal'}}
            />
            <RootStack.Screen
              name="ManualMeasureScreen"
              component={ManualMeasureScreen}
              options={{presentation: 'fullScreenModal'}}
            />
            <RootStack.Screen
              name="TreeResultScreen"
              component={TreeResultScreen}
              options={{presentation: 'fullScreenModal'}}
            />
            <RootStack.Screen
              name="AuditCompleteScreen"
              component={AuditCompleteScreen}
              options={{gestureEnabled: false, presentation: 'fullScreenModal'}}
            />
            <RootStack.Screen
              name="AuditStatusScreen"
              component={AuditStatusScreen}
              options={{gestureEnabled: false, presentation: 'fullScreenModal'}}
            />

            {/* Utility */}
            <RootStack.Screen
              name="NotificationsScreen"
              component={NotificationsScreen}
              options={{presentation: 'fullScreenModal'}}
            />
            <RootStack.Screen
              name="MaintenanceScreen"
              component={MaintenanceScreen}
              options={{gestureEnabled: false, presentation: 'fullScreenModal'}}
            />
          </RootStack.Navigator>
        </NavigationContainer>
      </PersistGate>
    </Provider>
  );
};

export default App;
