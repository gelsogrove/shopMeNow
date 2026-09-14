/**
 * TouristVenue Entity
 * Represents a tourist venue in the tourist domain
 */
export class TouristVenueEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  venueType?: string | null;
  openingHours?: string | null;
  location?: string | null;
  phone?: string | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristVenueEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristVenue
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
   * Check if TouristVenue is active
   */
  public isActiveTouristVenue(): boolean {
    return this.isActive;
  }
}
