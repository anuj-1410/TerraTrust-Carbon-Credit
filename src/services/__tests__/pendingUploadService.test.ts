// Unit tests for pendingUploadService

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDelete = jest.fn();

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn(() => ({
    getString: mockGet,
    set: mockSet,
    delete: mockDelete,
  })),
}));

const mockPost = jest.fn();
jest.mock('../api', () => ({
  __esModule: true,
  default: {post: mockPost},
}));

import {retryPendingUpload} from '../pendingUploadService';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('retryPendingUpload', () => {
  it('does nothing when pending_upload key is empty', async () => {
    mockGet.mockReturnValue(undefined);
    await retryPendingUpload('task-1');
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes corrupted JSON data', async () => {
    mockGet.mockReturnValue('not valid json{{{');
    await retryPendingUpload('task-2');
    expect(mockDelete).toHaveBeenCalledWith('pending_upload');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('deletes payload with missing audit_id', async () => {
    mockGet.mockReturnValue(JSON.stringify({trees: [{zone_id: 'z1'}]}));
    await retryPendingUpload('task-3');
    expect(mockDelete).toHaveBeenCalledWith('pending_upload');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('deletes payload with empty trees array', async () => {
    mockGet.mockReturnValue(
      JSON.stringify({audit_id: 'a1', trees: []}),
    );
    await retryPendingUpload('task-4');
    expect(mockDelete).toHaveBeenCalledWith('pending_upload');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('posts valid payload and deletes key on success', async () => {
    const payload = {audit_id: 'a1', land_id: 'l1', trees: [{zone_id: 'z1'}]};
    mockGet.mockReturnValue(JSON.stringify(payload));
    mockPost.mockResolvedValue({status: 202});

    await retryPendingUpload('task-5');
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/audit/submit-samples',
      payload,
    );
    expect(mockDelete).toHaveBeenCalledWith('pending_upload');
  });

  it('deletes key on 401 error', async () => {
    const payload = {audit_id: 'a1', land_id: 'l1', trees: [{zone_id: 'z1'}]};
    mockGet.mockReturnValue(JSON.stringify(payload));
    mockPost.mockRejectedValue({response: {status: 401}});

    await retryPendingUpload('task-6');
    expect(mockDelete).toHaveBeenCalledWith('pending_upload');
  });

  it('leaves key intact on network error (no response)', async () => {
    const payload = {audit_id: 'a1', land_id: 'l1', trees: [{zone_id: 'z1'}]};
    mockGet.mockReturnValue(JSON.stringify(payload));
    mockPost.mockRejectedValue({message: 'Network Error'});

    await retryPendingUpload('task-7');
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
