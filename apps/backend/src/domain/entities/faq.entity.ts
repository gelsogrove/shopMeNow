/**
 * FAQ Entity
 * Represents a frequently asked question in the domain
 */
export class FAQ {
  /**
   * Properties
   */
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  
  constructor(props: Partial<FAQ>) {
    Object.assign(this, props);
  }
  
  /**
   * Validate FAQ
   */
  public validate(): boolean {
    // Basic validation
    if (!this.question || this.question.trim() === '') {
      return false;
    }
    
    if (!this.answer || this.answer.trim() === '') {
      return false;
    }
    
    if (!this.workspaceId) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if FAQ is active
   */
  public isActiveFAQ(): boolean {
    return this.isActive;
  }
} 