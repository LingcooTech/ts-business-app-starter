import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  decryptJson,
  encryptJson,
  EncryptionError,
  type EncryptedEnvelope,
} from '@lingcoo-tech/crypto';
import { ApiError } from '@lingcoo-tech/http';

@Injectable()
export class SettingsCipher {
  constructor(private readonly config: ConfigService) {}

  currentKeyId(): string {
    return this.config.getOrThrow<string>('SETTINGS_ENCRYPTION_CURRENT_KEY_ID');
  }

  encrypt(value: unknown): { encryptedValue: EncryptedEnvelope; keyId: string } {
    const keyId = this.currentKeyId();
    return { encryptedValue: encryptJson(value, this.secret(keyId)), keyId };
  }

  decrypt<T>(value: unknown, keyId: string): T {
    try {
      return decryptJson<T>(value, this.secret(keyId));
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw new ApiError(
          500,
          'SETTING_DECRYPTION_FAILED',
          'Sensitive setting cannot be decrypted',
        );
      }
      throw error;
    }
  }

  private secret(keyId: string): string {
    const keys = this.config.getOrThrow<Record<string, string>>('SETTINGS_ENCRYPTION_KEYS');
    const secret = keys[keyId];
    if (!secret) {
      throw new ApiError(500, 'SETTING_KEY_UNAVAILABLE', 'Sensitive setting key is unavailable');
    }
    return secret;
  }
}
