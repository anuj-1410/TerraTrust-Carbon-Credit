const mockNativeRandom = jest.fn((length: number) =>
  Buffer.alloc(length, 0x42).toString('base64'),
);
jest.mock('react-native', () => ({
  TurboModuleRegistry: {
    getEnforcing: () => ({ getRandomBase64: mockNativeRandom }),
  },
}));

it('initializes crypto before consumers and uses the native random generator without Math.random', () => {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'crypto',
  );
  const bridgeDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'RN$Bridgeless',
  );
  const mathRandom = jest.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('INSECURE_RANDOM_USED');
  });
  try {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'RN$Bridgeless', {
      value: true,
      configurable: true,
      writable: true,
    });
    const { assertSecureRandomAvailable } =
      require('../secureRandom') as typeof import('../secureRandom');
    assertSecureRandomAvailable();
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    expect(mockNativeRandom).toHaveBeenCalledWith(32);
    expect(Array.from(bytes)).toEqual(Array(32).fill(0x42));
    expect(mathRandom).not.toHaveBeenCalled();
    mathRandom.mockRestore();
    Object.defineProperty(globalThis, 'RN$Bridgeless', {
      value: false,
      configurable: true,
      writable: true,
    });
    expect(assertSecureRandomAvailable).toThrow('WALLET_INSECURE_DEBUGGER');
  } finally {
    mathRandom.mockRestore();
    if (cryptoDescriptor) {
      Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    } else {
      delete (globalThis as { crypto?: unknown }).crypto;
    }
    if (bridgeDescriptor) {
      Object.defineProperty(globalThis, 'RN$Bridgeless', bridgeDescriptor);
    } else {
      delete (globalThis as { RN$Bridgeless?: boolean }).RN$Bridgeless;
    }
  }
});
