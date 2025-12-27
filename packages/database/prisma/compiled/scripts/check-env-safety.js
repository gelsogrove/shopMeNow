"use strict";
/**
 * PRODUCTION ENVIRONMENT SAFETY CHECK
 *
 * This script MUST be called before any destructive database operations:
 * - seed (prisma:seed)
 * - migrate:reset (prisma:reset)
 * - db:push (force)
 *
 * It will BLOCK execution in production environment to prevent data loss.
 *
 * Usage: import { ensureNotProduction } from './check-env-safety'
 *        ensureNotProduction()
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DESTRUCTIVE_SCRIPTS = void 0;
exports.isProductionEnvironment = isProductionEnvironment;
exports.isDestructiveOperationsAllowed = isDestructiveOperationsAllowed;
exports.ensureNotProduction = ensureNotProduction;
// ANSI colors for terminal output
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
/**
 * Checks if we're running in a production environment
 * Multiple checks for maximum safety:
 * 1. NODE_ENV === 'production'
 * 2. DATABASE_URL contains 'production' or 'prod'
 * 3. Explicit ALLOW_DESTRUCTIVE_OPERATIONS=true bypass
 */
function isProductionEnvironment() {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    const databaseUrl = process.env.DATABASE_URL?.toLowerCase() || "";
    // Check NODE_ENV
    if (nodeEnv === "production" || nodeEnv === "prod") {
        return true;
    }
    // Check DATABASE_URL for production indicators
    const productionIndicators = [
        "production",
        "prod-db",
        "prod.",
        ".prod.",
        "-prod-",
        "railway",
        "supabase",
        "planetscale",
        "neon.tech",
        "cockroachlabs",
    ];
    for (const indicator of productionIndicators) {
        if (databaseUrl.includes(indicator)) {
            return true;
        }
    }
    return false;
}
/**
 * Checks if destructive operations are explicitly allowed
 * This is a safety bypass that requires explicit opt-in
 */
function isDestructiveOperationsAllowed() {
    return process.env.ALLOW_DESTRUCTIVE_OPERATIONS === "true";
}
/**
 * BLOCKS execution if running in production environment
 * Call this at the beginning of any destructive script
 *
 * @param scriptName - Name of the script for logging purposes
 * @throws Process exit with code 1 if production detected
 */
function ensureNotProduction(scriptName = "this script") {
    console.log(`\n${YELLOW}🔒 Environment Safety Check...${RESET}\n`);
    const isProduction = isProductionEnvironment();
    const allowBypass = isDestructiveOperationsAllowed();
    // Log current environment
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || "(not set)"}`);
    console.log(`   DATABASE_URL: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
    console.log(`   ALLOW_DESTRUCTIVE_OPERATIONS: ${process.env.ALLOW_DESTRUCTIVE_OPERATIONS || "false"}`);
    console.log("");
    if (isProduction) {
        if (allowBypass) {
            console.log(`${YELLOW}${BOLD}⚠️  WARNING: Production environment detected but ALLOW_DESTRUCTIVE_OPERATIONS=true${RESET}`);
            console.log(`${YELLOW}   Proceeding with ${scriptName} - USE WITH EXTREME CAUTION!${RESET}\n`);
            return;
        }
        console.log(`${RED}${BOLD}════════════════════════════════════════════════════════════════${RESET}`);
        console.log(`${RED}${BOLD}   🚫 BLOCKED: DESTRUCTIVE OPERATION IN PRODUCTION ENVIRONMENT${RESET}`);
        console.log(`${RED}${BOLD}════════════════════════════════════════════════════════════════${RESET}`);
        console.log("");
        console.log(`${RED}   Script: ${scriptName}${RESET}`);
        console.log(`${RED}   Reason: This operation would DELETE or MODIFY production data${RESET}`);
        console.log("");
        console.log(`${YELLOW}   If you REALLY need to run this in production:${RESET}`);
        console.log(`${YELLOW}   Set ALLOW_DESTRUCTIVE_OPERATIONS=true in your environment${RESET}`);
        console.log("");
        console.log(`${RED}${BOLD}════════════════════════════════════════════════════════════════${RESET}\n`);
        process.exit(1);
    }
    console.log(`${GREEN}✅ Environment check passed - Not production${RESET}\n`);
}
/**
 * Masks sensitive parts of database URL for logging
 */
function maskDatabaseUrl(url) {
    if (!url)
        return "(not set)";
    try {
        // Mask password in URL
        const masked = url.replace(/(:\/\/)([^:]+):([^@]+)@/, "://$2:****@");
        // Also mask if URL is too long
        if (masked.length > 80) {
            return masked.substring(0, 77) + "...";
        }
        return masked;
    }
    catch {
        return "(unable to parse)";
    }
}
/**
 * List of scripts that are considered destructive
 * Used for documentation and potential automated checks
 */
exports.DESTRUCTIVE_SCRIPTS = [
    "prisma:seed",
    "prisma:reset",
    "migrate:reset",
    "db:push",
    "seed",
];
// If run directly, perform the check
if (require.main === module) {
    ensureNotProduction("environment check");
    console.log("Environment is safe for destructive operations.");
}
