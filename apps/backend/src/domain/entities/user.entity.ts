import { Entity } from './entity';

export interface UserProps {
  id?: string;
  email: string;
  password?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  workspaceId?: string;
  role?: string;
  isPlatformAdmin?: boolean; // 🔐 Platform Admin flag for Backoffice access
  isDeveloperUser?: boolean; // 🔧 Developer user flag (skip 2FA)
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  // 🔒 2FA fields (CRITICAL for security)
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  twoFactorEnabledAt?: Date | null;
  recoveryCodes?: string[] | null;
  // 🧾 Billing fields (Andrea's requirement)
  companyName?: string | null;
  vatNumber?: string | null;
  website?: string | null;
  billingPhone?: string | null;
  billingAddress?: string | null;
  // 🔐 Auth provider info (for OAuth set-password feature)
  authProvider?: string;
  passwordHash?: string | null;
}

export class User extends Entity<UserProps> {
  get id(): string {
    return this.props.id || '';
  }

  get email(): string {
    return this.props.email;
  }

  get password(): string | undefined {
    return this.props.password;
  }

  get name(): string | undefined {
    if (this.props.name) return this.props.name;
    
    // Se non c'è un name esplicito, lo costruiamo da firstName e lastName
    const firstName = this.props.firstName || '';
    const lastName = this.props.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    return fullName || undefined;
  }

  get firstName(): string | undefined {
    return this.props.firstName;
  }

  get lastName(): string | undefined {
    return this.props.lastName;
  }

  get status(): string {
    return this.props.status || 'ACTIVE';
  }

  get workspaceId(): string | undefined {
    return this.props.workspaceId;
  }

  get role(): string | undefined {
    return this.props.role;
  }

  // 🔐 Platform Admin getter for Backoffice access
  get isPlatformAdmin(): boolean {
    return this.props.isPlatformAdmin || false;
  }

  // 🔧 Developer User getter (skip 2FA)
  get isDeveloperUser(): boolean {
    return this.props.isDeveloperUser || false;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  get lastLogin(): Date | undefined {
    return this.props.lastLogin;
  }

  // 🔒 2FA getters (CRITICAL for security checks)
  get twoFactorEnabled(): boolean {
    return this.props.twoFactorEnabled || false;
  }

  get twoFactorSecret(): string | null | undefined {
    return this.props.twoFactorSecret;
  }

  get twoFactorEnabledAt(): Date | null | undefined {
    return this.props.twoFactorEnabledAt;
  }

  get recoveryCodes(): string[] | null | undefined {
    return this.props.recoveryCodes;
  }

  // 🧾 Billing getters (Andrea's requirement)
  get companyName(): string | null | undefined {
    return this.props.companyName;
  }

  get vatNumber(): string | null | undefined {
    return this.props.vatNumber;
  }

  get website(): string | null | undefined {
    return this.props.website;
  }

  get billingPhone(): string | null | undefined {
    return this.props.billingPhone;
  }

  get billingAddress(): string | null | undefined {
    return this.props.billingAddress;
  }

  // 🔐 Auth provider info (for OAuth set-password feature)
  get authProvider(): string {
    return this.props.authProvider || 'email';
  }

  get passwordHash(): string | null | undefined {
    return this.props.passwordHash;
  }

  isVerified(): boolean {
    return this.status === 'ACTIVE';
  }

  static create(props: UserProps): User {
    // Validations
    if (!props.email || props.email.trim().length === 0) {
      throw new Error('User email is required');
    }

    if (!this.isValidEmail(props.email)) {
      throw new Error('Invalid email format');
    }

    return new User(props);
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
} 