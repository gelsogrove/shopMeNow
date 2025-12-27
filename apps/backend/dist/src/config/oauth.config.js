"use strict";
/**
 * OAuth Configuration
 * Manages callback URLs for Google, Facebook, and Apple OAuth providers
 *
 * SECURITY NOTES:
 * - Production: Uses BACKEND_URL (e.g., https://api.echatbot.ai)
 * - Development: Google works with localhost, FB/Apple need ngrok
 * - All callback URLs must be whitelisted in provider console
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultAvatarUrl = exports.isProviderAvailable = exports.getOAuthConfig = exports.validateOAuthConfig = exports.getCallbackUrl = void 0;
const config_1 = require("../config");
/**
 * Get OAuth callback URL based on environment
 * @param provider - OAuth provider name
 * @returns Full callback URL
 */
const getCallbackUrl = (provider) => {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
        // PRODUCTION: Use backend domain
        const backendUrl = process.env.BACKEND_URL || 'https://api.echatbot.ai';
        return `${backendUrl}/api/auth/callback/${provider}`;
    }
    // DEVELOPMENT
    if (provider === 'google') {
        // Google supports localhost HTTP (no ngrok needed)
        return `http://localhost:${config_1.config.port}/api/auth/callback/google`;
    }
    // Facebook and Apple require HTTPS (use ngrok in development)
    const ngrokUrl = process.env.NGROK_URL;
    if (!ngrokUrl) {
        throw new Error(`${provider} OAuth requires HTTPS. In development, set NGROK_URL environment variable.
      
      Example:
      1. Install ngrok: brew install ngrok
      2. Run: ngrok http ${config_1.config.port}
      3. Set NGROK_URL in .env: NGROK_URL="https://abc123.ngrok.io"
      
      Alternative: Use Google OAuth only in development (works with localhost).`);
    }
    return `${ngrokUrl}/api/auth/callback/${provider}`;
};
exports.getCallbackUrl = getCallbackUrl;
/**
 * Validate OAuth configuration
 * Throws error if required environment variables are missing
 */
const validateOAuthConfig = () => {
    const errors = [];
    // Google OAuth
    if (!process.env.GOOGLE_CLIENT_ID) {
        errors.push('GOOGLE_CLIENT_ID is required');
    }
    if (!process.env.GOOGLE_CLIENT_SECRET) {
        errors.push('GOOGLE_CLIENT_SECRET is required');
    }
    // Facebook OAuth (optional in development)
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.FACEBOOK_APP_ID) {
            errors.push('FACEBOOK_APP_ID is required in production');
        }
        if (!process.env.FACEBOOK_APP_SECRET) {
            errors.push('FACEBOOK_APP_SECRET is required in production');
        }
    }
    // Apple OAuth (optional in development)
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.APPLE_SERVICE_ID) {
            errors.push('APPLE_SERVICE_ID is required in production');
        }
        if (!process.env.APPLE_TEAM_ID) {
            errors.push('APPLE_TEAM_ID is required in production');
        }
        if (!process.env.APPLE_KEY_ID) {
            errors.push('APPLE_KEY_ID is required in production');
        }
    }
    if (errors.length > 0) {
        throw new Error(`OAuth configuration errors:\n${errors.join('\n')}`);
    }
};
exports.validateOAuthConfig = validateOAuthConfig;
/**
 * Get complete OAuth configuration
 */
const getOAuthConfig = () => {
    (0, exports.validateOAuthConfig)();
    return {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: (0, exports.getCallbackUrl)('google'),
        },
        facebook: {
            appId: process.env.FACEBOOK_APP_ID || '',
            appSecret: process.env.FACEBOOK_APP_SECRET || '',
            callbackURL: process.env.FACEBOOK_APP_ID ? (0, exports.getCallbackUrl)('facebook') : '',
        },
        apple: {
            serviceId: process.env.APPLE_SERVICE_ID || '',
            teamId: process.env.APPLE_TEAM_ID || '',
            keyId: process.env.APPLE_KEY_ID || '',
            privateKeyPath: process.env.APPLE_PRIVATE_KEY_PATH || './certs/apple-private-key.p8',
            callbackURL: process.env.APPLE_SERVICE_ID ? (0, exports.getCallbackUrl)('apple') : '',
        },
    };
};
exports.getOAuthConfig = getOAuthConfig;
/**
 * Check if OAuth provider is available in current environment
 */
const isProviderAvailable = (provider) => {
    try {
        if (provider === 'google') {
            return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
        }
        if (provider === 'facebook') {
            return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
        }
        if (provider === 'apple') {
            return !!(process.env.APPLE_SERVICE_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID);
        }
        return false;
    }
    catch (_a) {
        return false;
    }
};
exports.isProviderAvailable = isProviderAvailable;
/**
 * Default avatar URL generator
 * Uses UI Avatars service to generate avatar from user initials
 * @param firstName - User first name
 * @param lastName - User last name
 * @returns Avatar URL
 */
const getDefaultAvatarUrl = (firstName, lastName) => {
    const initials = `${(firstName === null || firstName === void 0 ? void 0 : firstName[0]) || ''}${(lastName === null || lastName === void 0 ? void 0 : lastName[0]) || ''}`.toUpperCase() || 'U';
    const name = encodeURIComponent(initials);
    return `https://ui-avatars.com/api/?name=${name}&background=10b981&color=fff&size=200&bold=true`;
};
exports.getDefaultAvatarUrl = getDefaultAvatarUrl;
//# sourceMappingURL=oauth.config.js.map