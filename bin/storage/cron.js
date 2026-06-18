import { mkdir, readFile, readdir, rm, writeFile, appendFile } from "fs/promises";
import { join } from "path";
function getCronDir(cwd) {
    return join(cwd, ".irg", "cron");
}
function getJobFilePath(cwd, jobId) {
    return join(getCronDir(cwd), `${jobId}.json`);
}
function getRunLogPath(cwd, jobId) {
    return join(getCronDir(cwd), `${jobId}-runs.jsonl`);
}
export async function initCronDir(cwd) {
    await mkdir(getCronDir(cwd), { recursive: true });
}
export async function createCronJob(cwd, name, schedule, prompt) {
    await initCronDir(cwd);
    const id = `cron-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const job = {
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
export async function listCronJobs(cwd) {
    try {
        const entries = await readdir(getCronDir(cwd));
        const jobs = [];
        for (const entry of entries) {
            if (!entry.endsWith(".json") || entry.endsWith("-runs.jsonl"))
                continue;
            const content = await readFile(getJobFilePath(cwd, entry.replace(/\.json$/, "")), "utf8");
            jobs.push(JSON.parse(content));
        }
        return jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    catch {
        return [];
    }
}
export async function getCronJob(cwd, jobId) {
    try {
        const content = await readFile(getJobFilePath(cwd, jobId), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export async function updateCronJob(cwd, jobId, updates) {
    const job = await getCronJob(cwd, jobId);
    if (!job)
        throw new Error(`Cron job not found: ${jobId}`);
    const updated = {
        ...job,
        ...updates,
        id: job.id,
        updatedAt: new Date().toISOString(),
    };
    await writeFile(getJobFilePath(cwd, jobId), JSON.stringify(updated, null, 2), "utf8");
    return updated;
}
export async function removeCronJob(cwd, jobId) {
    await rm(getJobFilePath(cwd, jobId), { force: true });
}
export async function recordCronRun(cwd, jobId, record) {
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
    if (!job)
        return;
    const updated = {
        ...job,
        lastRun: new Date().toISOString(),
        runCount: job.runCount + 1,
        updatedAt: new Date().toISOString(),
    };
    await writeFile(getJobFilePath(cwd, jobId), JSON.stringify(updated, null, 2), "utf8");
}
export async function deleteCronJob(cwd, jobId) {
    await rm(getJobFilePath(cwd, jobId), { force: true });
    try {
        await rm(getRunLogPath(cwd, jobId), { force: true });
    }
    catch {
        // ignore
    }
}
