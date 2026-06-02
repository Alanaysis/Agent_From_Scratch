import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import {
  createCronJob,
  listCronJobs,
  getCronJob,
  updateCronJob,
  removeCronJob,
  recordCronRun,
  deleteCronJob,
  type CronJob,
} from '../../../storage/cron';

const TEST_DIR = join('/tmp', 'cron-test-' + Date.now());

beforeEach(async () => {
  await mkdir(join(TEST_DIR, '.irg', 'cron'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('Cron Storage', () => {
  describe('createCronJob', () => {
    it('creates a new cron job', async () => {
      const job = await createCronJob(TEST_DIR, 'Daily Reflection', '1d', 'Reflect on today');
      expect(job.name).toBe('Daily Reflection');
      expect(job.schedule).toBe('1d');
      expect(job.prompt).toBe('Reflect on today');
      expect(job.enabled).toBe(true);
      expect(job.runCount).toBe(0);
    });

    it('generates unique IDs', async () => {
      const job1 = await createCronJob(TEST_DIR, 'Job 1', '1h', 'prompt1');
      const job2 = await createCronJob(TEST_DIR, 'Job 2', '1h', 'prompt2');
      expect(job1.id).not.toBe(job2.id);
    });
  });

  describe('listCronJobs', () => {
    it('lists all cron jobs', async () => {
      await createCronJob(TEST_DIR, 'Job A', '1h', 'a');
      await createCronJob(TEST_DIR, 'Job B', '1d', 'b');
      const jobs = await listCronJobs(TEST_DIR);
      expect(jobs).toHaveLength(2);
    });

    it('returns empty array when no jobs', async () => {
      const jobs = await listCronJobs(TEST_DIR);
      expect(jobs).toEqual([]);
    });
  });

  describe('getCronJob', () => {
    it('gets an existing job', async () => {
      const created = await createCronJob(TEST_DIR, 'Test', '1h', 'test');
      const job = await getCronJob(TEST_DIR, created.id);
      expect(job).not.toBeNull();
      expect(job!.name).toBe('Test');
    });

    it('returns null for non-existent job', async () => {
      const job = await getCronJob(TEST_DIR, 'non-existent');
      expect(job).toBeNull();
    });
  });

  describe('updateCronJob', () => {
    it('updates job fields', async () => {
      const created = await createCronJob(TEST_DIR, 'Original', '1h', 'original');
      const updated = await updateCronJob(TEST_DIR, created.id, {
        name: 'Updated',
        enabled: false,
      });
      expect(updated.name).toBe('Updated');
      expect(updated.enabled).toBe(false);
    });

    it('updates lastRun and nextRun', async () => {
      const created = await createCronJob(TEST_DIR, 'Test', '1h', 'test');
      const now = new Date().toISOString();
      const updated = await updateCronJob(TEST_DIR, created.id, {
        lastRun: now,
        nextRun: now,
        runCount: 5,
      });
      expect(updated.lastRun).toBe(now);
      expect(updated.nextRun).toBe(now);
      expect(updated.runCount).toBe(5);
    });

    it('preserves id on update', async () => {
      const created = await createCronJob(TEST_DIR, 'Test', '1h', 'test');
      const updated = await updateCronJob(TEST_DIR, created.id, {
        name: 'Updated',
        id: 'different-id',
      } as any);
      expect(updated.id).toBe(created.id);
    });
  });

  describe('recordCronRun', () => {
    it('increments runCount', async () => {
      const created = await createCronJob(TEST_DIR, 'Test', '1h', 'test');
      await recordCronRun(TEST_DIR, created.id);
      const job = await getCronJob(TEST_DIR, created.id);
      expect(job!.runCount).toBe(1);
    });

    it('records run with status', async () => {
      const created = await createCronJob(TEST_DIR, 'Test', '1h', 'test');
      await recordCronRun(TEST_DIR, created.id, {
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        result: 'Success',
      });
      const job = await getCronJob(TEST_DIR, created.id);
      expect(job!.runCount).toBe(1);
      expect(job!.lastRun).toBeDefined();
    });

    it('records failed run', async () => {
      const created = await createCronJob(TEST_DIR, 'Test', '1h', 'test');
      await recordCronRun(TEST_DIR, created.id, {
        status: 'failed',
        result: 'LLM not configured',
      });
      const job = await getCronJob(TEST_DIR, created.id);
      expect(job!.runCount).toBe(1);
    });
  });

  describe('removeCronJob / deleteCronJob', () => {
    it('removes a job', async () => {
      const created = await createCronJob(TEST_DIR, 'Test', '1h', 'test');
      await removeCronJob(TEST_DIR, created.id);
      const job = await getCronJob(TEST_DIR, created.id);
      expect(job).toBeNull();
    });

    it('deleteCronJob also removes run logs', async () => {
      const created = await createCronJob(TEST_DIR, 'Test', '1h', 'test');
      await recordCronRun(TEST_DIR, created.id, { status: 'completed' });
      await deleteCronJob(TEST_DIR, created.id);
      const job = await getCronJob(TEST_DIR, created.id);
      expect(job).toBeNull();
    });
  });
});
