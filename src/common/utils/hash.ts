import {NativeModules} from 'react-native';

type HashModuleSpec = {
  sha256Utf8(input: string): Promise<string>;
  sha256Base64(base64: string): Promise<string>;
  readFileAsBase64(fileUriOrPath: string): Promise<string>;
};

const hashModule = NativeModules.HashModule as HashModuleSpec | undefined;

function getNodeCrypto() {
  try {
    return require('crypto') as typeof import('crypto');
  } catch {
    return null;
  }
}

function getNodeFs() {
  try {
    return require('fs') as typeof import('fs');
  } catch {
    return null;
  }
}

function normalizeFilePath(fileUriOrPath: string): string {
  return fileUriOrPath.replace(/^file:\/\//, '');
}

export async function sha256(data: string): Promise<string> {
  if (hashModule?.sha256Utf8) {
    return hashModule.sha256Utf8(data);
  }

  const crypto = getNodeCrypto();
  if (!crypto) {
    throw new Error('HashModule is unavailable.');
  }

  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

export async function hashPhoto(base64: string): Promise<string> {
  if (hashModule?.sha256Base64) {
    return hashModule.sha256Base64(base64);
  }

  const crypto = getNodeCrypto();
  if (!crypto) {
    throw new Error('HashModule is unavailable.');
  }

  return crypto.createHash('sha256').update(base64, 'base64').digest('hex');
}

export async function readFileAsBase64(fileUriOrPath: string): Promise<string> {
  if (hashModule?.readFileAsBase64) {
    return hashModule.readFileAsBase64(fileUriOrPath);
  }

  const fs = getNodeFs();
  if (!fs) {
    throw new Error('HashModule is unavailable.');
  }

  return fs.readFileSync(normalizeFilePath(fileUriOrPath), {encoding: 'base64'});
}
