/**
 * TouristSkiFacility Entity
 * Represents a ski facility / slope in the tourist domain
 */
export class TouristSkiFacilityEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  slopeType?: string | null;
  location?: string | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristSkiFacilityEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristSkiFacility
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
   * Check if TouristSkiFacility is active
   */
  public isActiveTouristSkiFacility(): boolean {
    return this.isActive;
  }
}
