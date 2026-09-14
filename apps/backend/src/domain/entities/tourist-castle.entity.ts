/**
 * TouristCastle Entity
 * Represents a tourist castle in the tourist domain
 */
export class TouristCastleEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  century?: string | null;
  visitInfo?: string | null;
  location?: string | null;
  phone?: string | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristCastleEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristCastle
   */
  public validate(): boolean {
    // Basic validation
    if (!this.name || this.name.trim() === '') {
      return false;
    }

    if (!this.workspaceId) {
      return false;
    }

    return true;
  }

  /**
   * Check if TouristCastle is active
   */
  public isActiveTouristCastle(): boolean {
    return this.isActive;
  }
}
