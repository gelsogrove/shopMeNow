/**
 * Scheduler for eChatbot Background Jobs
 *
 * Every job is declared ONCE, in the JOBS array below. start/stop/status all
 * read that array, so adding a job means adding one entry — there is no second
 * place to remember.
 *
 * WHY THE ARRAY (2026-09-14): each job used to be repeated in four places —
 * its own `const`, startScheduler(), stopScheduler() and a hand-written type
 * in getSchedulerStatus() — plus a summary comment up here. They had already
 * drifted: this header listed 3 jobs while 5 were running. A job forgotten in
 * startScheduler() throws no error, it simply never runs, and nobody notices
 * until the thing it was supposed to do has not happened for a month.
 *
 * Cron syntax: [minute] [hour] [day] [month] [day-of-week]
 */

import { prisma } from "@echatbot/database"
import cron, { ScheduledTask } from "node-cron"
import { SearchConversationRepository } from "./repositories/searchConversation.repository"
import { WorkspaceRepository } from "./repositories/workspace.repository"
import { runMonthEndBilling } from "./services/month-end-billing.service"
import { runTrialExpiryNotifications } from "./services/trial-expiry-notification.service"
import { WhatsAppRetentionService } from "./services/whatsapp-retention.service"
import logger from "./utils/logger"

const searchConversationRepo = new SearchConversationRepository()
const workspaceRepo = new WorkspaceRepository()
const whatsappRetentionService = new WhatsAppRetentionService(prisma)

interface JobDefinition {
  /** Stable key, used in the status payload. */
  name: string
  /** Cron expression. */
  schedule: string
  /** Shown in the startup log — plain words, for whoever reads the boot output. */
  description: string
  /** IANA timezone. Omit for jobs whose hour does not matter (cleanups). */
  timezone?: string
  /**
   * `unknown` rather than `void`: several of these return a summary object
   * (billing, retention, trial expiry) that the scheduler has never used and
   * does not need. Typing it `void` would force a wrapper around each one for
   * no gain.
   */
  run: () => Promise<unknown>
}

/**
 * Mark ACTIVE search conversations past their expiresAt as EXPIRED.
 *
 * 🔒 Iterates over every workspace and calls the repository per workspace, so
 * the workspaceId filter is never dropped (CLAUDE.md §2). One workspace
 * failing must not stop the others, hence the inner try.
 */
async function markExpiredConversations(): Promise<void> {
  const workspaces = await workspaceRepo.findAll()
  let totalMarked = 0

  for (const workspace of workspaces) {
    try {
      const count = await searchConversationRepo.markExpired(workspace.id)
      if (count > 0) {
        logger.info(`✅ Marked ${count} conversations as expired in workspace ${workspace.id}`)
        totalMarked += count
      }
    } catch (error) {
      logger.error(`❌ Error marking expired conversations for workspace ${workspace.id}:`, error)
    }
  }

  if (totalMarked > 0) {
    logger.info(`✅ Total: Marked ${totalMarked} search conversations as expired across all workspaces`)
  }
}

/**
 * Delete search conversations older than 30 days.
 *
 * 🔒 Per workspace for the same reason as above.
 */
async function deleteOldConversations(): Promise<void> {
  const workspaces = await workspaceRepo.findAll()
  let totalDeleted = 0

  for (const workspace of workspaces) {
    try {
      const count = await searchConversationRepo.deleteOld(30, workspace.id)
      if (count > 0) {
        logger.info(
          `✅ Deleted ${count} conversations older than 30 days in workspace ${workspace.id}`
        )
        totalDeleted += count
      }
    } catch (error) {
      logger.error(`❌ Error deleting old conversations for workspace ${workspace.id}:`, error)
    }
  }

  if (totalDeleted > 0) {
    logger.info(`✅ Total: Deleted ${totalDeleted} old search conversations across all workspaces`)
  }
}

/**
 * The jobs. One entry each — this array is the single source of truth.
 */
const JOBS: JobDefinition[] = [
  {
    name: "markExpiredConversations",
    schedule: "*/5 * * * *",
    description: "Mark expired conversations: every 5 minutes",
    run: markExpiredConversations,
  },
  {
    name: "deleteOldConversations",
    schedule: "0 3 * * 0",
    description: "Delete old conversations: Sundays at 3:00",
    run: deleteOldConversations,
  },
  {
    // Invoices the PREVIOUS month (subscription + recharges) and then charges
    // it once via PayPal. A failed charge leaves the invoice FAILED and it
    // surfaces in the backoffice Collections page for a manual retry.
    name: "monthEndBilling",
    schedule: "30 23 1 * *",
    description: "Month-end billing: 1st of the month at 23:30 (Europe/Rome)",
    timezone: "Europe/Rome",
    run: runMonthEndBilling,
  },
  {
    // Purges webhook dedup events and terminal queue rows older than 30 days,
    // plus expired anonymous widget sessions. Exact rules live in the service.
    name: "whatsappRetention",
    schedule: "0 4 * * *",
    description: "WhatsApp retention cleanup: every day at 4:00",
    run: () => whatsappRetentionService.cleanup(),
  },
  {
    // Warns FREE_TRIAL owners whose trial ends within TRIAL_WARNING_DAYS; one
    // email per trial, throttled by users.trialExpiringNotifiedAt. Before this
    // a trial lapsed with no notice and the chatbot just went silent (Andrea,
    // 2026-09-14). Business hours on purpose — nobody reads a 4am email.
    name: "trialExpiry",
    schedule: "0 9 * * *",
    description: "Trial expiry warnings: every day at 9:00 (Europe/Rome)",
    timezone: "Europe/Rome",
    run: runTrialExpiryNotifications,
  },
]

/**
 * Wrap a job so a failure is logged and contained: one job throwing must
 * never take down the process or stop the others from running.
 */
function createTask(job: JobDefinition): ScheduledTask {
  return cron.schedule(
    job.schedule,
    async () => {
      try {
        logger.info(`⏰ Running job: ${job.name}`)
        await job.run()
      } catch (error) {
        logger.error(`❌ Error in job ${job.name}:`, error)
      }
    },
    job.timezone ? { timezone: job.timezone } : undefined
  )
}

const tasks = new Map<string, ScheduledTask>(JOBS.map((job) => [job.name, createTask(job)]))

/**
 * Start all scheduled jobs. Called from index.ts after server startup.
 */
export function startScheduler(): void {
  // Heroku scale-out guard: cron jobs must run on exactly ONE process, or
  // scaling the web formation to 2+ dynos would fire every job once per dyno
  // (the month-end billing charges real money — the atomic attempt claims
  // would hold, but only one scheduler instance should exist by design).
  // Heroku sets DYNO (web.1, web.2, …); locally it is undefined → start.
  const dyno = process.env.DYNO
  if (dyno && dyno !== "web.1") {
    logger.info(`⏭️ Scheduler skipped on ${dyno} — cron jobs run on web.1 only`)
    return
  }

  logger.info("🚀 Starting background scheduler...")
  for (const job of JOBS) {
    tasks.get(job.name)?.start()
    logger.info(`  - ${job.description}`)
  }
  logger.info(`✅ Scheduler started successfully (${JOBS.length} jobs)`)
}

/**
 * Stop all scheduled jobs, for a graceful shutdown.
 */
export function stopScheduler(): void {
  logger.info("⏹️ Stopping background scheduler...")
  for (const task of tasks.values()) task.stop()
  logger.info("✅ Scheduler stopped successfully")
}

/**
 * Per-job running state, for monitoring and health checks.
 */
export function getSchedulerStatus(): Record<
  string,
  { running: boolean; schedule: string; timezone?: string }
> {
  return Object.fromEntries(
    JOBS.map((job) => [
      job.name,
      {
        running: tasks.get(job.name)?.getStatus() === "scheduled",
        schedule: job.schedule,
        ...(job.timezone ? { timezone: job.timezone } : {}),
      },
    ])
  )
}
