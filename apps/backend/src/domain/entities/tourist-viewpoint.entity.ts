/**
 * TouristViewpoint Entity
 * Represents a tourist viewpoint in the tourist domain
 */
export class TouristViewpointEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  altitude?: number | null;
  access?: string | null;
  difficulty?: string | null;
  location?: string | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristViewpointEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristViewpoint
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
   * Check if TouristViewpoint is active
   */
  public isActiveTouristViewpoint(): boolean {
    return this.isActive;
  }
}
