import api from './api';
import {createMMKV} from 'react-native-mmkv';

const mmkv = createMMKV({id: 'terratrust-store'});

/**
 * Retries a pending audit upload stored in MMKV.
 * Called by BackgroundFetch when connectivity restores.
 */
export async function retryPendingUpload(taskId: string): Promise<void> {
  const raw = mmkv.getString('pending_upload');
  if (!raw) return; // nothing to upload

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Corrupted data — delete and bail
    mmkv.remove('pending_upload');
    return;
  }

  // Validate shape
  if (
    typeof payload?.audit_id !== 'string' ||
    !Array.isArray(payload?.trees) ||
    payload.trees.length === 0
  ) {
    mmkv.remove('pending_upload');
    return;
  }

  try {
    await api.post('/api/v1/audit/submit-samples', payload);
    // Success — clear the pending upload
    mmkv.remove('pending_upload');
  } catch (error: any) {
    if (error.response?.status === 401) {
      // Stale auth — delete key (user must re-authenticate)
      mmkv.remove('pending_upload');
    }
    // On no-response/network error, leave key intact for next retry
  }
}
