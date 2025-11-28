import { Settings, SettingsProps } from "../entities/settings.entity";

/**
 * Interface for Settings Repository
 * Defines all data operations for Settings entity
 */
export interface ISettingsRepository {
  /**
   * Find settings by workspace ID
   */
  findByWorkspaceId(workspaceId: string): Promise<Settings | null>;
  
  /**
   * Create settings for a workspace
   */
  create(data: SettingsProps): Promise<Settings>;
  
  /**
   * Update settings for a workspace
   */
  update(workspaceId: string, data: Partial<SettingsProps>): Promise<Settings>;
  
  /**
   * Delete settings for a workspace
   */
  delete(workspaceId: string): Promise<boolean>;
  
  /**
   * Get GDPR content for a workspace
   */
  getGdprContent(workspaceId: string): Promise<string | null>;
  
  /**
   * Update GDPR content for a workspace
   */
  updateGdprContent(workspaceId: string, gdprContent: string): Promise<Settings>;
} 