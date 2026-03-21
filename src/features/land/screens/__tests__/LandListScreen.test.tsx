import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {NavigationContainer} from '@react-navigation/native';
import {configureStore} from '@reduxjs/toolkit';
import landReducer, {
  type LandState,
  landInitialState,
  type LandParcel,
} from '../../store/landSlice';
import LandListScreen from '../LandListScreen';

// --- Mocks ---

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      replace: jest.fn(),
      reset: jest.fn(),
    }),
  };
});

jest.mock('../../../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockRejectedValue({response: undefined}),
  },
}));

jest.mock('lottie-react-native', () => 'LottieView');

// --- Helpers ---

const VERIFIED_PARCEL: LandParcel = {
  id: 'p1',
  farm_name: 'Survey 47',
  survey_number: '47',
  district: 'Pune',
  taluka: 'Haveli',
  village: 'Kharadi',
  state: 'Maharashtra',
  area_hectares: 0.49,
  boundary_geojson: null,
  boundary_source: 'WMS_AUTO',
  is_verified: true,
  status: 'verified',
  last_audit_year: null,
  thumbnail_url: 'https://example.com/thumb1.png',
  created_at: '2026-03-21T10:00:00.000Z',
};

const PENDING_PARCEL: LandParcel = {
  ...VERIFIED_PARCEL,
  id: 'p2',
  farm_name: 'River Basin #4',
  status: 'pending',
  is_verified: false,
  last_audit_year: 2025,
  thumbnail_url: null,
};

const REJECTED_PARCEL: LandParcel = {
  ...VERIFIED_PARCEL,
  id: 'p3',
  farm_name: 'North Ridge Plot',
  status: 'rejected',
  is_verified: false,
  last_audit_year: null,
  thumbnail_url: null,
};

function createTestStore(landState: Partial<LandState> = {}) {
  return configureStore({
    reducer: {
      auth: (state = {}) => state,
      land: landReducer,
      audit: (state = {}) => state,
      credits: (state = {}) => state,
    },
    preloadedState: {
      land: {
        ...landInitialState,
        ...landState,
      },
    },
  });
}

function renderScreen(landState: Partial<LandState> = {}) {
  const store = createTestStore(landState);
  return render(
    <Provider store={store}>
      <NavigationContainer>
        <LandListScreen />
      </NavigationContainer>
    </Provider>,
  );
}

// --- Tests ---

describe('LandListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('empty state (0 parcels)', () => {
    it('shows empty state illustration and CTA', async () => {
      const {getByText} = renderScreen({parcels: []});
      await waitFor(() => {
        expect(getByText('No land parcels yet')).toBeTruthy();
        expect(
          getByText('Add your first land parcel to get started'),
        ).toBeTruthy();
        expect(getByText('Add Your First Parcel')).toBeTruthy();
      });
    });
  });

  describe('1 verified parcel', () => {
    it('shows parcel card with correct farm name', async () => {
      const {getByText} = renderScreen({parcels: [VERIFIED_PARCEL]});
      await waitFor(() => {
        expect(getByText('Survey 47')).toBeTruthy();
      });
    });

    it('shows area in acres', async () => {
      const {getByText} = renderScreen({parcels: [VERIFIED_PARCEL]});
      await waitFor(() => {
        expect(getByText('1.21 acres')).toBeTruthy();
      });
    });

    it('shows verified badge', async () => {
      const {getByText} = renderScreen({parcels: [VERIFIED_PARCEL]});
      await waitFor(() => {
        expect(getByText('✓ Verified')).toBeTruthy();
      });
    });

    it('shows "Start Audit" for verified parcel without current year audit', async () => {
      const {getByText} = renderScreen({parcels: [VERIFIED_PARCEL]});
      await waitFor(() => {
        expect(getByText('Start Audit')).toBeTruthy();
      });
    });

    it('shows "No audit yet" text', async () => {
      const {getByText} = renderScreen({parcels: [VERIFIED_PARCEL]});
      await waitFor(() => {
        expect(getByText('No audit yet')).toBeTruthy();
      });
    });
  });

  describe('3 mixed-status parcels', () => {
    const threeParcels = [VERIFIED_PARCEL, PENDING_PARCEL, REJECTED_PARCEL];

    it('renders all three parcel cards', async () => {
      const {getByText} = renderScreen({parcels: threeParcels});
      await waitFor(() => {
        expect(getByText('Survey 47')).toBeTruthy();
        expect(getByText('River Basin #4')).toBeTruthy();
        expect(getByText('North Ridge Plot')).toBeTruthy();
      });
    });

    it('shows correct badge for each status', async () => {
      const {getByText} = renderScreen({parcels: threeParcels});
      await waitFor(() => {
        expect(getByText('✓ Verified')).toBeTruthy();
        expect(getByText('⏳ Pending')).toBeTruthy();
        expect(getByText('✗ Rejected')).toBeTruthy();
      });
    });

    it('shows last audit year for pending parcel', async () => {
      const {getByText} = renderScreen({parcels: threeParcels});
      await waitFor(() => {
        expect(getByText('Last audited: 2025')).toBeTruthy();
      });
    });

    it('does not show Start Audit for non-verified parcels', async () => {
      const {getAllByText} = renderScreen({parcels: threeParcels});
      await waitFor(() => {
        // Only 1 "Start Audit" button for the verified parcel
        expect(getAllByText('Start Audit')).toHaveLength(1);
      });
    });
  });

  describe('last synced display', () => {
    it('shows last synced time when available', async () => {
      const {getByText} = renderScreen({
        parcels: [VERIFIED_PARCEL],
        lastSyncedAt: new Date().toISOString(),
      });
      await waitFor(() => {
        expect(getByText(/Last synced today/i)).toBeTruthy();
      });
    });
  });
});
