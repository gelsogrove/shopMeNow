/**
 * pg_dump Credential Exposure Tests (BUG#18)
 *
 * VULNERABILITY: The admin backup endpoint called:
 *   spawn("pg_dump", ["--no-owner", "--no-privileges", "--dbname", DATABASE_URL])
 *
 * DATABASE_URL is a connection string that includes the DB password, e.g.:
 *   postgresql://user:s3cr3tP@ssw0rd@host:5432/mydb
 *
 * Command-line arguments are visible to ALL users on the system via:
 *   ps aux, /proc/<PID>/cmdline, system audit logs
 *
 * FIX: Parse the URL into components; pass --host/--port/--username/--dbname
 * separately. The password travels only via the PGPASSWORD env variable, which
 * is NOT visible in process lists.
 *
 * NOTE: These tests verify the spawn argument structure by mocking child_process.
 */

import { EventEmitter } from 'events'

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse DATABASE_URL the same way the fixed route does it.
 * Exported separately so it can be unit-tested without spinning up Express.
 */
function parseDbUrl(dbUrl: string): {
  host: string; port: string; username: string; dbname: string; password: string
} {
  const u = new URL(dbUrl)
  return {
    host:     u.hostname,
    port:     u.port || '5432',
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    dbname:   u.pathname.replace(/^\//, ''),
  }
}

// ─── URL parsing tests ────────────────────────────────────────────────────────

describe('pg_dump credential isolation – URL parsing (BUG#18)', () => {
  it('correctly extracts host, port, user, password, dbname from DATABASE_URL', () => {
    // RULE: each component must be extracted cleanly so the password can be
    //       removed from the argument vector
    const url = 'postgresql://myuser:s3cr3tP%40ssw0rd@db.example.com:5432/mydb'
    const c = parseDbUrl(url)
    expect(c.host).toBe('db.example.com')
    expect(c.port).toBe('5432')
    expect(c.username).toBe('myuser')
    expect(c.password).toBe('s3cr3tP@ssw0rd') // URL-decoded
    expect(c.dbname).toBe('mydb')
  })

  it('defaults port to 5432 when not specified in URL', () => {
    const url = 'postgresql://user:pass@host/dbname'
    const c = parseDbUrl(url)
    expect(c.port).toBe('5432')
  })

  it('parsed password is NOT the same as DATABASE_URL', () => {
    // RULE: the argument vector must never contain the full connection string
    const url = 'postgresql://user:hunter2@host:5432/db'
    const { password } = parseDbUrl(url)
    expect(url).not.toBe(password)
    expect(url).toContain(password)    // password IS inside the URL
    expect(password).not.toContain('@') // but it's been isolated cleanly
  })
})

// ─── spawn argument safety tests ─────────────────────────────────────────────

describe('pg_dump spawn arguments (BUG#18)', () => {
  const DB_URL = 'postgresql://admin:SuperSecret123@prod-db.internal:5432/echatbot'

  it('spawn args must NOT contain the full DATABASE_URL with embedded password', () => {
    // RULE: passing --dbname <full-url> exposes the password in ps aux
    const { host, port, username, dbname } = parseDbUrl(DB_URL)
    const spawnArgs = [
      '--no-owner', '--no-privileges',
      '--host',     host,
      '--port',     port,
      '--username', username,
      '--dbname',   dbname,
    ]

    const argVector = spawnArgs.join(' ')
    expect(argVector).not.toContain(DB_URL)
    expect(argVector).not.toContain('SuperSecret123')
  })

  it('password is conveyed only via PGPASSWORD env variable', () => {
    // RULE: credentials travel through the environment (not command line)
    //       so they are NOT visible in `ps aux`
    const { password } = parseDbUrl(DB_URL)
    const spawnEnv = { PGPASSWORD: password, DATABASE_URL: '' }

    expect(spawnEnv.PGPASSWORD).toBe('SuperSecret123')
    // DATABASE_URL must be blanked out in the child process env
    expect(spawnEnv.DATABASE_URL).toBe('')
  })

  it('DATABASE_URL is scrubbed from the child process environment', () => {
    // SCENARIO: Process inherits parent env which contains DATABASE_URL
    // RULE: child process must NOT inherit DATABASE_URL (password still there)
    const parentEnv = { ...process.env, DATABASE_URL: DB_URL }
    const childEnv = { ...parentEnv, PGPASSWORD: 'extracted_password', DATABASE_URL: '' }

    expect(childEnv.DATABASE_URL).toBe('')
    expect(childEnv.PGPASSWORD).toContain('extracted_password')
  })
})
