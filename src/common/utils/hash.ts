import {NativeModules} from 'react-native';

type HashModuleSpec = {
  sha256Utf8(input: string): Promise<string>;
  sha256Base64(base64: string): Promise<string>;
  sha256File(fileUriOrPath: string): Promise<string>;
  readFileAsBase64(fileUriOrPath: string): Promise<string>;
  persistFile(fileUriOrPath: string, targetFileName: string): Promise<string>;
  deleteFile(fileUriOrPath: string): Promise<boolean>;
};

const hashModule = NativeModules.HashModule as HashModuleSpec | undefined;

function requireHashModule(): HashModuleSpec {
  if (!hashModule) {
    throw new Error('HashModule is unavailable.');
  }
  return hashModule;
}

export async function sha256(data: string): Promise<string> {
  return requireHashModule().sha256Utf8(data);
}

export async function hashPhoto(base64: string): Promise<string> {
  return requireHashModule().sha256Base64(base64);
}

export async function hashFile(fileUriOrPath: string): Promise<string> {
  return requireHashModule().sha256File(fileUriOrPath);
}

export async function readFileAsBase64(fileUriOrPath: string): Promise<string> {
  return requireHashModule().readFileAsBase64(fileUriOrPath);
}

export async function persistFile(
  fileUriOrPath: string,
  targetFileName: string,
): Promise<string> {
  return requireHashModule().persistFile(fileUriOrPath, targetFileName);
}

export async function deleteFile(fileUriOrPath: string): Promise<boolean> {
  if (!fileUriOrPath) {
    return false;
  }

  return requireHashModule().deleteFile(fileUriOrPath);
}
