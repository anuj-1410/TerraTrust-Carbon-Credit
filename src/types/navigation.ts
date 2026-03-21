export type RootStackParamList = {
  // Auth
  SplashScreen: undefined;
  LoginScreen: undefined;
  OTPScreen: {phone: string};
  KYCScreen: undefined;
  // Land
  LandListScreen: undefined;
  DocumentUploadScreen: undefined;
  BoundaryConfirmScreen: undefined;
  ManualUploadGuideScreen: undefined;
  // AR Audit
  AuditStartScreen: {landId: string};
  ZoneNavigationScreen: {auditId: string; landId: string};
  ARCameraScreen: {zoneId: string; auditId: string};
  ManualMeasureScreen: {zoneId: string; auditId: string};
  TreeResultScreen: {treeId: string};
  AuditCompleteScreen: {auditId: string};
  // Dashboard
  HomeScreen: undefined;
  CreditHistoryScreen: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
