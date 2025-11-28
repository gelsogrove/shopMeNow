import { Entity } from './entity';

export interface ChatProps {
  id?: string;
  title?: string;
  workspaceId: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isCompleted?: boolean;
  agentId?: string;
  customerId?: string;
  metadata?: Record<string, any>;
}

export class Chat extends Entity<ChatProps> {
  get id(): string {
    return this.props.id || '';
  }

  get title(): string | undefined {
    return this.props.title;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get userId(): string | undefined {
    return this.props.userId;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  get isCompleted(): boolean {
    return this.props.isCompleted ?? false;
  }

  get agentId(): string | undefined {
    return this.props.agentId;
  }

  get customerId(): string | undefined {
    return this.props.customerId;
  }

  get metadata(): Record<string, any> | undefined {
    return this.props.metadata;
  }

  static create(props: ChatProps): Chat {
    // Validations
    if (!props.workspaceId) {
      throw new Error('Workspace ID is required');
    }

    return new Chat(props);
  }
} 