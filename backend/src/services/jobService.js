import DryRunSession from "../models/DryRunSession.js";
import Job from "../models/Job.js";
import { getAuthorizedYoutubeClientForChannel } from "../config/youtubeClient.js";

const DAILY_JOB_LIMIT = parseInt(process.env.DAILY_JOB_LIMIT || "190", 10);

function normalizeTitleText(text) {
  return (
    (text || "")
      .toString()
      .normalize("NFKC")
      // Remove zero-width characters and normalize NBSP to space
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .trim()
      .replace(/\s+/g, " ")
  );
}

export function cleanupTitle(text) {
  const t = normalizeTitleText(text);
  if (!t) return "";

  // Fix spacing around common punctuation
  let out = t
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([(\[{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/([,.;:!?])([^\s])/g, "$1 $2");

  // Collapse repeated punctuation like ", ," or "!!"
  out = out
    .replace(/([,.;:!?])(\s*\1)+/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/\{\s*\}/g, "");

  // Final whitespace normalization
  out = out.trim().replace(/\s+/g, " ");
  return out;
}

async function fetchVideoSnippetById(youtube, videoId) {
  const resp = await youtube.videos.list({
    part: ["snippet"],
    id: videoId,
  });
  if (!resp.data.items || resp.data.items.length === 0) return null;
  const item = resp.data.items[0];
  return {
    videoId: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    categoryId: item.snippet.categoryId,
  };
}

async function fetchVideoSnippetsByIds(youtube, videoIds) {
  const unique = Array.from(
    new Set((videoIds || []).map((v) => (v || "").toString().trim()).filter(Boolean)),
  );
  const results = new Map();

  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const resp = await youtube.videos.list({
      part: ["snippet"],
      id: chunk,
      maxResults: 50,
    });
    for (const item of resp.data.items || []) {
      if (!item?.id || !item?.snippet) continue;
      results.set(item.id, {
        videoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        categoryId: item.snippet.categoryId,
      });
    }
  }

  return results;
}

export async function createDryRunSessionFromEdits(items, channelId) {
  if (!channelId) {
    throw new Error("channelId is required for dry run");
  }
  const youtube = await getAuthorizedYoutubeClientForChannel(channelId);

  let willUpdateCount = 0;
  let willSkipCount = 0;
  const outputItems = [];

  const snippetsById = await fetchVideoSnippetsByIds(
    youtube,
    (items || []).map((it) => it.videoId),
  );

  for (let i = 0; i < (items || []).length; i += 1) {
    const row = items[i] || {};
    const excelRowIndex = row.excelRowIndex || i + 1;
    const videoId = (row.videoId || "").toString().trim();
    const titleFromExcel = row.titleFromExcel || row.title || "";
    const proposedNewTitleRaw = row.newTitle ?? "";

    try {
      if (!videoId) {
        outputItems.push({
          excelRowIndex,
          videoId: null,
          titleFromExcel,
          oldTitle: null,
          newTitle: null,
          action: "skip",
          reason: "Missing videoId",
        });
        willSkipCount += 1;
        continue;
      }

      const videoInfo = snippetsById.get(videoId) || null;
      if (!videoInfo) {
        outputItems.push({
          excelRowIndex,
          videoId,
          titleFromExcel,
          oldTitle: null,
          newTitle: null,
          action: "skip",
          reason: "Video not found by videoId",
        });
        willSkipCount += 1;
        continue;
      }

      const cleanedNewTitle = cleanupTitle(proposedNewTitleRaw);
      if (!cleanedNewTitle) {
        outputItems.push({
          excelRowIndex,
          videoId,
          titleFromExcel,
          oldTitle: videoInfo.title,
          newTitle: cleanedNewTitle,
          action: "skip",
          reason: "New title is empty after cleanup",
        });
        willSkipCount += 1;
        continue;
      }

      if (cleanedNewTitle.length > 100) {
        outputItems.push({
          excelRowIndex,
          videoId,
          titleFromExcel,
          oldTitle: videoInfo.title,
          newTitle: cleanedNewTitle,
          action: "skip",
          reason: "New title exceeds 100 characters",
        });
        willSkipCount += 1;
        continue;
      }

      const cleanedOldTitle = cleanupTitle(videoInfo.title);
      if (cleanedNewTitle === cleanedOldTitle) {
        outputItems.push({
          excelRowIndex,
          videoId,
          titleFromExcel,
          oldTitle: videoInfo.title,
          newTitle: videoInfo.title,
          action: "skip",
          reason: "Title unchanged",
        });
        willSkipCount += 1;
        continue;
      }

      outputItems.push({
        excelRowIndex,
        videoId,
        titleFromExcel,
        oldTitle: videoInfo.title,
        newTitle: cleanedNewTitle,
        action: "update",
        reason: "",
      });
      willUpdateCount += 1;
    } catch (err) {
      outputItems.push({
        excelRowIndex,
        videoId: videoId || null,
        titleFromExcel,
        oldTitle: null,
        newTitle: null,
        action: "skip",
        reason: `Error during dry run: ${err.message}`,
      });
      willSkipCount += 1;
    }
  }

  const session = await DryRunSession.create({
    channelId,
    totalRows: (items || []).length,
    willUpdateCount,
    willSkipCount,
    items: outputItems,
  });

  return session;
}

export async function createJobsFromSession(sessionId) {
  const session = await DryRunSession.findById(sessionId).lean();
  if (!session) {
    throw new Error("Dry run session not found");
  }

  const jobsToInsert = session.items
    .filter((item) => item.action === "update")
    .map((item) => ({
      channelId: session.channelId,
      excelRowIndex: item.excelRowIndex,
      videoId: item.videoId,
      titleFromExcel: item.titleFromExcel,
      oldTitle: item.oldTitle,
      newTitle: item.newTitle,
      status: "pending",
      sessionId: session._id,
    }));

  if (!jobsToInsert.length) return { created: 0 };

  const inserted = await Job.insertMany(jobsToInsert);
  return { created: inserted.length };
}

export async function processPendingJobsForToday(channelId) {
  if (!channelId) {
    throw new Error("channelId is required for processing jobs");
  }
  const youtube = await getAuthorizedYoutubeClientForChannel(channelId);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const processedToday = await Job.countDocuments({
    channelId,
    processedAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const remaining = Math.max(DAILY_JOB_LIMIT - processedToday, 0);
  if (remaining <= 0) {
    return { processed: 0, remaining: 0, limit: DAILY_JOB_LIMIT };
  }

  const pendingJobs = await Job.find({ channelId, status: "pending" })
    .sort({ createdAt: 1 })
    .limit(remaining)
    .exec();

  let processedCount = 0;

  for (const job of pendingJobs) {
    try {
      const snippet = await fetchVideoSnippetById(youtube, job.videoId);
      if (!snippet) {
        job.status = "failed";
        job.errorMessage = "Video not found during processing";
        job.processedAt = new Date();
        await job.save();
        processedCount += 1;
        continue;
      }

      const desiredTitle = cleanupTitle(job.newTitle);
      if (!desiredTitle) {
        job.status = "failed";
        job.errorMessage = "New title is empty after cleanup";
        job.oldTitle = snippet.title;
        job.processedAt = new Date();
        await job.save();
        processedCount += 1;
        continue;
      }

      if (desiredTitle.length > 100) {
        job.status = "failed";
        job.errorMessage = "New title exceeds 100 characters";
        job.oldTitle = snippet.title;
        job.processedAt = new Date();
        await job.save();
        processedCount += 1;
        continue;
      }

      if (cleanupTitle(snippet.title) === desiredTitle) {
        job.status = "skipped";
        job.oldTitle = snippet.title;
        job.newTitle = snippet.title;
        job.processedAt = new Date();
        await job.save();
        processedCount += 1;
        continue;
      }

      await youtube.videos.update({
        part: ["snippet"],
        requestBody: {
          id: job.videoId,
          snippet: {
            title: desiredTitle,
            description: snippet.description,
            categoryId: snippet.categoryId,
          },
        },
      });

      job.status = "updated";
      job.oldTitle = snippet.title;
      job.newTitle = desiredTitle;
      job.processedAt = new Date();
      await job.save();
      processedCount += 1;
    } catch (err) {
      const isQuotaError =
        err?.errors?.some?.(
          (e) =>
            e.reason === "quotaExceeded" ||
            e.reason === "userRateLimitExceeded",
        ) || err?.code === 403;

      if (isQuotaError) {
        // Leave current job as pending and stop for today; will resume next run.
        break;
      }

      job.status = "failed";
      job.errorMessage = err.message || "Unknown error";
      job.processedAt = new Date();
      await job.save();
      processedCount += 1;
    }
  }

  return {
    processed: processedCount,
    remaining: Math.max(DAILY_JOB_LIMIT - (processedToday + processedCount), 0),
    limit: DAILY_JOB_LIMIT,
  };
}

export async function getSummary(channelId) {
  const filter = channelId ? { channelId } : {};
  const [pending, updated, skipped, failed, total] = await Promise.all([
    Job.countDocuments({ ...filter, status: "pending" }),
    Job.countDocuments({ ...filter, status: "updated" }),
    Job.countDocuments({ ...filter, status: "skipped" }),
    Job.countDocuments({ ...filter, status: "failed" }),
    Job.countDocuments(filter),
  ]);

  return { pending, updated, skipped, failed, total };
}
