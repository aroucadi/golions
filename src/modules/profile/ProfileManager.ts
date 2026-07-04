import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PassengerProfile } from './types';
import { getEncryptionService } from './EncryptionService';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export class ProfileManager {
  private filePath: string;
  private profiles: PassengerProfile[] = [];

  constructor(customFilePath?: string) {
    this.filePath = customFilePath || path.join(__dirname, '..', '..', 'data', 'profiles.json');
    this.loadProfiles();
  }

  /**
   * Loads profiles from disk.
   */
  private loadProfiles(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        const content = fs.readFileSync(this.filePath, 'utf8');
        this.profiles = JSON.parse(content);
      } catch (err) {
        logger.error('[ProfileManager] Error loading profiles:', err);
        this.profiles = [];
      }
    }
  }

  /**
   * Saves profiles to disk.
   */
  private saveProfiles(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.profiles, null, 2), 'utf8');
    } catch (err) {
      logger.error('[ProfileManager] Error saving profiles:', err);
    }
  }

  /**
   * Returns all passenger profiles, optionally decrypting sensitive fields.
   */
  public async getAllProfiles(decrypt: boolean = false): Promise<PassengerProfile[]> {
    if (!decrypt) return this.profiles;

    const service = getEncryptionService();
    return this.profiles.map((p) => {
      if (!p.encrypted) return p;
      try {
        return {
          ...p,
          passportNumber: service.decrypt(p.passportNumber),
          email: service.decrypt(p.email),
          phone: service.decrypt(p.phone),
          emergencyContact: p.emergencyContact
            ? {
                name: service.decrypt(p.emergencyContact.name),
                phone: service.decrypt(p.emergencyContact.phone)
              }
            : undefined,
          encrypted: false
        };
      } catch (err) {
        logger.error(`[ProfileManager] Failed to decrypt profile ${p.id}:`, err);
        return p;
      }
    });
  }

  /**
   * Retrieves a single profile by ID, optionally decrypting it.
   */
  public async getProfile(id: string, decrypt: boolean = false): Promise<PassengerProfile | null> {
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) return null;
    if (!decrypt || !profile.encrypted) return profile;

    const service = getEncryptionService();
    try {
      return {
        ...profile,
        passportNumber: service.decrypt(profile.passportNumber),
        email: service.decrypt(profile.email),
        phone: service.decrypt(profile.phone),
        emergencyContact: profile.emergencyContact
          ? {
              name: service.decrypt(profile.emergencyContact.name),
              phone: service.decrypt(profile.emergencyContact.phone)
            }
          : undefined,
        encrypted: false
      };
    } catch (err) {
      logger.error(`[ProfileManager] Failed to decrypt profile ${id}:`, err);
      return profile;
    }
  }

  /**
   * Safely encrypts and stores a new passenger profile.
   */
  public async storeProfile(profileData: Omit<PassengerProfile, 'id' | 'encrypted' | 'createdAt'>): Promise<string> {
    // Enforce max 10 profiles constraint
    if (this.profiles.length >= 10) {
      throw new Error('Maximum limit of 10 profiles reached.');
    }

    const service = getEncryptionService();
    
    // Encrypt sensitive fields
    const encryptedPassport = service.encrypt(profileData.passportNumber);
    const encryptedEmail = service.encrypt(profileData.email);
    const encryptedPhone = service.encrypt(profileData.phone);
    const encryptedEmergency = profileData.emergencyContact
      ? {
          name: service.encrypt(profileData.emergencyContact.name),
          phone: service.encrypt(profileData.emergencyContact.phone)
        }
      : undefined;

    const id = crypto.randomUUID();
    const newProfile: PassengerProfile = {
      id,
      name: profileData.name,
      passportNumber: encryptedPassport,
      nationality: profileData.nationality,
      dateOfBirth: profileData.dateOfBirth,
      email: encryptedEmail,
      phone: encryptedPhone,
      emergencyContact: encryptedEmergency,
      loyaltyNumber: profileData.loyaltyNumber,
      encrypted: true,
      createdAt: new Date().toISOString()
    };

    this.profiles.push(newProfile);
    this.saveProfiles();
    return id;
  }

  /**
   * Deletes a profile by ID.
   */
  public async deleteProfile(id: string): Promise<void> {
    this.profiles = this.profiles.filter((p) => p.id !== id);
    this.saveProfiles();
  }
}

export const profileManager = new ProfileManager();
export default profileManager;
