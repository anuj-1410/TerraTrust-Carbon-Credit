import {getLandStatus, getLandStatusMeta} from '../getLandStatus';
import type {LandParcel} from '../../../features/land/store/landSlice';

function makeParcel(lastAuditYear: number | null, overrides: Partial<LandParcel> = {}): LandParcel {
  return {
    id: 'test-id',
    farm_name: 'Test Farm',
    survey_number: 'SV-001',
    district: 'TestDistrict',
    taluka: 'TestTaluka',
    village: 'TestVillage',
    state: 'TestState',
    area_hectares: 5.0,
    boundary_geojson: null,
    boundary_source: 'MANUAL',
    is_verified: true,
    status: 'verified',
    last_audit_year: lastAuditYear,
    last_audit_date: null,
    thumbnail_url: null,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('getLandStatus', () => {
  const realDate = Date;

  afterEach(() => {
    global.Date = realDate;
  });

  function mockDate(isoString: string) {
    const fixed = new realDate(isoString);
    global.Date = class extends realDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(fixed.getTime());
        } else {
          // @ts-ignore
          super(...args);
        }
      }
      static now() {
        return fixed.getTime();
      }
    } as any;
  }

  it('returns orange when last_audit_year is null', () => {
    mockDate('2026-06-15T00:00:00Z');
    expect(getLandStatus(makeParcel(null))).toBe('orange');
  });

  it('returns green when last_audit_year equals current year', () => {
    mockDate('2026-06-15T00:00:00Z');
    expect(getLandStatus(makeParcel(2026))).toBe('green');
  });

  it('returns red when gap is 2+ years', () => {
    mockDate('2026-06-15T00:00:00Z');
    expect(getLandStatus(makeParcel(2024))).toBe('red');
  });

  it('returns orange when last audit year is the prior year and no exact date is available', () => {
    mockDate('2026-06-15T00:00:00Z');
    expect(getLandStatus(makeParcel(2025))).toBe('orange');
  });

  it('uses last_audit_date to switch from audit due to overdue after three months', () => {
    mockDate('2026-03-15T00:00:00Z');
    expect(
      getLandStatus(
        makeParcel(2025, {last_audit_date: '2025-12-20T00:00:00Z'}),
      ),
    ).toBe('orange');

    mockDate('2026-05-01T00:00:00Z');
    expect(
      getLandStatus(
        makeParcel(2025, {last_audit_date: '2025-12-20T00:00:00Z'}),
      ),
    ).toBe('red');
  });

  it('returns pending metadata for non-verified parcels', () => {
    expect(
      getLandStatusMeta(
        makeParcel(null, {status: 'pending', is_verified: false}),
      ),
    ).toEqual({status: 'orange', label: '⏳ Pending', showAudit: false});
  });
});
