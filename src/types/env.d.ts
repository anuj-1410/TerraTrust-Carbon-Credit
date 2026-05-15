declare module 'react-native-config' {
  interface NativeConfig {
    API_BASE_URL: string;
    GOOGLE_MAPS_API_KEY: string;
    ALCHEMY_POLYGON_AMOY_URL: string;
    CONTRACT_ADDRESS: string;
    AUDIT_DEMO_MODE?: string;
    AUDIT_SKIP_SPECIES_DETECTION?: string;
    FIREBASE_AUTH_FORCE_RECAPTCHA?: string;
    FIREBASE_TEST_PHONE_NUMBER?: string;
    FIREBASE_TEST_OTP_CODE?: string;
  }

  const Config: NativeConfig;
  export default Config;
}
