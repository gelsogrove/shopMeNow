#!/usr/bin/env node
/**
 * Production seed wrapper
 * This file runs the TypeScript seed using ts-node in production
 * ts-node must be installed as a dependency (not devDependency) for this to work
 */

console.log('⚠️  Running seed in PRODUCTION - use only for initial setup!')

// Load ts-node to execute TypeScript
require('ts-node/register')

// Execute the seed file
require('./seed.ts')
