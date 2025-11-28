import { Entity } from './entity';

export interface AgentProps {
  id?: string;
  name: string;
  content?: string;
  isActive?: boolean;
  isRouter?: boolean;
  department?: string | null;
  workspaceId: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  model?: string;
  max_tokens?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Agent extends Entity<AgentProps> {
  get id(): string {
    return this.props.id || '';
  }

  get name(): string {
    return this.props.name;
  }

  get content(): string | undefined {
    return this.props.content;
  }

  get isActive(): boolean {
    return this.props.isActive ?? true;
  }

  get isRouter(): boolean {
    return this.props.isRouter ?? false;
  }

  get department(): string | null | undefined {
    return this.props.department;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get temperature(): number | undefined {
    return this.props.temperature;
  }

  get top_p(): number | undefined {
    return this.props.top_p;
  }

  get top_k(): number | undefined {
    return this.props.top_k;
  }

  get model(): string | undefined {
    return this.props.model;
  }

  get max_tokens(): number | undefined {
    return this.props.max_tokens;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  static create(props: AgentProps): Agent {
    // Validations
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Agent name is required');
    }

    if (!props.workspaceId) {
      throw new Error('WorkspaceId is required');
    }

    // Create the agent entity
    return new Agent(props);
  }
} 