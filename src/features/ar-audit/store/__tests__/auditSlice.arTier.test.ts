jest.mock('../../../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../../../../services/ar-bridge', () => ({
  detectARTier: jest.fn(),
}));

import auditReducer, {
  auditInitialState,
  detectAndSetARTier,
} from '../auditSlice';

describe('audit AR tier refresh', () => {
  it('keeps the last resolved tier visible while a background refresh runs', () => {
    const resolvedState = {
      ...auditInitialState,
      arTier: 2 as const,
      arTierResolved: true,
      arSupportState: 'slam-only' as const,
    };

    const pendingState = auditReducer(resolvedState, {
      type: detectAndSetARTier.pending.type,
    });

    expect(pendingState.arTier).toBe(2);
    expect(pendingState.arTierResolved).toBe(true);
    expect(pendingState.arSupportState).toBe('slam-only');
  });

  it('stores SLAM-only ARCore support as Tier 2', () => {
    const nextState = auditReducer(auditInitialState, {
      type: detectAndSetARTier.fulfilled.type,
      payload: {
        tier: 2,
        resolved: true,
        supportState: 'slam-only',
      },
    });

    expect(nextState.arTier).toBe(2);
    expect(nextState.arTierResolved).toBe(true);
    expect(nextState.arSupportState).toBe('slam-only');
  });

  it('stores actionable unresolved states instead of forcing a manual fallback', () => {
    const nextState = auditReducer(auditInitialState, {
      type: detectAndSetARTier.fulfilled.type,
      payload: {
        tier: 3,
        resolved: false,
        supportState: 'arcore-install-required',
      },
    });

    expect(nextState.arTier).toBe(3);
    expect(nextState.arTierResolved).toBe(false);
    expect(nextState.arSupportState).toBe('arcore-install-required');
  });

  it('falls back to Tier 3 only when detection rejects without a prior result', () => {
    const nextState = auditReducer(
      {...auditInitialState, arTier: 2, arTierResolved: false},
      {type: detectAndSetARTier.rejected.type},
    );

    expect(nextState.arTier).toBe(3);
    expect(nextState.arTierResolved).toBe(true);
    expect(nextState.arSupportState).toBe('manual');
  });
});
