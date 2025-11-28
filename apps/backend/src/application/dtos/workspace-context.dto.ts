import { IsNotEmpty, IsString } from 'class-validator';

/**
 * WorkspaceContextDTO
 * Standardized DTO for workspace identification across the application
 */
export class WorkspaceContextDTO {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  /**
   * Verifica se il workspaceId è valido 
   * @returns true se il workspaceId è una stringa valida e non vuota
   */
  isValid(): boolean {
    return typeof this.workspaceId === 'string' && this.workspaceId.trim() !== '';
  }

  /**
   * Factory method to create a WorkspaceContextDTO from various request sources
   * @param req Express Request object
   * @returns WorkspaceContextDTO or null if no workspaceId is found
   */
  static fromRequest(req: any): WorkspaceContextDTO | null {
    // Try to get workspaceId from different sources
    const workspaceId = 
      req.params?.workspaceId || 
      req.query?.workspaceId as string || 
      req.body?.workspaceId || 
      (req.headers?.['x-workspace-id'] as string);

    if (!workspaceId) {
      return null;
    }

    return new WorkspaceContextDTO(workspaceId);
  }
} 