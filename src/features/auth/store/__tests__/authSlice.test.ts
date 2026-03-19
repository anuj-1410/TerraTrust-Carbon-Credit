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
      name: 'Ramesh Patil',
      phone: '+919876543210',
      aadhaar_hash:
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
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
        name: 'Test',
        phone: '+919999999999',
        aadhaar_hash: 'abc123',
      },
      walletAddress: '0x1234',
      isAuthenticated: true,
      kycCompleted: true,
    };
    const state = authReducer(loggedInState, logout());
    expect(state).toEqual(authInitialState);
  });

  it('should store aadhaar_hash in user and never receive raw Aadhaar', () => {
    const user: AuthUser = {
      id: '123',
      name: 'Test User',
      phone: '+919876543210',
      aadhaar_hash:
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    };
    const state = authReducer(authInitialState, setUser(user));
    // aadhaar_hash is stored
    expect(state.user?.aadhaar_hash).toBe(user.aadhaar_hash);
    // Raw Aadhaar should never be a field
    expect('aadhaar_number' in (state.user ?? {})).toBe(false);
    expect('aadhaar' in (state.user ?? {})).toBe(false);
  });
});
