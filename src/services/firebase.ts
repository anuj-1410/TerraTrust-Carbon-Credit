import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import Config from 'react-native-config';

let pendingPhoneConfirmation: FirebaseAuthTypes.ConfirmationResult | null =
  null;
let pendingPhoneVerificationId: string | null = null;
let pendingPhoneNumber: string | null = null;
let phoneAttempt = 0;
const cancelledPhoneGuards = new Map<
  string,
  { unsubscribe: () => void; timer: ReturnType<typeof setTimeout> }
>();

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
  pendingPhoneNumber = null;
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

  const errorCode = (error as { code?: string })?.code;
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

export function observePhoneAuthentication(
  listener: (user: FirebaseAuthTypes.User | null) => void,
): () => void {
  return auth().onAuthStateChanged(listener);
}

function removeCancelledGuard(phone: string) {
  const guard = cancelledPhoneGuards.get(phone);
  if (guard) {
    guard.unsubscribe();
    clearTimeout(guard.timer);
    cancelledPhoneGuards.delete(phone);
  }
}

/** Android auto-retrieval can complete after the drawer was dismissed. Reject that abandoned intent. */
export async function cancelPendingPhoneOtp(phone: string): Promise<void> {
  if (pendingPhoneNumber === phone || pendingPhoneNumber === null) {
    phoneAttempt++;
    clearPendingPhoneSession();
  }
  removeCancelledGuard(phone);
  const unsubscribe = observePhoneAuthentication(user => {
    if (
      user?.phoneNumber === phone &&
      pendingPhoneNumber !== phone &&
      getCurrentFirebaseUser()?.uid === user.uid
    ) {
      void auth()
        .signOut()
        .catch(() => undefined);
    }
  });
  const timer = setTimeout(() => removeCancelledGuard(phone), 120000);
  cancelledPhoneGuards.set(phone, { unsubscribe, timer });
  if (getCurrentFirebaseUser()?.phoneNumber === phone) {
    await auth().signOut();
  }
}

export async function sendPhoneOtp(
  phoneNumber: string,
): Promise<PendingPhoneOtpSession> {
  const attempt = ++phoneAttempt;
  clearPendingPhoneSession();
  pendingPhoneNumber = phoneNumber;
  removeCancelledGuard(phoneNumber);
  const configuredRecaptcha =
    Platform.OS === 'android' &&
    Config.FIREBASE_AUTH_FORCE_RECAPTCHA?.trim()?.toLowerCase() === 'true';
  let usedRecaptchaFallback = false;
  let confirmation: FirebaseAuthTypes.ConfirmationResult;
  try {
    await configureAndroidPhoneAuthSettings(phoneNumber, configuredRecaptcha);
    try {
      confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    } catch (error) {
      if (
        !configuredRecaptcha &&
        isAndroidRecaptchaRecoverableError(error) &&
        attempt === phoneAttempt
      ) {
        usedRecaptchaFallback = true;
        await configureAndroidPhoneAuthSettings(phoneNumber, true);
        confirmation = await auth().signInWithPhoneNumber(phoneNumber);
      } else {
        throw error;
      }
    }
    if (attempt !== phoneAttempt) {
      throw new Error('OTP_SESSION_CANCELLED');
    }
    pendingPhoneConfirmation = confirmation;
    pendingPhoneVerificationId = confirmation?.verificationId ?? null;
    return {
      phoneNumber,
      verificationId: pendingPhoneVerificationId,
      usedRecaptchaFallback,
    };
  } catch (error) {
    if (attempt === phoneAttempt) {
      clearPendingPhoneSession();
    }
    throw error;
  }
}

export async function confirmPhoneOtp(
  verificationCode: string,
  verificationId?: string | null,
): Promise<FirebaseAuthTypes.UserCredential> {
  const attempt = phoneAttempt;
  if (
    pendingPhoneVerificationId &&
    verificationId &&
    verificationId !== pendingPhoneVerificationId
  ) {
    throw new Error('OTP_SESSION_CANCELLED');
  }
  const effectiveVerificationId =
    verificationId ?? pendingPhoneVerificationId ?? null;

  if (
    pendingPhoneConfirmation &&
    (!verificationId ||
      pendingPhoneConfirmation.verificationId === verificationId)
  ) {
    try {
      const result = await pendingPhoneConfirmation.confirm(verificationCode);
      if (!result) {
        if (attempt === phoneAttempt) {
          clearPendingPhoneSession();
        }
        throw new Error('OTP_CONFIRMATION_EMPTY');
      }

      if (attempt !== phoneAttempt) {
        throw new Error('OTP_SESSION_CANCELLED');
      }
      clearPendingPhoneSession();
      return result;
    } catch (error) {
      const errorCode = (error as { code?: string })?.code;
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
  if (attempt !== phoneAttempt) {
    throw new Error('OTP_SESSION_CANCELLED');
  }
  const result = await auth().signInWithCredential(credential);
  if (attempt !== phoneAttempt) {
    throw new Error('OTP_SESSION_CANCELLED');
  }
  clearPendingPhoneSession();
  return result;
}

export function getCurrentFirebaseUser(): FirebaseAuthTypes.User | null {
  return auth().currentUser;
}

export function waitForFirebaseAuthState(): Promise<FirebaseAuthTypes.User | null> {
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    const timer = setTimeout(() => {
      unsubscribe?.();
      reject(new Error('AUTH_RESTORE_TIMEOUT'));
    }, 10000);
    unsubscribe = auth().onAuthStateChanged(user => {
      clearTimeout(timer);
      unsubscribe?.();
      resolve(user);
    });
  });
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
  phoneAttempt++;
  clearPendingPhoneSession();
  await auth().signOut();
}
