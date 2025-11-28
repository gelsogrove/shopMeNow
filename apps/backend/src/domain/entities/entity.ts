/**
 * Abstract base entity class
 * Provides common functionality for all domain entities
 */
export abstract class Entity<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = props;
  }

  public equals(entity?: Entity<T>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }

    if (this === entity) {
      return true;
    }

    return JSON.stringify(this.props) === JSON.stringify(entity.props);
  }
} 