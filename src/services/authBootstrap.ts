import api, { assertApiBaseUrlConfigured } from './api';
import {
  getFreshFirebaseIdToken,
  getCurrentFirebaseUser,
  type AuthBootstrapResponse,
} from './firebase';

export interface AuthBootstrapWarning {
  code: 'wallet-storage-pending' | 'wallet-registration-pending';
  message: string;
}

export interface AuthBootstrapResult {
  profile: AuthBootstrapResponse;
  warning?: AuthBootstrapWarning;
}

function getWalletRegistrationRetryMessage(error: unknown): string {
  const axiosErr = error as {
    message?: string;
    response?: { status?: number };
  };

  if (!axiosErr.response) {
    return 'Signed in, but wallet sync is still pending. TerraTrust will retry when your connection is stable.';
  }

  if (axiosErr.response.status && axiosErr.response.status >= 500) {
    return 'Signed in, but the server could not finish wallet setup yet. TerraTrust will retry automatically.';
  }

  return 'Signed in, but wallet setup needs one more retry. Retry wallet setup from your Profile.';
}

async function refreshProfileAfterWalletRegistration(
  profile: AuthBootstrapResponse,
  walletAddress: string,
): Promise<AuthBootstrapResponse> {
  try {
    const refreshedProfile = await api.get<AuthBootstrapResponse>(
      '/api/v1/auth/me',
    );

    return refreshedProfile.data.wallet_address
      ? refreshedProfile.data
      : { ...refreshedProfile.data, wallet_address: walletAddress };
  } catch {
    return { ...profile, wallet_address: walletAddress };
  }
}

export async function bootstrapAuthenticatedProfile(): Promise<AuthBootstrapResult> {
  assertApiBaseUrlConfigured();
  const user = getCurrentFirebaseUser();
  if (!user || !(await getFreshFirebaseIdToken())) {
    throw new Error('AUTH_SESSION_MISSING');
  }

  const { data: profile } = await api.get<AuthBootstrapResponse>(
    '/api/v1/auth/me',
    {
      timeout: 15000,
    },
  );
  if (
    getCurrentFirebaseUser()?.uid !== user.uid ||
    profile.firebase_uid !== user.uid
  ) {
    throw new Error('AUTH_SESSION_CHANGED');
  }
  return { profile };
}

// Wallet storage and registration are background work, outside the login transition.
export async function completeAuthenticatedWallet(
  profile: AuthBootstrapResponse,
): Promise<AuthBootstrapResult> {
  const owner = getCurrentFirebaseUser();
  if (!owner || owner.uid !== profile.firebase_uid) {
    throw new Error('AUTH_SESSION_CHANGED');
  }

  if (profile.wallet_address) {
    return { profile };
  }

  let walletAddress: string;
  try {
    const { ensureFarmerWallet } =
      require('./wallet') as typeof import('./wallet');
    walletAddress = await ensureFarmerWallet(owner.uid);
  } catch {
    return {
      profile,
      warning: {
        code: 'wallet-storage-pending',
        message:
          'Signed in, but secure wallet setup could not finish on this phone yet. Retry wallet setup from your Profile.',
      },
    };
  }

  try {
    if (getCurrentFirebaseUser()?.uid !== owner.uid) {
      throw new Error('AUTH_SESSION_CHANGED');
    }
    await api.post('/api/v1/auth/register-wallet', {
      wallet_address: walletAddress,
    });
  } catch (error) {
    return {
      profile,
      warning: {
        code: 'wallet-registration-pending',
        message: getWalletRegistrationRetryMessage(error),
      },
    };
  }

  return {
    profile: await refreshProfileAfterWalletRegistration(
      profile,
      walletAddress,
    ),
  };
}
