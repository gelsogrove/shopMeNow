/**
 * TouristEvent Entity
 * Represents an event recommendation in the tourist domain
 */
export class TouristEventEntity {
  /**
   * Properties
   */
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  price?: string | null;
  ticketInfo?: string | null;
  link?: string | null;
  ticketLink?: string | null;
  videoUrl?: string | null;
  order: number;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: Partial<TouristEventEntity>) {
    Object.assign(this, props);
  }

  /**
   * Validate TouristEvent
   */
  public validate(): boolean {
    // Basic validation
    if (!this.title || this.title.trim() === '') {
      return false;
    }

    if (!this.workspaceId) {
      return false;
    }

    return true;
  }

  /**
   * Check if TouristEvent is active
   */
  public isActiveTouristEvent(): boolean {
    return this.isActive;
  }
}
