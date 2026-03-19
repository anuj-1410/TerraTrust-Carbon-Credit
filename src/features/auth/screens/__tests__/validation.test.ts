import {z} from 'zod';

// These schemas mirror the ones used in LoginScreen and KYCScreen
export const loginSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\d{10}$/, 'Please enter a valid 10-digit number'),
});

export const kycSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(255, 'Name must be 255 characters or fewer'),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
});

describe('loginSchema', () => {
  it('should pass with a valid 10-digit number', () => {
    const result = loginSchema.safeParse({phoneNumber: '9876543210'});
    expect(result.success).toBe(true);
  });

  it('should fail with a 9-digit number', () => {
    const result = loginSchema.safeParse({phoneNumber: '987654321'});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Please enter a valid 10-digit number',
      );
    }
  });

  it('should fail with an 11-digit number', () => {
    const result = loginSchema.safeParse({phoneNumber: '98765432101'});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Please enter a valid 10-digit number',
      );
    }
  });

  it('should fail with non-numeric characters', () => {
    const result = loginSchema.safeParse({phoneNumber: '98765abcde'});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Please enter a valid 10-digit number',
      );
    }
  });

  it('should fail with empty string', () => {
    const result = loginSchema.safeParse({phoneNumber: ''});
    expect(result.success).toBe(false);
  });
});

describe('kycSchema', () => {
  it('should pass with valid name and 12-digit Aadhaar', () => {
    const result = kycSchema.safeParse({
      fullName: 'Ramesh Shankar Patil',
      aadhaarNumber: '123456789012',
    });
    expect(result.success).toBe(true);
  });

  it('should fail with empty name', () => {
    const result = kycSchema.safeParse({
      fullName: '',
      aadhaarNumber: '123456789012',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find(
        i => i.path[0] === 'fullName',
      );
      expect(nameError?.message).toBe('Full name is required');
    }
  });

  it('should fail with too-long name (>255 chars)', () => {
    const result = kycSchema.safeParse({
      fullName: 'A'.repeat(256),
      aadhaarNumber: '123456789012',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find(
        i => i.path[0] === 'fullName',
      );
      expect(nameError?.message).toBe('Name must be 255 characters or fewer');
    }
  });

  it('should pass with 12-digit Aadhaar number', () => {
    const result = kycSchema.safeParse({
      fullName: 'Test User',
      aadhaarNumber: '123456789012',
    });
    expect(result.success).toBe(true);
  });

  it('should fail with 11-digit Aadhaar number', () => {
    const result = kycSchema.safeParse({
      fullName: 'Test User',
      aadhaarNumber: '12345678901',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const aadhaarError = result.error.issues.find(
        i => i.path[0] === 'aadhaarNumber',
      );
      expect(aadhaarError?.message).toBe(
        'Aadhaar number must be exactly 12 digits',
      );
    }
  });

  it('should fail with non-numeric Aadhaar', () => {
    const result = kycSchema.safeParse({
      fullName: 'Test User',
      aadhaarNumber: '12345abc9012',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const aadhaarError = result.error.issues.find(
        i => i.path[0] === 'aadhaarNumber',
      );
      expect(aadhaarError?.message).toBe(
        'Aadhaar number must be exactly 12 digits',
      );
    }
  });

  it('should fail with 13-digit Aadhaar number', () => {
    const result = kycSchema.safeParse({
      fullName: 'Test User',
      aadhaarNumber: '1234567890123',
    });
    expect(result.success).toBe(false);
  });
});
