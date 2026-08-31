/**
 * TouristExcursion Entity
 * Represents an excursion recommendation in the tourist domain
 */
export class TouristExcursionEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  difficulty?: string | null;
  duration?: string | null;
  season?: string | null;
  location?: string | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristExcursionEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristExcursion
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
   * Check if TouristExcursion is active
   */
  public isActiveTouristExcursion(): boolean {
    return this.isActive;
  }
}
