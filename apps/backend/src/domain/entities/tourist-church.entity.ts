/**
 * TouristChurch Entity
 * Represents a tourist church in the tourist domain
 */
export class TouristChurchEntity {
  /**
   * Properties
   */
  id: string;
  name: string;
  description?: string | null;
  century?: string | null;
  style?: string | null;
  location?: string | null;
  phone?: string | null;
  link?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristChurchEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristChurch
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
   * Check if TouristChurch is active
   */
  public isActiveTouristChurch(): boolean {
    return this.isActive;
  }
}
