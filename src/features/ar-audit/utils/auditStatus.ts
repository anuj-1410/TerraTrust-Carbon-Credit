import type {AppDispatch, RootState} from '../../../store';
import api from '../../../services/api';
import {setPendingMint} from '../../dashboard/store/creditsSlice';
import {fetchCreditsThunk} from '../../dashboard/store/creditsSlice';
import {addNotification} from '../../notifications/store/notificationsSlice';
import {
  setAuditResult,
  setLastPolledAt,
  setUploadStatus,
  type AuditResultResponse,
} from '../store/auditSlice';

interface SyncAuditStatusArgs {
  auditId: string;
  dispatch: AppDispatch;
  getState: () => RootState;
}

export function isAuditResultProcessingStatus(
  status: AuditResultResponse['status'] | null | undefined,
): boolean {
  return (
    status === 'PROCESSING' ||
    status === 'CALCULATING' ||
    status === 'READY_TO_MINT'
  );
}

export async function syncAuditStatus({
  auditId,
  dispatch,
  getState,
}: SyncAuditStatusArgs): Promise<AuditResultResponse> {
  const response = await api.get<AuditResultResponse>(
    `/api/v1/audit/result/${auditId}`,
  );
  const result = response.data;

  dispatch(setAuditResult(result));
  dispatch(setLastPolledAt(new Date().toISOString()));

  if (isAuditResultProcessingStatus(result.status)) {
    dispatch(setUploadStatus('processing'));
    dispatch(setPendingMint(true));
    return result;
  }

  const notificationsEnabled = getState().profile.settingsNotificationsEnabled;
  dispatch(setPendingMint(false));

  if (result.status === 'MINTED') {
    dispatch(setUploadStatus('success'));
    await dispatch(fetchCreditsThunk());

    if (notificationsEnabled) {
      dispatch(
        addNotification({
          id: `${auditId}-minted`,
          type: 'credits_ready',
          title: 'Credits ready',
          body: `Your audit issued ${result.credits_issued ?? 0} CTT.`,
          createdAt: new Date().toISOString(),
          read: false,
          auditId,
        }),
      );
    }

    return result;
  }

  if (result.status === 'COMPLETE_NO_CREDITS') {
    dispatch(setUploadStatus('success'));

    if (notificationsEnabled) {
      dispatch(
        addNotification({
          id: `${auditId}-complete`,
          type: 'audit_submitted',
          title: 'Audit complete',
          body: 'This audit cycle completed with 0 credits issued.',
          createdAt: new Date().toISOString(),
          read: false,
          auditId,
        }),
      );
    }

    return result;
  }

  dispatch(setUploadStatus('error'));

  if (notificationsEnabled) {
    dispatch(
      addNotification({
        id: `${auditId}-failed`,
        type: 'audit_failed',
        title: 'Audit failed',
        body: 'TerraTrust could not finish your audit processing.',
        createdAt: new Date().toISOString(),
        read: false,
        auditId,
      }),
    );
  }

  return result;
}
