const mockSignInWithPhoneNumber = jest.fn();
const mockSignInWithCredential = jest.fn();
const mockSetAutoRetrievedSmsCodeForPhoneNumber = jest.fn();
const mockSignOut = jest.fn();
const mockAuthStateChanged = jest.fn();
const mockPhoneAuthCredential = jest.fn(
  (verificationId: string, code: string) => ({
    providerId: 'phone',
    token: verificationId,
    secret: code,
  }),
);

const mockAuthInstance = {
  signInWithPhoneNumber: mockSignInWithPhoneNumber,
  signInWithCredential: mockSignInWithCredential,
  signOut: mockSignOut,
  onAuthStateChanged: mockAuthStateChanged,
  settings: {
    forceRecaptchaFlowForTesting: false,
    appVerificationDisabledForTesting: false,
    setAutoRetrievedSmsCodeForPhoneNumber:
      mockSetAutoRetrievedSmsCodeForPhoneNumber,
  },
};

jest.mock('react-native', () => ({
  Platform: {OS: 'android'},
}));

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@react-native-firebase/auth', () => {
  const phoneAuthProvider = {
    credential: (...args: [string, string]) => mockPhoneAuthCredential(...args),
  };
  const authModule = Object.assign(jest.fn(() => mockAuthInstance), {
    PhoneAuthProvider: phoneAuthProvider,
  });

  return {
    __esModule: true,
    default: authModule,
    PhoneAuthProvider: phoneAuthProvider,
  };
});

import Config from 'react-native-config';
import {
  confirmPhoneOtp,
  sendPhoneOtp,
  signOutFirebase,
  waitForFirebaseAuthState,
} from '../firebase';

describe('firebase phone auth helpers', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuthInstance.settings.forceRecaptchaFlowForTesting = false;
    mockAuthInstance.settings.appVerificationDisabledForTesting = false;
    mockSignOut.mockResolvedValue(undefined);
    delete (Config as any).FIREBASE_AUTH_FORCE_RECAPTCHA;
    delete (Config as any).FIREBASE_TEST_PHONE_NUMBER;
    delete (Config as any).FIREBASE_TEST_OTP_CODE;
    await signOutFirebase();
  });

  it('retries send OTP with Android reCAPTCHA when app verification fails', async () => {
    const confirmation = {
      verificationId: 'verify-123',
      confirm: jest.fn(),
    };

    mockSignInWithPhoneNumber
      .mockRejectedValueOnce({code: 'auth/invalid-app-credential'})
      .mockResolvedValueOnce(confirmation);

    const result = await sendPhoneOtp('+919999999999');

    expect(mockSignInWithPhoneNumber).toHaveBeenCalledTimes(2);
    expect(mockAuthInstance.settings.forceRecaptchaFlowForTesting).toBe(true);
    expect(result).toEqual({
      phoneNumber: '+919999999999',
      verificationId: 'verify-123',
      usedRecaptchaFallback: true,
    });
  });

  it('uses a verificationId fallback when the confirmation object is unavailable', async () => {
    const signInResult = {user: {uid: 'firebase-user-1'}};
    mockSignInWithCredential.mockResolvedValue(signInResult);

    const result = await confirmPhoneOtp('123456', 'verify-456');

    expect(mockPhoneAuthCredential).toHaveBeenCalledWith(
      'verify-456',
      '123456',
    );
    expect(mockSignInWithCredential).toHaveBeenCalledWith({
      providerId: 'phone',
      token: 'verify-456',
      secret: '123456',
    });
    expect(result).toBe(signInResult);
  });

  it('configures Firebase test-phone autofill when matching env values are present', async () => {
    (Config as any).FIREBASE_TEST_PHONE_NUMBER = '+91 99999 99999';
    (Config as any).FIREBASE_TEST_OTP_CODE = '123456';

    mockSignInWithPhoneNumber.mockResolvedValue({
      verificationId: 'verify-demo',
      confirm: jest.fn(),
    });

    await sendPhoneOtp('+91 99999 99999');

    expect(
      mockAuthInstance.settings.appVerificationDisabledForTesting,
    ).toBe(true);
    expect(mockSetAutoRetrievedSmsCodeForPhoneNumber).toHaveBeenCalledWith(
      '+91 99999 99999',
      '123456',
    );
  });

  it('keeps app verification enabled for real numbers after a demo sign-in', async () => {
    (Config as any).FIREBASE_TEST_PHONE_NUMBER = '+919000000001';
    (Config as any).FIREBASE_TEST_OTP_CODE = '123456';
    mockSignInWithPhoneNumber.mockResolvedValue({
      verificationId: 'verify-real',
      confirm: jest.fn(),
    });

    await sendPhoneOtp('+919000000001');
    await sendPhoneOtp('+919876543210');

    expect(mockAuthInstance.settings.appVerificationDisabledForTesting).toBe(false);
    expect(mockAuthInstance.settings.forceRecaptchaFlowForTesting).toBe(false);
    expect(mockSetAutoRetrievedSmsCodeForPhoneNumber).toHaveBeenCalledTimes(1);
  });
});

describe('Firebase session restoration', () => {
  afterEach(() => jest.useRealTimers());
  it('waits for the first native auth event and unsubscribes afterward', async () => {
    const unsubscribe = jest.fn();
    let listener!: (user: unknown) => void;
    mockAuthStateChanged.mockImplementation(callback => { listener = callback; return unsubscribe; });
    const restored = waitForFirebaseAuthState();
    const user = {uid: 'restored-farmer'};
    listener(user);
    await expect(restored).resolves.toBe(user);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('bounds a stalled native restoration without signing out', async () => {
    jest.useFakeTimers();
    const unsubscribe = jest.fn();
    mockAuthStateChanged.mockReturnValue(unsubscribe);
    mockSignOut.mockClear();
    const restored = waitForFirebaseAuthState();
    const assertion = expect(restored).rejects.toThrow('AUTH_RESTORE_TIMEOUT');
    jest.advanceTimersByTime(10000);
    await assertion;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
