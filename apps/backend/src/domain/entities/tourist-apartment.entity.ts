/**
 * TouristApartment Entity
 * Represents a vacation house/apartment (or affittacamere, residence, rental
 * agency, consortium) from the Pro Loco's official accommodation list
 */
export class TouristApartmentEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  streetNumber?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  rooms?: number | null;
  beds?: number | null;
  bathrooms?: number | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristApartmentEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristApartment
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
   * Check if TouristApartment is active
   */
  public isActiveTouristApartment(): boolean {
    return this.isActive;
  }
}
