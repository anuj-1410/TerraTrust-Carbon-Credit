import type {NavigatorScreenParams} from '@react-navigation/native';

import type {TreeSample} from '../features/ar-audit/store/auditSlice';

export type CreditHistoryParams = {
  source?: 'home' | 'history';
};

export type HomeStackParamList = {
  DashboardHomeScreen: undefined;
  CreditHistoryScreen: CreditHistoryParams | undefined;
  LandDetailScreen: {landId: string; originTab?: MainAppOriginTab};
  EditLandNameScreen: {landId: string};
};

export type LandStackParamList = {
  LandListScreen: undefined;
  LandDetailScreen: {landId: string; originTab?: MainAppOriginTab};
  EditLandNameScreen: {landId: string};
};

export type HistoryStackParamList = {
  CreditHistoryScreen: CreditHistoryParams | undefined;
};

export type ProfileStackParamList = {
  ProfileScreen: undefined;
  SettingsScreen: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  LandTab: NavigatorScreenParams<LandStackParamList> | undefined;
  HistoryTab: NavigatorScreenParams<HistoryStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type MainAppOriginTab = Extract<keyof MainTabParamList, 'HomeTab' | 'LandTab'>;

export type RootStackParamList = {
  SplashScreen: undefined;
  LoginScreen: undefined;
  OTPScreen: {phone: string};
  KYCScreen: undefined;
  OnboardingScreen: undefined;

  HomeScreen: NavigatorScreenParams<MainTabParamList> | undefined;

  DashboardHomeScreen: undefined;
  LandListScreen: undefined;
  CreditHistoryScreen: CreditHistoryParams | undefined;
  LandDetailScreen: {landId: string; originTab?: MainAppOriginTab};
  EditLandNameScreen: {landId: string};
  ProfileScreen: undefined;
  SettingsScreen: undefined;
  WalletRecoveryScreen: undefined;

  DocumentUploadScreen: undefined;
  BoundaryConfirmScreen: undefined;
  ManualUploadGuideScreen: undefined;
  LandRegistrationSuccessScreen: {landId: string};

  AuditStartScreen: {
    landId: string;
    landName: string;
    originTab?: MainAppOriginTab;
  };
  ZoneNavigationScreen: {
    auditId: string;
    landId: string;
    originTab?: MainAppOriginTab;
  };
  ARCameraScreen: {
    zoneId: string;
    zoneIndex: number;
    returnDiameter?: number;
  };
  ManualMeasureScreen: {
    zoneId: string;
    zoneIndex: number;
  };
  TreeResultScreen: {pendingTree: TreeSample};
  AuditCompleteScreen: undefined;
  AuditStatusScreen: {auditId: string};

  NotificationsScreen: undefined;
  MaintenanceScreen: {message?: string} | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
