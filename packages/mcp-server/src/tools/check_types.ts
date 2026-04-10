import { execSync } from "child_process"
import path from "path"

const ROOT = path.resolve(__dirname, "../../../..")

export async function checkTypes(): Promise<string> {
  try {
    const output = execSync(
      `cd ${ROOT}/apps/backend && npx tsc --noEmit 2>&1`,
      {
        encoding: "utf8",
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 5,
      }
    )
    return output || "✅ No TypeScript errors found"
  } catch (error: any) {
    return error.stdout || error.message
  }
}
