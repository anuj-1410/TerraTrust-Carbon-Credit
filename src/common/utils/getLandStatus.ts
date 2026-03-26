import type {LandParcel} from '../../features/land/store/landSlice';

export function getLandStatus(
  parcel: LandParcel,
): 'green' | 'orange' | 'red' {
  const currentYear = new Date().getFullYear();

  if (parcel.last_audit_year == null) {
    return 'orange';
  }
  if (parcel.last_audit_year === currentYear) {
    return 'green';
  }
  if (currentYear - parcel.last_audit_year >= 2) {
    return 'red';
  }
  // last_audit_year === currentYear - 1
  const now = new Date();
  const marchCutoff = new Date(currentYear, 2, 1); // March 1
  return now >= marchCutoff ? 'red' : 'orange';
}
