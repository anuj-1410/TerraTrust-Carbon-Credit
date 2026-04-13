import authReducer, {
  authInitialState,
  setUser,
  setWalletAddress,
  setKycCompleted,
  logout,
  type AuthUser,
  type AuthState,
} from '../authSlice';

describe('authSlice', () => {
  it('should return the initial state', () => {
    const state = authReducer(undefined, {type: 'unknown'});
    expect(state).toEqual(authInitialState);
    expect(state.user).toBeNull();
    expect(state.walletAddress).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.kycCompleted).toBe(false);
  });

  it('should set user and mark isAuthenticated=true on setUser', () => {
    const user: AuthUser = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      firebaseUid: 'firebase-user-1',
      name: 'Ramesh Patil',
      phone: '+919876543210',
    };
    const state = authReducer(authInitialState, setUser(user));
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should set walletAddress on setWalletAddress', () => {
    const address = '0x742d35Cc6634C0532925a3b8D4C9F2B6a84c7B2e';
    const state = authReducer(authInitialState, setWalletAddress(address));
    expect(state.walletAddress).toBe(address);
  });

  it('should set kycCompleted on setKycCompleted(true)', () => {
    const state = authReducer(authInitialState, setKycCompleted(true));
    expect(state.kycCompleted).toBe(true);
  });

  it('should set kycCompleted to false on setKycCompleted(false)', () => {
    const prevState: AuthState = {
      ...authInitialState,
      kycCompleted: true,
    };
    const state = authReducer(prevState, setKycCompleted(false));
    expect(state.kycCompleted).toBe(false);
  });

  it('should reset all fields to initial state on logout', () => {
    const loggedInState: AuthState = {
      user: {
        id: '123',
        firebaseUid: 'firebase-user-2',
        name: 'Test',
        phone: '+919999999999',
      },
      walletAddress: '0x1234',
      isAuthenticated: true,
      kycCompleted: true,
    };
    const state = authReducer(loggedInState, logout());
    expect(state).toEqual(authInitialState);
  });

  it('should never receive raw Aadhaar fields in user state', () => {
    const user: AuthUser = {
      id: '123',
      firebaseUid: 'firebase-user-3',
      name: 'Test User',
      phone: '+919876543210',
    };
    const state = authReducer(authInitialState, setUser(user));
    expect('aadhaar_number' in (state.user ?? {})).toBe(false);
    expect('aadhaar' in (state.user ?? {})).toBe(false);
    expect('aadhaar_hash' in (state.user ?? {})).toBe(false);
  });
});
