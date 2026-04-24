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
  it('marks stale persisted tier values unresolved while detection is running', () => {
    const staleState = {
      ...auditInitialState,
      arTier: 3 as const,
      arTierResolved: true,
    };

    const pendingState = auditReducer(staleState, {
      type: detectAndSetARTier.pending.type,
    });

    expect(pendingState.arTier).toBe(3);
    expect(pendingState.arTierResolved).toBe(false);
  });

  it('stores SLAM-only ARCore support as Tier 2', () => {
    const nextState = auditReducer(auditInitialState, {
      type: detectAndSetARTier.fulfilled.type,
      payload: 2,
    });

    expect(nextState.arTier).toBe(2);
    expect(nextState.arTierResolved).toBe(true);
  });

  it('falls back to Tier 3 only when detection rejects', () => {
    const nextState = auditReducer(
      {...auditInitialState, arTier: 2, arTierResolved: false},
      {type: detectAndSetARTier.rejected.type},
    );

    expect(nextState.arTier).toBe(3);
    expect(nextState.arTierResolved).toBe(true);
  });
});
