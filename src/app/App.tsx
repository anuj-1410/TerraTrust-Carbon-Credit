import { useReducedMotion } from '../common/hooks/useReducedMotion';
import ThemeProvider from '../common/theme/ThemeProvider';
import {useTheme} from '../common/theme/theme';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  AppState,
  type AppStateStatus,
  BackHandler,
  Platform,
  Text,
  View,
  ToastAndroid,
  TouchableOpacity,
} from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BackgroundFetch from 'react-native-background-fetch';
import NetInfo from '@react-native-community/netinfo';
import FloatingTabBar from './FloatingTabBar';
import AppErrorBoundary from './AppErrorBoundary';
import {afterFirstPaint} from '../common/utils/afterFirstPaint';
import {
  FloatingTabInsetContext,
  FLOATING_TAB_CONTENT_INSET,
} from './FloatingTabInsetContext';

import { store, persistor, type RootState } from '../store';
import type {
  HistoryStackParamList,
  HomeStackParamList,
  LandStackParamList,
  MainTabParamList,
  ProfileStackParamList,
  RootStackParamList,
} from '../types/navigation';
import { navigationRef } from '../services/navigationRef';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { hideBanner, setMaintenance, showBanner } from '../store/uiSlice';
import Loader from '../common/components/Loader';
import api, { retryPendingAuditUpload } from '../services/api';
import { setPendingMint } from '../features/dashboard/store/creditsSlice';
import {
  detectAndSetARTier,
  setAuditResult,
  setUploadStatus,
} from '../features/ar-audit/store/auditSlice';
import { syncAuditStatus } from '../features/ar-audit/utils/auditStatus';
import { isOnboardingComplete } from '../common/utils/onboarding';
import { setOnboardingComplete } from '../features/profile/store/profileSlice';
import {
  setAuthenticatedProfile,
  setWalletAddress,
  setWalletSetup,
  retryWalletSetup,
} from '../features/auth/store/authSlice';
import {
  bootstrapAuthenticatedProfile,
  completeAuthenticatedWallet,
} from '../services/authBootstrap';
import {
  getCurrentFirebaseUser,
  type AuthBootstrapResponse,
} from '../services/firebase';

// Auth screens
import SplashScreen from '../features/auth/screens/SplashScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
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
import {fetchLandPage} from '../features/land/store/landSlice';

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
  dispatch(setAuditResult({ status: 'PROCESSING' }));
}

function HomeStackNavigator() {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: reducedMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: colors.OFF_WHITE },
      }}
    >
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
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <LandStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: reducedMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: colors.OFF_WHITE },
      }}
    >
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
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <HistoryStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: reducedMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: colors.OFF_WHITE },
      }}
    >
      <HistoryStack.Screen
        name="CreditHistoryScreen"
        component={CreditHistoryScreen}
        initialParams={{ source: 'history' }}
      />
    </HistoryStack.Navigator>
  );
}

function ProfileStackNavigator() {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: reducedMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: colors.OFF_WHITE },
      }}
    >
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
  const unreadNotifications = useAppSelector(
    state => state.notifications.unreadCount,
  );
  const walletRecoveryPending = useAppSelector(
    state => state.profile.walletRecoveryPending,
  );
  return (
    <FloatingTabInsetContext.Provider value={FLOATING_TAB_CONTENT_INSET}>
      <Tab.Navigator
        id="MainTabs"
        initialRouteName="HomeTab"
        tabBar={props => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStackNavigator}
          options={{
            title: 'Home',
            tabBarBadge: unreadNotifications > 0 ? 1 : undefined,
          }}
        />
        <Tab.Screen
          name="LandTab"
          component={LandStackNavigator}
          options={{
            title: 'My Lands',
          }}
        />
        <Tab.Screen
          name="HistoryTab"
          component={HistoryStackNavigator}
          options={{
            title: 'History',
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileStackNavigator}
          options={{
            title: 'Profile',
            tabBarBadge: walletRecoveryPending ? 1 : undefined,
          }}
        />
      </Tab.Navigator>
    </FloatingTabInsetContext.Provider>
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
  const maintenanceMode = useAppSelector(state => state.ui.maintenanceMode);
  const maintenanceMessage = useAppSelector(
    state => state.ui.maintenanceMessage,
  );
  const activeAuditId = useAppSelector(state => state.audit.activeAuditId);
  const auditUploadStatus = useAppSelector(state => state.audit.uploadStatus);
  const auditResultStatus = useAppSelector(
    state => state.audit.auditResult?.status ?? null,
  );
  const isAuthenticated = useAppSelector(
    state => state.auth.isAuthenticated && state.auth.sessionReady,
  );
  const sessionUid = useAppSelector(state =>
    state.auth.sessionReady ? state.auth.user?.firebaseUid : null,
  );
  const onboardingComplete = useAppSelector(
    state => state.profile.onboardingComplete,
  );
  const walletSetupAttempt = useAppSelector(
    state => state.auth.walletSetupAttempt,
  );
  const wasOfflineRef = useRef(false);
  const lastBackPressRef = useRef(0);
  const backgroundFetchConfiguredRef = useRef(false);
  const auditPollInFlightRef = useRef(false);
  const arTierRefreshInFlightRef = useRef<Promise<unknown> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshARTier = useCallback(async () => {
    if (arTierRefreshInFlightRef.current) {
      await arTierRefreshInFlightRef.current;
      return;
    }

    const pendingRefresh = dispatch(detectAndSetARTier())
      .unwrap()
      .catch(() => undefined)
      .finally(() => {
        if (arTierRefreshInFlightRef.current === pendingRefresh) {
          arTierRefreshInFlightRef.current = null;
        }
      });

    arTierRefreshInFlightRef.current = pendingRefresh;
    await pendingRefresh;
  }, [dispatch]);

  const refreshLandState = useCallback(async () => {
    if (!isAuthenticated || !sessionUid) {
      return;
    }

    await dispatch(fetchLandPage(1)).unwrap().catch(() => undefined);
  }, [dispatch, isAuthenticated, sessionUid]);

  useEffect(() => {
    const persistedOnboardingComplete = isOnboardingComplete();
    if (persistedOnboardingComplete !== onboardingComplete) {
      dispatch(setOnboardingComplete(persistedOnboardingComplete));
    }
  }, [dispatch, onboardingComplete]);

  useEffect(() => {
    if (!isAuthenticated) { return; }
    return afterFirstPaint(() => { void refreshARTier(); });
  }, [isAuthenticated, refreshARTier]);

  useEffect(() => {
    if (!sessionUid) {
      return;
    }
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const ownsSession = () =>
      active &&
      getCurrentFirebaseUser()?.uid === sessionUid &&
      store.getState().auth.user?.firebaseUid === sessionUid;
    const refreshProfile = async () => {
      if (!ownsSession()) {
        return;
      }
      attempts++;
      dispatch(setWalletSetup({ status: 'pending' }));
      try {
        const snapshot = store.getState();
        const fetched = snapshot.auth.profileFresh
          ? null
          : await bootstrapAuthenticatedProfile();
        if (!ownsSession()) {
          return;
        }
        const current = store.getState();
        const cachedProfile: AuthBootstrapResponse = {
          user_id: current.auth.user!.id,
          firebase_uid: sessionUid,
          phone_number: current.auth.user!.phone,
          full_name: current.auth.user!.name,
          kyc_completed: current.auth.kycCompleted,
          wallet_address: current.auth.walletAddress,
          wallet_recovery_status: current.profile.walletRecoveryStatus,
          wallet_recovery_requested_at: current.profile.walletRecoveryRequestedAt,
        };
        const profile =
          fetched && !current.auth.profileFresh ? fetched.profile : cachedProfile;
        if (fetched && !current.auth.profileFresh) {
          dispatch(setAuthenticatedProfile(profile));
        }
        const completed = await completeAuthenticatedWallet(profile);
        if (!ownsSession()) {
          return;
        }
        if (completed.warning) {
          dispatch(
            setWalletSetup({
              status: 'error',
              message: completed.warning.message,
            }),
          );
          if (attempts < 3) {
            retryTimer = setTimeout(
              () => {
                void refreshProfile();
              },
              attempts === 1 ? 3000 : 10000,
            );
          }
        } else {
          dispatch(setWalletAddress(completed.profile.wallet_address));
          dispatch(setWalletSetup({ status: 'ready' }));
        }
      } catch {
        if (ownsSession()) {
          dispatch(
            setWalletSetup({
              status: 'error',
              message:
                'Wallet setup could not finish. Check your connection and retry from Profile.',
            }),
          );
        }
      }
    };
    const cancel = afterFirstPaint(() => {
      void refreshProfile();
    });
    return () => {
      active = false;
      cancel();
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [dispatch, sessionUid, walletSetupAttempt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const wasInactive = appStateRef.current !== 'active';
      appStateRef.current = nextState;

      if (nextState === 'active' && wasInactive) {
        if (store.getState().auth.walletSetupStatus === 'error') {
          dispatch(retryWalletSetup());
        }
        if (isAuthenticated) { void refreshARTier(); }
        void refreshLandState();
      }
    });

    return () => subscription.remove();
  }, [dispatch, isAuthenticated, refreshARTier, refreshLandState]);

  useEffect(() => {
    let isMounted = true;

    const bootstrapApp = async () => {
      if (!backgroundFetchConfiguredRef.current && isAuthenticated) {
        backgroundFetchConfiguredRef.current = true;
        void configureBackgroundFetch().catch(() => { backgroundFetchConfiguredRef.current = false; });
      }

      if (!isAuthenticated) {
        return;
      }

      try {
        const networkState = await NetInfo.fetch();
        const isOnline =
          networkState.isConnected !== false &&
          networkState.isInternetReachable !== false;

        if (isOnline) {
          void refreshLandState();
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
  }, [dispatch, isAuthenticated, refreshLandState]);

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

      if (store.getState().ui.bannerType === 'offline') {
        dispatch(hideBanner());
      }

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        if (store.getState().auth.walletSetupStatus === 'error') {
          dispatch(retryWalletSetup());
        }
        if (store.getState().auth.sessionReady) {
          void refreshLandState();
          void api.get('/api/v1/status').catch(() => undefined);
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
          })().catch(() => undefined);
        }
      }
    });

    return unsubscribe;
  }, [dispatch, refreshLandState]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !activeAuditId ||
      !shouldSyncActiveAudit({
        ...store.getState().audit,
        activeAuditId,
        uploadStatus: auditUploadStatus,
        auditResult:
          auditResultStatus === null ? null : { status: auditResultStatus },
      })
    ) {
      return;
    }

    if (auditUploadStatus !== 'processing') {
      primeAuditProcessingState(dispatch);
    }

    const pollAuditInShell = async () => {
      if (auditPollInFlightRef.current) {
        return;
      }

      if (navigationRef.getCurrentRoute()?.name === 'AuditStatusScreen') {
        return;
      }

      auditPollInFlightRef.current = true;
      try {
        await syncAuditStatus({
          auditId: activeAuditId,
          dispatch,
          getState: store.getState,
        });
      } catch {
        // Ignore transient polling failures in the app shell.
      } finally {
        auditPollInFlightRef.current = false;
      }
    };

    void pollAuditInShell();

    const intervalId = setInterval(() => {
      void pollAuditInShell();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [
    activeAuditId,
    auditResultStatus,
    auditUploadStatus,
    dispatch,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (!maintenanceMode || !navigationRef.isReady()) {
      return;
    }

    if (navigationRef.getCurrentRoute()?.name === 'MaintenanceScreen') {
      return;
    }

    navigationRef.navigate(
      'MaintenanceScreen',
      maintenanceMessage ? { message: maintenanceMessage } : undefined,
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
  const {colors: COLORS} = useTheme();
  const bannerMessage = useAppSelector(state => state.ui.bannerMessage);
  const bannerType = useAppSelector(state => state.ui.bannerType);
  const dispatch = useAppDispatch();

  if (!bannerMessage) return null;

  const backgroundColor =
    bannerType === 'error' ? COLORS.BANNER_ERROR : bannerType === 'offline' ? COLORS.BANNER_WARNING : COLORS.BANNER_INFO;

  return (
    <TouchableOpacity
      className="px-4 py-3"
      style={{ backgroundColor }}
      onPress={() => dispatch(hideBanner())}
      activeOpacity={0.8}
    >
      <Text className="text-center text-sm font-medium text-white">
        {bannerMessage}
      </Text>
    </TouchableOpacity>
  );
}

const AppContent = () => {
  const reducedMotion = useReducedMotion();
  const { colors: COLORS, isDark } = useTheme();
  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: COLORS.FOREST_GREEN,
      background: COLORS.OFF_WHITE,
      card: COLORS.CARD_WHITE,
      text: COLORS.DARK_SLATE,
      border: COLORS.BORDER,
      notification: COLORS.ERROR_RED,
    },
  };
  return (
    <PersistGate loading={<Loader />} persistor={persistor}>
      <AppErrorBoundary>
        <AppLifecycleEffects />
        <NavigationContainer
          theme={navigationTheme}
          ref={navigationRef}
          onReady={() => {
            const uiState = store.getState().ui;
            if (uiState.maintenanceMode && navigationRef.isReady()) {
              navigationRef.navigate(
                'MaintenanceScreen',
                uiState.maintenanceMessage
                  ? { message: uiState.maintenanceMessage }
                  : undefined,
              );
            }
          }}
        >
          <View style={{ flex: 1, backgroundColor: COLORS.OFF_WHITE }}>
            <GlobalBanner />
            <RootStack.Navigator
              initialRouteName="SplashScreen"
              screenOptions={{
                headerShown: false,
                animation: reducedMotion ? 'none' : 'slide_from_right',
                contentStyle: { backgroundColor: COLORS.OFF_WHITE },
              }}
            >
              {/* Auth */}
              <RootStack.Screen name="SplashScreen" component={SplashScreen} />
              <RootStack.Screen name="LoginScreen" component={LoginScreen} />
              <RootStack.Screen
                name="KYCScreen"
                component={KYCScreen}
                options={{
                  gestureEnabled: false,
                  animation: reducedMotion ? 'none' : 'fade',
                }}
              />
              <RootStack.Screen
                name="OnboardingScreen"
                component={OnboardingScreen}
                options={{ gestureEnabled: false }}
              />

              {/* Main app */}
              <RootStack.Screen
                name="HomeScreen"
                component={MainTabs}
                options={{ gestureEnabled: false }}
              />

              {/* Land flows */}
              <RootStack.Screen
                name="DocumentUploadScreen"
                component={DocumentUploadScreen}
                options={{
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
              <RootStack.Screen
                name="BoundaryConfirmScreen"
                component={BoundaryConfirmScreen}
                options={{
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
              <RootStack.Screen
                name="ManualUploadGuideScreen"
                component={ManualUploadGuideScreen}
                options={{
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
              <RootStack.Screen
                name="LandRegistrationSuccessScreen"
                component={LandRegistrationSuccessScreen}
                options={{
                  gestureEnabled: false,
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />

              {/* AR-Audit */}
              <RootStack.Screen
                name="AuditStartScreen"
                component={AuditStartScreen}
                options={{
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
              <RootStack.Screen
                name="ZoneNavigationScreen"
                component={ZoneNavigationScreen}
                options={{
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
              <RootStack.Screen
                name="ARCameraScreen"
                component={ARCameraScreen}
                options={{
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
              <RootStack.Screen
                name="ManualMeasureScreen"
                component={ManualMeasureScreen}
                options={{
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
              <RootStack.Screen
                name="TreeResultScreen"
                component={TreeResultScreen}
                options={{
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
              <RootStack.Screen
                name="AuditCompleteScreen"
                component={AuditCompleteScreen}
                options={{
                  gestureEnabled: false,
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
              <RootStack.Screen
                name="AuditStatusScreen"
                component={AuditStatusScreen}
                options={{
                  gestureEnabled: false,
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />

              {/* Utility */}
              <RootStack.Screen
                name="NotificationsScreen"
                component={NotificationsScreen}
                options={{
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
              <RootStack.Screen
                name="MaintenanceScreen"
                component={MaintenanceScreen}
                options={{
                  gestureEnabled: false,
                  presentation: 'fullScreenModal',
                  animation: reducedMotion ? 'none' : 'slide_from_bottom',
                }}
              />
            </RootStack.Navigator>
          </View>
        </NavigationContainer>
      </AppErrorBoundary>
    </PersistGate>
  );
};

const App = () => (
  <Provider store={store}>
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  </Provider>
);

export default App;
