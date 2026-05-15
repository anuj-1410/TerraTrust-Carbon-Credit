import {mmkv} from '../../store/mmkvStorage';
import type {RootStackParamList} from '../../types/navigation';

const ONBOARDING_KEY = 'onboarding_complete';

type AuthenticatedEntryRoute = Extract<
  keyof RootStackParamList,
  'KYCScreen' | 'OnboardingScreen' | 'HomeScreen'
>;

export function isOnboardingComplete(): boolean {
  return mmkv.getBoolean(ONBOARDING_KEY) === true;
}

export function markOnboardingComplete(): void {
  mmkv.set(ONBOARDING_KEY, true);
}

export function getAuthenticatedEntryRoute(
  kycCompleted: boolean,
): AuthenticatedEntryRoute {
  if (!kycCompleted) {
    return 'KYCScreen';
  }

  return isOnboardingComplete() ? 'HomeScreen' : 'OnboardingScreen';
}
