import { execSync } from "child_process"
import path from "path"
import fs from "fs"

const ROOT = path.resolve(__dirname, "../../../..")
const LOGS_DIR = path.join(ROOT, "apps/backend/logs")

export async function readLogs(lines: number = 100): Promise<string> {
  try {
    // Find the most recent log file
    if (!fs.existsSync(LOGS_DIR)) {
      return "No logs directory found at apps/backend/logs/"
    }

    const files = fs
      .readdirSync(LOGS_DIR)
      .filter((f) => f.endsWith(".log"))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(LOGS_DIR, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    if (files.length === 0) {
      return "No log files found"
    }

    const latestLog = path.join(LOGS_DIR, files[0].name)
    const output = execSync(`tail -n ${lines} "${latestLog}"`, {
      encoding: "utf8",
    })

    return `=== ${files[0].name} (last ${lines} lines) ===\n${output}`
  } catch (error: any) {
    return `Error reading logs: ${error.message}`
  }
}
