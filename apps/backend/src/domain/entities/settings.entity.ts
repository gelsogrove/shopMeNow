import { v4 as uuidv4 } from 'uuid';

/**
 * SettingsProps interface
 * Defines properties for Settings entity
 */
export interface SettingsProps {
  id?: string;
  phoneNumber: string;
  apiKey: string;
  webhookUrl?: string;
  settings?: Record<string, any>;
  gdpr?: string;
  workspaceId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Settings Entity
 * Represents WhatsApp settings in the domain
 */
export class Settings {
  readonly id: string;
  readonly phoneNumber: string;
  readonly apiKey: string;
  readonly webhookUrl?: string;
  readonly settings: Record<string, any>;
  readonly gdpr?: string;
  readonly workspaceId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: SettingsProps) {
    this.id = props.id || uuidv4();
    this.phoneNumber = props.phoneNumber;
    this.apiKey = props.apiKey;
    this.webhookUrl = props.webhookUrl;
    this.settings = props.settings || {};
    this.gdpr = props.gdpr;
    this.workspaceId = props.workspaceId;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  /**
   * Validate settings data
   */
  public validate(): boolean {
    if (!this.phoneNumber || this.phoneNumber.trim() === '') {
      return false;
    }
    
    if (!this.apiKey || this.apiKey.trim() === '') {
      return false;
    }
    
    if (!this.workspaceId) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if the settings are configured
   */
  public isConfigured(): boolean {
    return !!(this.phoneNumber && this.apiKey);
  }

  /**
   * Check if GDPR is configured
   */
  public hasGdprContent(): boolean {
    return !!this.gdpr && this.gdpr.trim() !== '';
  }

  /**
   * Get settings value by key
   */
  public getSetting(key: string): any {
    return this.settings ? this.settings[key] : undefined;
  }
} 