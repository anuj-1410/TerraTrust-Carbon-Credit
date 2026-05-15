import api, {assertApiBaseUrlConfigured} from './api';
import {
  getFreshFirebaseIdToken,
  type AuthBootstrapResponse,
} from './firebase';
import {ensureFarmerWallet} from './wallet';

export interface AuthBootstrapWarning {
  code:
    | 'wallet-storage-pending'
    | 'wallet-registration-pending';
  message: string;
}

export interface AuthBootstrapResult {
  profile: AuthBootstrapResponse;
  warning?: AuthBootstrapWarning;
}

function getWalletRegistrationRetryMessage(error: unknown): string {
  const axiosErr = error as {
    message?: string;
    response?: {status?: number};
  };

  if (!axiosErr.response) {
    return 'Signed in, but wallet sync is still pending. TerraTrust will retry when your connection is stable.';
  }

  if (axiosErr.response.status && axiosErr.response.status >= 500) {
    return 'Signed in, but the server could not finish wallet setup yet. Please reopen the app in a moment.';
  }

  return 'Signed in, but wallet setup needs one more retry. Please reopen the app to finish it.';
}

async function refreshProfileAfterWalletRegistration(
  profile: AuthBootstrapResponse,
  walletAddress: string,
): Promise<AuthBootstrapResponse> {
  try {
    await getFreshFirebaseIdToken(true);
    const refreshedProfile = await api.get<AuthBootstrapResponse>(
      '/api/v1/auth/me',
    );

    return refreshedProfile.data.wallet_address
      ? refreshedProfile.data
      : {...refreshedProfile.data, wallet_address: walletAddress};
  } catch {
    return {...profile, wallet_address: walletAddress};
  }
}

export async function bootstrapAuthenticatedProfile(): Promise<AuthBootstrapResult> {
  assertApiBaseUrlConfigured();
  await getFreshFirebaseIdToken(true);

  const {data: profile} = await api.get<AuthBootstrapResponse>('/api/v1/auth/me');

  if (profile.wallet_address) {
    return {profile};
  }

  let walletAddress: string;
  try {
    walletAddress = await ensureFarmerWallet();
  } catch {
    return {
      profile,
      warning: {
        code: 'wallet-storage-pending',
        message:
          'Signed in, but secure wallet setup could not finish on this phone yet. Please reopen the app to retry.',
      },
    };
  }

  try {
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
    profile: await refreshProfileAfterWalletRegistration(profile, walletAddress),
  };
}
