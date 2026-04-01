import cron from 'node-cron';
import Job from '../models/Job.js';
import { processPendingJobsForToday } from './jobService.js';

export function startCron() {
  // Run once per day at 01:00 server time
  cron.schedule('0 1 * * *', async () => {
    console.log('[cron] Starting daily job processing');
    try {
      const channelIds = await Job.distinct('channelId', { status: 'pending' });
      for (const channelId of channelIds) {
        try {
          const result = await processPendingJobsForToday(channelId);
          console.log('[cron] Channel', channelId, 'result', result);
        } catch (err) {
          console.error('[cron] Channel', channelId, 'processing failed', err);
        }
      }
    } catch (err) {
      console.error('[cron] Job processing failed', err);
    }
  });
}

