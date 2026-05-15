import auth, {type FirebaseAuthTypes} from '@react-native-firebase/auth';
import {Platform} from 'react-native';
import Config from 'react-native-config';

let pendingPhoneConfirmation: FirebaseAuthTypes.ConfirmationResult | null =
  null;
let pendingPhoneVerificationId: string | null = null;

const ANDROID_RECAPTCHA_RECOVERABLE_CODES = new Set([
  'auth/invalid-app-credential',
  'auth/missing-client-identifier',
  'auth/app-not-authorized',
]);

export interface PendingPhoneOtpSession {
  phoneNumber: string;
  verificationId: string | null;
  usedRecaptchaFallback: boolean;
}

function clearPendingPhoneSession() {
  pendingPhoneConfirmation = null;
  pendingPhoneVerificationId = null;
}

function normalizePhoneKey(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

function shouldUseFirebaseTestPhone(phoneNumber: string): boolean {
  return (
    Platform.OS === 'android' &&
    Boolean(
      Config.FIREBASE_TEST_PHONE_NUMBER?.trim() &&
        Config.FIREBASE_TEST_OTP_CODE?.trim() &&
        normalizePhoneKey(Config.FIREBASE_TEST_PHONE_NUMBER) ===
          normalizePhoneKey(phoneNumber),
    )
  );
}

async function configureAndroidPhoneAuthSettings(
  phoneNumber: string,
  forceRecaptcha: boolean,
) {
  if (Platform.OS !== 'android') {
    return;
  }

  const settings = auth().settings;
  const isConfiguredTestPhone = shouldUseFirebaseTestPhone(phoneNumber);

  settings.forceRecaptchaFlowForTesting = forceRecaptcha;
  settings.appVerificationDisabledForTesting = isConfiguredTestPhone;

  if (isConfiguredTestPhone && Config.FIREBASE_TEST_OTP_CODE?.trim()) {
    await settings.setAutoRetrievedSmsCodeForPhoneNumber(
      phoneNumber,
      Config.FIREBASE_TEST_OTP_CODE.trim(),
    );
  }
}

function isAndroidRecaptchaRecoverableError(error: unknown): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }

  const errorCode = (error as {code?: string})?.code;
  return Boolean(
    errorCode && ANDROID_RECAPTCHA_RECOVERABLE_CODES.has(errorCode),
  );
}

export interface AuthBootstrapResponse {
  user_id: string;
  firebase_uid: string;
  phone_number: string;
  full_name: string | null;
  kyc_completed: boolean;
  wallet_address: string | null;
  wallet_recovery_status:
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'COMPLETED'
    | null;
  wallet_recovery_requested_at: string | null;
}

export async function sendPhoneOtp(
  phoneNumber: string,
): Promise<PendingPhoneOtpSession> {
  const shouldForceRecaptchaByConfig =
    Platform.OS === 'android' &&
    Config.FIREBASE_AUTH_FORCE_RECAPTCHA?.trim()?.toLowerCase() === 'true';

  let usedRecaptchaFallback = false;
  let forceRecaptcha = shouldForceRecaptchaByConfig;

  try {
    await configureAndroidPhoneAuthSettings(phoneNumber, forceRecaptcha);
    pendingPhoneConfirmation = await auth().signInWithPhoneNumber(phoneNumber);
  } catch (error) {
    if (!forceRecaptcha && isAndroidRecaptchaRecoverableError(error)) {
      forceRecaptcha = true;
      usedRecaptchaFallback = true;
      await configureAndroidPhoneAuthSettings(phoneNumber, true);
      pendingPhoneConfirmation = await auth().signInWithPhoneNumber(phoneNumber);
    } else {
      clearPendingPhoneSession();
      throw error;
    }
  }

  pendingPhoneVerificationId = pendingPhoneConfirmation?.verificationId ?? null;

  return {
    phoneNumber,
    verificationId: pendingPhoneVerificationId,
    usedRecaptchaFallback,
  };
}

export async function confirmPhoneOtp(
  verificationCode: string,
  verificationId?: string | null,
): Promise<FirebaseAuthTypes.UserCredential> {
  const effectiveVerificationId =
    verificationId ?? pendingPhoneVerificationId ?? null;

  if (pendingPhoneConfirmation) {
    try {
      const result = await pendingPhoneConfirmation.confirm(verificationCode);
      if (!result) {
        clearPendingPhoneSession();
        throw new Error('OTP_CONFIRMATION_EMPTY');
      }

      clearPendingPhoneSession();
      return result;
    } catch (error) {
      const errorCode = (error as {code?: string})?.code;
      const canUseVerificationFallback =
        effectiveVerificationId &&
        (errorCode === 'auth/session-expired' ||
          errorCode === 'auth/invalid-verification-id');

      if (!canUseVerificationFallback) {
        throw error;
      }
    }
  }

  if (!effectiveVerificationId) {
    throw new Error('OTP_SESSION_MISSING');
  }

  const credential = auth.PhoneAuthProvider.credential(
    effectiveVerificationId,
    verificationCode,
  );
  const result = await auth().signInWithCredential(credential);
  clearPendingPhoneSession();
  return result;
}

export function getCurrentFirebaseUser(): FirebaseAuthTypes.User | null {
  return auth().currentUser;
}

export async function getFreshFirebaseIdToken(
  forceRefresh = false,
): Promise<string | null> {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    return null;
  }

  return currentUser.getIdToken(forceRefresh);
}

export async function signOutFirebase(): Promise<void> {
  clearPendingPhoneSession();
  await auth().signOut();
}
