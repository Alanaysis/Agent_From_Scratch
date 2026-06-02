import { mkdir, readFile, readdir, rm, writeFile, appendFile } from "fs/promises";
import { join } from "path";

export type CronJob = {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
};

export type CronRunRecord = {
  status: "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  result?: string;
};

function getCronDir(cwd: string): string {
  return join(cwd, ".irg", "cron");
}

function getJobFilePath(cwd: string, jobId: string): string {
  return join(getCronDir(cwd), `${jobId}.json`);
}

function getRunLogPath(cwd: string, jobId: string): string {
  return join(getCronDir(cwd), `${jobId}-runs.jsonl`);
}

export async function initCronDir(cwd: string): Promise<void> {
  await mkdir(getCronDir(cwd), { recursive: true });
}

export async function createCronJob(
  cwd: string,
  name: string,
  schedule: string,
  prompt: string,
): Promise<CronJob> {
  await initCronDir(cwd);
  const id = `cron-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const job: CronJob = {
    id,
    name,
    schedule,
    prompt,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    runCount: 0,
  };
  await writeFile(getJobFilePath(cwd, id), JSON.stringify(job, null, 2), "utf8");
  return job;
}

export async function listCronJobs(cwd: string): Promise<CronJob[]> {
  try {
    const entries = await readdir(getCronDir(cwd));
    const jobs: CronJob[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json") || entry.endsWith("-runs.jsonl")) continue;
      const content = await readFile(getJobFilePath(cwd, entry.replace(/\.json$/, "")), "utf8");
      jobs.push(JSON.parse(content) as CronJob);
    }
    return jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function getCronJob(cwd: string, jobId: string): Promise<CronJob | null> {
  try {
    const content = await readFile(getJobFilePath(cwd, jobId), "utf8");
    return JSON.parse(content) as CronJob;
  } catch {
    return null;
  }
}

export async function updateCronJob(
  cwd: string,
  jobId: string,
  updates: Partial<CronJob>,
): Promise<CronJob> {
  const job = await getCronJob(cwd, jobId);
  if (!job) throw new Error(`Cron job not found: ${jobId}`);

  const updated = {
    ...job,
    ...updates,
    id: job.id,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(getJobFilePath(cwd, jobId), JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

export async function removeCronJob(cwd: string, jobId: string): Promise<void> {
  await rm(getJobFilePath(cwd, jobId), { force: true });
}

export async function recordCronRun(
  cwd: string,
  jobId: string,
  record?: CronRunRecord,
): Promise<void> {
  if (record) {
    await initCronDir(cwd);
    const logLine = JSON.stringify({
      jobId,
      ...record,
      timestamp: new Date().toISOString(),
    });
    await appendFile(getRunLogPath(cwd, jobId), logLine + "\n", "utf8");
  }

  const job = await getCronJob(cwd, jobId);
  if (!job) return;

  const updated = {
    ...job,
    lastRun: new Date().toISOString(),
    runCount: job.runCount + 1,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(getJobFilePath(cwd, jobId), JSON.stringify(updated, null, 2), "utf8");
}

export async function deleteCronJob(cwd: string, jobId: string): Promise<void> {
  await rm(getJobFilePath(cwd, jobId), { force: true });
  try {
    await rm(getRunLogPath(cwd, jobId), { force: true });
  } catch {
    // ignore
  }
}
