export type AuditStackParamList = {
  AuditStart: {landId: string; landName: string};
  ZoneNavigation: {auditId: string; landId: string};
  ARCamera: {zoneId: string; zoneIndex: number; returnDiameter?: number};
  ManualMeasure: {returnDiameter?: number};
  TreeResult: {pendingTree: import('../features/ar-audit/store/auditSlice').TreeSample};
  AuditComplete: undefined;
};

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
  AuditStartScreen: {landId: string; landName: string};
  ZoneNavigationScreen: {auditId: string; landId: string};
  ARCameraScreen: {zoneId: string; zoneIndex: number; returnDiameter?: number};
  ManualMeasureScreen: {returnDiameter?: number};
  TreeResultScreen: {pendingTree: import('../features/ar-audit/store/auditSlice').TreeSample};
  AuditCompleteScreen: undefined;
  // Dashboard
  HomeScreen: undefined;
  CreditHistoryScreen: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
