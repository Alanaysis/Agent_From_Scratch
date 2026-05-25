import {
  listCronJobs,
  updateCronJob,
  recordCronRun,
  type CronJob,
} from "../storage/cron";
import type { ToolUseContext } from "../tools/Tool";
import { evolveOnCron, DEFAULT_EVOLUTION_CONFIG } from "../runtime/evolution";

type CronSchedulerOptions = {
  cwd: string;
  parentContext: ToolUseContext;
  intervalMs?: number;
};

export class CronScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly options: CronSchedulerOptions) {}

  start(): void {
    if (this.timer) return;

    const intervalMs = this.options.intervalMs ?? 60_000;

    this.timer = setInterval(async () => {
      if (this.running) return;
      await this.tick();
    }, intervalMs);

    this.running = false;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    this.running = true;

    try {
      const jobs = await listCronJobs(this.options.cwd);
      const now = Date.now();

      for (const job of jobs) {
        if (!job.enabled) continue;

        const nextRun = job.nextRun ? new Date(job.nextRun).getTime() : 0;
        if (nextRun > now) continue;

        await this.executeJob(job);
      }
    } catch (err) {
      console.error("[CronScheduler] Tick failed:", err);
    } finally {
      this.running = false;
    }
  }

  private async executeJob(job: CronJob): Promise<void> {
    const now = new Date().toISOString();

    try {
      await recordCronRun(this.options.cwd, job.id, {
        status: "running",
        startedAt: now,
      });

      const result = await evolveOnCron(
        this.options.cwd,
        this.options.parentContext,
        job.schedule,
      );

      const completedAt = new Date().toISOString();
      await recordCronRun(this.options.cwd, job.id, {
        status: "completed",
        completedAt,
        result: result?.summary ?? "Cron job completed",
      });

      const nextRunDate = new Date(Date.now() + parseInterval(job.schedule));
      await updateCronJob(this.options.cwd, job.id, {
        lastRun: now,
        nextRun: nextRunDate.toISOString(),
        runCount: (job.runCount ?? 0) + 1,
      });
    } catch (err) {
      const failedAt = new Date().toISOString();
      await recordCronRun(this.options.cwd, job.id, {
        status: "failed",
        completedAt: failedAt,
        result: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function parseInterval(schedule: string): number {
  const simpleMs: Record<string, number> = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "6h": 21_600_000,
    "12h": 43_200_000,
    "1d": 86_400_000,
    "daily": 86_400_000,
    "hourly": 3_600_000,
  };

  if (simpleMs[schedule]) return simpleMs[schedule];

  const match = schedule.match(/^(\d+)(m|h|d)$/);
  if (match) {
    const num = parseInt(match[1]!, 10);
    const unit = match[2];
    if (unit === "m") return num * 60_000;
    if (unit === "h") return num * 3_600_000;
    if (unit === "d") return num * 86_400_000;
  }

  return 86_400_000;
}
