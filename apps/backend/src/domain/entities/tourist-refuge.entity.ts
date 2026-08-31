/**
 * TouristRefuge Entity
 * Represents a mountain refuge recommendation in the tourist domain
 */
export class TouristRefugeEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  climbTime?: string | null;
  difficulty?: string | null;
  openFrom?: string | null;
  openTo?: string | null;
  location?: string | null;
  phone?: string | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristRefugeEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristRefuge
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
   * Check if TouristRefuge is active
   */
  public isActiveTouristRefuge(): boolean {
    return this.isActive;
  }
}
