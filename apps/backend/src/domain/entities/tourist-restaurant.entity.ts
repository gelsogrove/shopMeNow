/**
 * TouristRestaurant Entity
 * Represents a restaurant recommendation in the tourist domain
 */
export class TouristRestaurantEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  cuisineType?: string | null;
  celiacFriendly: boolean;
  needsReservation: boolean;
  location?: string | null;
  phone?: string | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristRestaurantEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristRestaurant
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
   * Check if TouristRestaurant is active
   */
  public isActiveTouristRestaurant(): boolean {
    return this.isActive;
  }
}
