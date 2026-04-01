import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import Job from "../models/Job.js";
import DryRunSession from "../models/DryRunSession.js";
import {
  cleanupTitle,
  createDryRunSessionFromEdits,
  createJobsFromSession,
  processPendingJobsForToday,
  getSummary,
} from "../services/jobService.js";
import { stringify } from "csv-stringify";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/load-excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Excel file is required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      return res.status(400).json({ error: "Excel file is empty" });
    }
    // Map headers case-insensitively to supported logical names
    const headerMap = {};
    const firstRowKeys = Object.keys(rows[0]);
    for (const key of firstRowKeys) {
      const lower = key.toLowerCase();
      if (
        ["videoid", "id", "title"].includes(lower) &&
        !headerMap[lower]
      ) {
        headerMap[lower] = key;
      }
    }

    const idHeaderKey = headerMap.videoid || headerMap.id;
    const missing = [];
    if (!idHeaderKey) missing.push("videoId (or Id)");
    if (!headerMap.title) missing.push("title");
    if (missing.length) {
      return res.status(400).json({
        error: `Missing required columns (case-insensitive): ${missing.join(
          ", ",
        )}`,
      });
    }

    const normalizedRows = rows.map((row, idx) => ({
      excelRowIndex: idx + 1,
      videoId: (row[idHeaderKey] || "").toString().trim(),
      title: (row[headerMap.title] || "").toString(),
    }));

    res.json({ totalRows: normalizedRows.length, rows: normalizedRows });
  } catch (err) {
    console.error("Load-excel error", err);
    res.status(500).json({ error: "Failed to load Excel", details: err.message });
  }
});

router.post("/dry-run", async (req, res) => {
  try {
    const channelId = req.body.channelId;
    const items = req.body.items;
    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array is required" });
    }

    const normalizedItems = items.map((it, idx) => ({
      excelRowIndex: it.excelRowIndex || idx + 1,
      videoId: (it.videoId || "").toString().trim(),
      titleFromExcel: (it.titleFromExcel ?? it.title ?? "").toString(),
      newTitle: cleanupTitle(it.newTitle ?? ""),
    }));

    const session = await createDryRunSessionFromEdits(normalizedItems, channelId);
    const preview = session.items.slice(0, 20);
    res.json({
      sessionId: session._id,
      totalRows: session.totalRows,
      willUpdateCount: session.willUpdateCount,
      willSkipCount: session.willSkipCount,
      preview,
    });
  } catch (err) {
    console.error("Dry-run error", err);
    res.status(500).json({ error: "Dry run failed", details: err.message });
  }
});

router.post("/start", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const session = await DryRunSession.findById(sessionId).lean();
    if (!session) {
      return res.status(404).json({ error: "Dry run session not found" });
    }

    const { created } = await createJobsFromSession(sessionId);
    res.json({ created });
  } catch (err) {
    console.error("Start jobs error", err);
    res
      .status(500)
      .json({ error: "Failed to create jobs", details: err.message });
  }
});

router.post("/process-now", async (req, res) => {
  try {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }
    const result = await processPendingJobsForToday(channelId);
    res.json(result);
  } catch (err) {
    console.error("Process-now error", err);
    res.status(500).json({ error: "Processing failed", details: err.message });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const channelId = req.query.channelId;
    const summary = await getSummary(channelId);
    res.json(summary);
  } catch (err) {
    console.error("Summary error", err);
    res
      .status(500)
      .json({ error: "Failed to load summary", details: err.message });
  }
});

router.get("/logs", async (req, res) => {
  try {
    const status = req.query.status;
    const channelId = req.query.channelId;
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const skip = (page - 1) * limit;

    const filter = {};
    if (channelId) filter.channelId = channelId;
    if (
      status &&
      ["pending", "updated", "skipped", "failed"].includes(status)
    ) {
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Job.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page,
      pageSize: limit,
    });
  } catch (err) {
    console.error("Logs error", err);
    res
      .status(500)
      .json({ error: "Failed to load logs", details: err.message });
  }
});

router.get("/report.csv", async (req, res) => {
  try {
    const status = req.query.status;
    const channelId = req.query.channelId;
    const filter = {};
    if (channelId) filter.channelId = channelId;
    if (
      status &&
      ["pending", "updated", "skipped", "failed"].includes(status)
    ) {
      filter.status = status;
    }

    const jobs = await Job.find(filter).sort({ createdAt: -1 }).lean();

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="youtube-title-optimizer-report.csv"',
    );

    const stringifier = stringify({
      header: true,
      columns: [
        "channelId",
        "videoId",
        "excelRowIndex",
        "titleFromExcel",
        "oldTitle",
        "newTitle",
        "status",
        "errorMessage",
        "createdAt",
        "processedAt",
      ],
    });

    stringifier.pipe(res);
    for (const job of jobs) {
      stringifier.write({
        channelId: job.channelId || "",
        videoId: job.videoId,
        excelRowIndex: job.excelRowIndex,
        titleFromExcel: job.titleFromExcel,
        oldTitle: job.oldTitle,
        newTitle: job.newTitle,
        status: job.status,
        errorMessage: job.errorMessage || "",
        createdAt: job.createdAt?.toISOString?.() || "",
        processedAt: job.processedAt?.toISOString?.() || "",
      });
    }
    stringifier.end();
  } catch (err) {
    console.error("CSV report error", err);
    res
      .status(500)
      .json({ error: "Failed to generate CSV", details: err.message });
  }
});

router.get("/dry-run/:sessionId/report.csv", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const action = req.query.action;

    const session = await DryRunSession.findById(sessionId).lean();
    if (!session) {
      return res.status(404).json({ error: "Dry run session not found" });
    }

    let items = session.items || [];
    if (action && ["update", "skip"].includes(action)) {
      items = items.filter((item) => item.action === action);
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="youtube-title-optimizer-dry-run-${sessionId}.csv"`,
    );

    const stringifier = stringify({
      header: true,
      columns: [
        "excelRowIndex",
        "videoId",
        "titleFromExcel",
        "oldTitle",
        "newTitle",
        "action",
        "reason",
      ],
    });

    stringifier.pipe(res);
    for (const item of items) {
      stringifier.write({
        excelRowIndex: item.excelRowIndex,
        videoId: item.videoId || "",
        titleFromExcel: item.titleFromExcel || "",
        oldTitle: item.oldTitle || "",
        newTitle: item.newTitle || "",
        action: item.action || "",
        reason: item.reason || "",
      });
    }
    stringifier.end();
  } catch (err) {
    console.error("Dry-run CSV report error", err);
    res.status(500).json({
      error: "Failed to generate dry-run CSV",
      details: err.message,
    });
  }
});

export default router;
