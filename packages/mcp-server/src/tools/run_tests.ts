import { execSync } from "child_process"
import path from "path"

const ROOT = path.resolve(__dirname, "../../../..")

export async function runTests(pattern?: string): Promise<string> {
  const cmd = pattern
    ? `cd ${ROOT}/apps/backend && npm run test:unit -- --testPathPattern="${pattern}" --no-coverage 2>&1`
    : `cd ${ROOT}/apps/backend && npm run test:unit -- --no-coverage 2>&1`

  try {
    const output = execSync(cmd, {
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
    })
    return output
  } catch (error: any) {
    // Jest exits with non-zero when tests fail - that's expected, return output
    return error.stdout || error.message
  }
}
