import {PermissionsAndroid, Platform, type Permission} from 'react-native';

async function requestAndroidPermission(
  permission: Permission,
  title: string,
  message: string,
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.request(permission, {
    title,
    message,
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function ensureLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  return [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ].every(permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

export async function ensureCameraPermission(): Promise<boolean> {
  return requestAndroidPermission(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    'Camera Permission Required',
    'TerraTrust needs camera access to capture land documents and scan trees.',
  );
}