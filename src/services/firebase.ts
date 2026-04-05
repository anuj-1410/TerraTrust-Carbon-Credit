import auth, {type FirebaseAuthTypes} from '@react-native-firebase/auth';

let pendingPhoneConfirmation: FirebaseAuthTypes.ConfirmationResult | null =
  null;

export interface AuthBootstrapResponse {
  user_id: string;
  firebase_uid: string;
  phone_number: string;
  full_name: string | null;
  kyc_completed: boolean;
  wallet_address: string | null;
}

export async function sendPhoneOtp(phoneNumber: string): Promise<void> {
  pendingPhoneConfirmation = await auth().signInWithPhoneNumber(phoneNumber);
}

export async function confirmPhoneOtp(
  code: string,
): Promise<FirebaseAuthTypes.UserCredential> {
  if (!pendingPhoneConfirmation) {
    throw new Error('OTP_SESSION_MISSING');
  }

  const result = await pendingPhoneConfirmation.confirm(code);
  if (!result) {
    pendingPhoneConfirmation = null;
    throw new Error('OTP_CONFIRMATION_EMPTY');
  }

  pendingPhoneConfirmation = null;
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
  pendingPhoneConfirmation = null;
  await auth().signOut();
}