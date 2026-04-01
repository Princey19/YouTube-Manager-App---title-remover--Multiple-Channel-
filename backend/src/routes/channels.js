import express from "express";
import Channel from "../models/Channel.js";

const router = express.Router();

/**
 * GET /api/channels
 * Returns all connected YouTube channels for the channel selector.
 * Deduplicates by channelId, returning the most recently authorized record per channel.
 */
router.get("/", async (req, res) => {
  try {
    const channels = await Channel.aggregate([
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: "$channelId",
          channelId: { $first: "$channelId" },
          channelName: { $first: "$channelName" },
          googleEmail: { $first: "$googleEmail" },
          createdAt: { $first: "$created_at" },
        },
      },
      { $sort: { channelName: 1 } },
      { $project: { _id: 0, channelId: 1, channelName: 1, googleEmail: 1, createdAt: 1 } },
    ]);

    res.json(channels);
  } catch (err) {
    console.error("Channels list error", err);
    res.status(500).json({
      error: "Failed to load channels",
      details: err.message,
    });
  }
});

export default router;
