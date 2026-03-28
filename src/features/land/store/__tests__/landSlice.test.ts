import landReducer, {
  landInitialState,
  setParcels,
  addParcel,
  setCurrentDraft,
  clearCurrentDraft,
  setLastSynced,
  type LandParcel,
  type LandState,
} from '../landSlice';

const mockParcel: LandParcel = {
  id: 'parcel-1',
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
  thumbnail_url: 'https://example.com/thumb.png',
  created_at: '2026-03-21T10:00:00.000Z',
};

describe('landSlice', () => {
  describe('setParcels', () => {
    it('replaces the parcels array', () => {
      const state: LandState = {
        ...landInitialState,
        parcels: [mockParcel],
      };
      const newParcels = [
        {...mockParcel, id: 'parcel-2', farm_name: 'Survey 48'},
      ];
      const result = landReducer(state, setParcels(newParcels));
      expect(result.parcels).toHaveLength(1);
      expect(result.parcels[0].id).toBe('parcel-2');
    });

    it('can set empty array', () => {
      const state: LandState = {...landInitialState, parcels: [mockParcel]};
      const result = landReducer(state, setParcels([]));
      expect(result.parcels).toHaveLength(0);
    });
  });

  describe('addParcel', () => {
    it('appends a parcel to existing', () => {
      const state: LandState = {...landInitialState, parcels: [mockParcel]};
      const newParcel = {...mockParcel, id: 'parcel-2'};
      const result = landReducer(state, addParcel(newParcel));
      expect(result.parcels).toHaveLength(2);
      expect(result.parcels[1].id).toBe('parcel-2');
    });

    it('adds first parcel to empty array', () => {
      const result = landReducer(landInitialState, addParcel(mockParcel));
      expect(result.parcels).toHaveLength(1);
      expect(result.parcels[0].id).toBe('parcel-1');
    });
  });

  describe('setCurrentDraft', () => {
    it('merges partial draft into current', () => {
      const result = landReducer(
        landInitialState,
        setCurrentDraft({fetchStatus: 'fetching'}),
      );
      expect(result.currentDraft.fetchStatus).toBe('fetching');
      expect(result.currentDraft.ocrResult).toBeNull();
    });

    it('sets ocrResult without overwriting other fields', () => {
      const state: LandState = {
        ...landInitialState,
        currentDraft: {
          ...landInitialState.currentDraft,
          fetchStatus: 'fetching',
        },
      };
      const ocr = {
        survey_number: '47',
        owner_name: 'Ramesh',
        village: 'Kharadi',
        taluka: 'Haveli',
        district: 'Pune',
        state: 'Maharashtra',
        extraction_confidence: 0.87,
      };
      const result = landReducer(state, setCurrentDraft({ocrResult: ocr}));
      expect(result.currentDraft.ocrResult?.survey_number).toBe('47');
      expect(result.currentDraft.fetchStatus).toBe('fetching');
    });
  });

  describe('clearCurrentDraft', () => {
    it('resets draft to initial state', () => {
      const state: LandState = {
        ...landInitialState,
        currentDraft: {
          ocrResult: {
            survey_number: '47',
            owner_name: 'Ramesh',
            village: 'Kharadi',
            taluka: 'Haveli',
            district: 'Pune',
            state: 'Maharashtra',
            extraction_confidence: 0.87,
          },
          boundary: {type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]]},
          boundarySource: 'WMS_AUTO',
          satelliteThumbnailUrl: 'https://example.com/sat.png',
          fetchStatus: 'success',
        },
      };
      const result = landReducer(state, clearCurrentDraft());
      expect(result.currentDraft).toEqual(landInitialState.currentDraft);
    });

    it('does not affect parcels', () => {
      const state: LandState = {
        ...landInitialState,
        parcels: [mockParcel],
        currentDraft: {
          ...landInitialState.currentDraft,
          fetchStatus: 'error',
        },
      };
      const result = landReducer(state, clearCurrentDraft());
      expect(result.parcels).toHaveLength(1);
    });
  });

  describe('setLastSynced', () => {
    it('sets the lastSyncedAt timestamp', () => {
      const ts = '2026-03-21T10:00:00.000Z';
      const result = landReducer(landInitialState, setLastSynced(ts));
      expect(result.lastSyncedAt).toBe(ts);
    });

    it('overwrites previous value', () => {
      const state: LandState = {
        ...landInitialState,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      };
      const newTs = '2026-03-21T10:00:00.000Z';
      const result = landReducer(state, setLastSynced(newTs));
      expect(result.lastSyncedAt).toBe(newTs);
    });
  });
});
