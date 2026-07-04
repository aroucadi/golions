import * as crypto from 'crypto';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export class EncryptionService {
  private key: Buffer;

  constructor() {
    const hexKey = process.env.ENCRYPTION_KEY;
    if (!hexKey) {
      throw new Error('ENCRYPTION_KEY environment variable is not defined.');
    }
    if (hexKey.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  /**
   * Encrypts plaintext string using AES-256-GCM.
   * Returns a colon-separated string: iv:authTag:ciphertext
   */
  public encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  /**
   * Decrypts ciphertext (colon-separated iv:authTag:ciphertext) using AES-256-GCM.
   */
  public decrypt(ciphertextWithTag: string): string {
    const parts = ciphertextWithTag.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format. Expected iv:tag:ciphertext');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Lazy init/export to avoid throwing constructor errors during imports if env is not configured yet
let instance: EncryptionService | null = null;

export const getEncryptionService = (): EncryptionService => {
  if (!instance) {
    instance = new EncryptionService();
  }
  return instance;
};

export default getEncryptionService;
