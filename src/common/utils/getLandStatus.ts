import type {LandParcel} from '../../features/land/store/landSlice';

export function getLandStatus(
  parcel: LandParcel,
): 'green' | 'orange' | 'red' {
  if (parcel.status === 'rejected') {
    return 'red';
  }

  if (parcel.status !== 'verified') {
    return 'orange';
  }

  const currentYear = new Date().getFullYear();

  if (parcel.last_audit_date) {
    const lastAudit = new Date(parcel.last_audit_date);
    if (!Number.isNaN(lastAudit.getTime())) {
      if (lastAudit.getFullYear() === currentYear) {
        return 'green';
      }

      const monthsSince =
        (Date.now() - lastAudit.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
      return monthsSince <= 3 ? 'orange' : 'red';
    }
  }

  if (parcel.last_audit_year == null) {
    return 'orange';
  }

  if (parcel.last_audit_year === currentYear) {
    return 'green';
  }

  if (currentYear - parcel.last_audit_year === 1) {
    return 'orange';
  }

  if (currentYear - parcel.last_audit_year >= 2) {
    return 'red';
  }

  return 'orange';
}

export function getLandStatusMeta(parcel: LandParcel): {
  status: 'green' | 'orange' | 'red';
  label: string;
  showAudit: boolean;
} {
  if (parcel.status === 'rejected') {
    return {status: 'red', label: '✗ Rejected', showAudit: false};
  }

  if (parcel.status !== 'verified') {
    return {status: 'orange', label: '⏳ Pending', showAudit: false};
  }

  const status = getLandStatus(parcel);
  if (status === 'green') {
    return {status, label: '✓ Verified', showAudit: false};
  }

  if (status === 'orange') {
    return {status, label: '⏳ Audit Due', showAudit: true};
  }

  return {status, label: '⚠ Audit Overdue', showAudit: true};
}
