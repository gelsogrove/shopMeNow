"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const entity_1 = require("./entity");
class User extends entity_1.Entity {
    get id() {
        return this.props.id || '';
    }
    get email() {
        return this.props.email;
    }
    get password() {
        return this.props.password;
    }
    get name() {
        if (this.props.name)
            return this.props.name;
        // Se non c'è un name esplicito, lo costruiamo da firstName e lastName
        const firstName = this.props.firstName || '';
        const lastName = this.props.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || undefined;
    }
    get firstName() {
        return this.props.firstName;
    }
    get lastName() {
        return this.props.lastName;
    }
    get status() {
        return this.props.status || 'ACTIVE';
    }
    get workspaceId() {
        return this.props.workspaceId;
    }
    get role() {
        return this.props.role;
    }
    // 🔐 Platform Admin getter for Backoffice access
    get isPlatformAdmin() {
        return this.props.isPlatformAdmin || false;
    }
    // 🔧 Developer User getter (skip 2FA)
    get isDeveloperUser() {
        return this.props.isDeveloperUser || false;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    get updatedAt() {
        return this.props.updatedAt;
    }
    get lastLogin() {
        return this.props.lastLogin;
    }
    // 🔒 2FA getters (CRITICAL for security checks)
    get twoFactorEnabled() {
        return this.props.twoFactorEnabled || false;
    }
    get twoFactorSecret() {
        return this.props.twoFactorSecret;
    }
    get twoFactorEnabledAt() {
        return this.props.twoFactorEnabledAt;
    }
    get recoveryCodes() {
        return this.props.recoveryCodes;
    }
    // 📱 Personal phone getter (optional)
    get phoneNumber() {
        return this.props.phoneNumber;
    }
    // 🌐 Language preference getter
    get language() {
        return this.props.language || 'ENG';
    }
    // 🧾 Billing getters (Andrea's requirement)
    get companyName() {
        return this.props.companyName;
    }
    get vatNumber() {
        return this.props.vatNumber;
    }
    get website() {
        return this.props.website;
    }
    get billingPhone() {
        return this.props.billingPhone;
    }
    get billingAddress() {
        return this.props.billingAddress;
    }
    // 🖼️ Company logo getter
    get logo() {
        return this.props.logo;
    }
    // 🔐 Auth provider info (for OAuth set-password feature)
    get authProvider() {
        return this.props.authProvider || 'email';
    }
    get passwordHash() {
        return this.props.passwordHash;
    }
    isVerified() {
        return this.status === 'ACTIVE';
    }
    static create(props) {
        // Validations
        if (!props.email || props.email.trim().length === 0) {
            throw new Error('User email is required');
        }
        if (!this.isValidEmail(props.email)) {
            throw new Error('Invalid email format');
        }
        return new User(props);
    }
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}
exports.User = User;
//# sourceMappingURL=user.entity.js.map