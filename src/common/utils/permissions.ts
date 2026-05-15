import {PermissionsAndroid, Platform, type Permission} from 'react-native';

export type PermissionStatus = 'granted' | 'denied' | 'blocked';

export interface PermissionRequestResult {
  status: PermissionStatus;
  granted: boolean;
  blocked: boolean;
}

function buildPermissionResult(
  status: PermissionStatus,
): PermissionRequestResult {
  return {
    status,
    granted: status === 'granted',
    blocked: status === 'blocked',
  };
}

function mapAndroidPermissionResult(
  result: string,
): PermissionRequestResult {
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return buildPermissionResult('granted');
  }

  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return buildPermissionResult('blocked');
  }

  return buildPermissionResult('denied');
}

async function requestAndroidPermission(
  permission: Permission,
  title: string,
  message: string,
): Promise<PermissionRequestResult> {
  if (Platform.OS !== 'android') {
    return buildPermissionResult('granted');
  }

  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) {
    return buildPermissionResult('granted');
  }

  const result = await PermissionsAndroid.request(permission, {
    title,
    message,
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });

  return mapAndroidPermissionResult(result);
}

async function hasAndroidPermission(permission: Permission): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  return PermissionsAndroid.check(permission);
}

export async function ensureLocationPermission(): Promise<PermissionRequestResult> {
  if (Platform.OS !== 'android') {
    return buildPermissionResult('granted');
  }

  const permissions = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ] as const;

  const permissionChecks = await Promise.all(
    permissions.map(permission => PermissionsAndroid.check(permission)),
  );
  if (permissionChecks.every(Boolean)) {
    return buildPermissionResult('granted');
  }

  const result = await PermissionsAndroid.requestMultiple([...permissions]);

  const statuses = permissions.map(permission =>
    mapAndroidPermissionResult(result[permission]),
  );
  if (statuses.every(status => status.granted)) {
    return buildPermissionResult('granted');
  }

  if (statuses.some(status => status.blocked)) {
    return buildPermissionResult('blocked');
  }

  return buildPermissionResult('denied');
}

export async function ensureCameraPermission(): Promise<PermissionRequestResult> {
  return requestAndroidPermission(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    'Camera Permission Required',
    'TerraTrust needs camera access to capture land documents and scan trees.',
  );
}

export async function hasCameraPermission(): Promise<boolean> {
  return hasAndroidPermission(PermissionsAndroid.PERMISSIONS.CAMERA);
}
