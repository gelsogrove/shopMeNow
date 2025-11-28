import { Entity } from './entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export interface MessageProps {
  id?: string;
  chatId: string;
  content: string;
  role: MessageRole;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: Record<string, any>;
  userId?: string;
  agentId?: string;
}

export class Message extends Entity<MessageProps> {
  get id(): string {
    return this.props.id || '';
  }

  get chatId(): string {
    return this.props.chatId;
  }

  get content(): string {
    return this.props.content;
  }

  get role(): MessageRole {
    return this.props.role;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  get metadata(): Record<string, any> | undefined {
    return this.props.metadata;
  }

  get userId(): string | undefined {
    return this.props.userId;
  }

  get agentId(): string | undefined {
    return this.props.agentId;
  }

  static create(props: MessageProps): Message {
    // Validations
    if (!props.chatId) {
      throw new Error('Chat ID is required');
    }

    if (!props.content) {
      throw new Error('Message content is required');
    }

    if (!Object.values(MessageRole).includes(props.role)) {
      throw new Error('Invalid message role');
    }

    return new Message(props);
  }
} 