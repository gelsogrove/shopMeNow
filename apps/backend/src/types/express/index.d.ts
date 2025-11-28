import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: string;
        email: string;
        role: UserRole;
        workspaces?: Array<{
          id: string;
          role: UserRole;
        }>;
      };
      workspaceId?: string;
    }
  }
}

export { };
