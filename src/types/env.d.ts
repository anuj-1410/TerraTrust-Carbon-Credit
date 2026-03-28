declare module 'react-native-config' {
  interface NativeConfig {
    API_BASE_URL: string;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    GOOGLE_MAPS_API_KEY: string;
    ALCHEMY_POLYGON_AMOY_URL: string;
    CONTRACT_ADDRESS: string;
  }

  const Config: NativeConfig;
  export default Config;
}
