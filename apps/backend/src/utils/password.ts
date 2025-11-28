import * as bcrypt from 'bcrypt';
import logger from './logger';

const SALT_ROUNDS = 10;

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(password, salt);
  } catch (error) {
    logger.error('Error hashing password:', error);
    throw new Error('Error hashing password');
  }
}

/**
 * Compare a plain text password with a hash
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    logger.error('Error comparing passwords:', error);
    throw new Error('Error comparing passwords');
  }
}

/**
 * Generate a random password
 */
export function generateRandomPassword(length = 12): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  let password = '';

  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
} 