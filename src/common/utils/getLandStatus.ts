import type {LandParcel} from '../../features/land/store/landSlice';

type BadgeLabel = '✓ Verified' | '⏳ Pending' | '✗ Rejected';

export interface LandStatusMeta {
  status: 'green' | 'orange' | 'red';
  label: BadgeLabel;
  showAudit: boolean;
  primaryAction: 'start_audit' | 'view_status' | null;
  primaryActionLabel: 'Start Audit' | 'View Status' | null;
  secondaryLabel: string | null;
}

const ACTIVE_AUDIT_STATUSES = new Set([
  'PROCESSING',
  'CALCULATING',
  'READY_TO_MINT',
  'FAILED',
]);

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

export function getLandStatusMeta(parcel: LandParcel): LandStatusMeta {
  if (parcel.status === 'rejected') {
    return {
      status: 'red',
      label: '✗ Rejected',
      showAudit: false,
      primaryAction: null,
      primaryActionLabel: null,
      secondaryLabel: 'Land verification failed.',
    };
  }

  if (parcel.status !== 'verified') {
    return {
      status: 'orange',
      label: '⏳ Pending',
      showAudit: false,
      primaryAction: null,
      primaryActionLabel: null,
      secondaryLabel: 'Verification in progress.',
    };
  }

  if (
    parcel.current_audit_id &&
    parcel.current_audit_status &&
    ACTIVE_AUDIT_STATUSES.has(parcel.current_audit_status)
  ) {
    return {
      status: 'orange',
      label: '⏳ Pending',
      showAudit: false,
      primaryAction: 'view_status',
      primaryActionLabel: 'View Status',
      secondaryLabel:
        parcel.current_audit_status === 'FAILED'
          ? 'Audit needs review.'
          : 'Audit processing is in progress.',
    };
  }

  const status = getLandStatus(parcel);
  if (status === 'green') {
    return {
      status,
      label: '✓ Verified',
      showAudit: false,
      primaryAction: null,
      primaryActionLabel: null,
      secondaryLabel: 'Audit complete for this year.',
    };
  }

  if (status === 'orange') {
    return {
      status: 'green',
      label: '✓ Verified',
      showAudit: true,
      primaryAction: 'start_audit',
      primaryActionLabel: 'Start Audit',
      secondaryLabel: 'Annual audit is due.',
    };
  }

  return {
    status: 'green',
    label: '✓ Verified',
    showAudit: true,
    primaryAction: 'start_audit',
    primaryActionLabel: 'Start Audit',
    secondaryLabel: 'Annual audit is overdue.',
  };
}
