module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|react-redux|@reduxjs/toolkit|immer|reselect|nativewind|react-native-css-interop|lottie-react-native|react-native-keychain|react-native-config|react-native-mmkv|@supabase|react-hook-form|@hookform/resolvers)/)',
  ],
  moduleNameMapper: {
    '^@reduxjs/toolkit$':
      '<rootDir>/node_modules/@reduxjs/toolkit/dist/cjs/index.js',
    '^@react-native-vector-icons/material-design-icons$':
      '<rootDir>/test/mocks/MaterialCommunityIcons.js',
  },
};
