/**
 * TouristHotel Entity
 * Represents a hotel recommendation in the tourist domain
 */
export class TouristHotelEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  stars?: number | null;
  location?: string | null;
  phone?: string | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristHotelEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristHotel
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
   * Check if TouristHotel is active
   */
  public isActiveTouristHotel(): boolean {
    return this.isActive;
  }
}
