/**
 * TouristSportsFacility Entity
 * Represents a sports facility (e.g. golf course, tennis court) in the tourist domain
 */
export class TouristSportsFacilityEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  sport?: string | null;
  location?: string | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristSportsFacilityEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristSportsFacility
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
   * Check if TouristSportsFacility is active
   */
  public isActiveTouristSportsFacility(): boolean {
    return this.isActive;
  }
}
