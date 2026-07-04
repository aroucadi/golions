import { describe, test, expect, beforeAll } from 'vitest';
import { EncryptionService } from '../EncryptionService';
import * as crypto from 'crypto';

describe('EncryptionService', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  });

  test('should encrypt and decrypt a plaintext string successfully', () => {
    const service = new EncryptionService();
    const secretMessage = 'Passenger Passport: AB123456';
    
    const cipherText = service.encrypt(secretMessage);
    expect(cipherText).not.toBe(secretMessage);
    expect(cipherText.split(':')).toHaveLength(3);

    const decrypted = service.decrypt(cipherText);
    expect(decrypted).toBe(secretMessage);
  });

  test('should throw error if key is invalid', () => {
    const oldKey = process.env.ENCRYPTION_KEY;
    
    process.env.ENCRYPTION_KEY = 'short-key';
    expect(() => new EncryptionService()).toThrow();

    process.env.ENCRYPTION_KEY = oldKey;
  });
});
