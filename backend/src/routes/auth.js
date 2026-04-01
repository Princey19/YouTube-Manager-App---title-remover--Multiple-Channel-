import express from "express";
import { google } from "googleapis";
import { createOAuthClient } from "../config/youtubeClient.js";
import Channel from "../models/Channel.js";

const router = express.Router();

// Scopes for managing YouTube content and basic profile (email)
const SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

router.get("/url", (req, res) => {
  const oAuth2Client = createOAuthClient();
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
  });
  res.json({ url: authUrl });
});

router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send("Missing code parameter");
    }

    const oAuth2Client = createOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);

    oAuth2Client.setCredentials(tokens);

    // Fetch basic user info to capture Google account email
    const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
    const userInfoResponse = await oauth2.userinfo.get();
    const googleEmail = userInfoResponse.data.email || null;

    // Fetch all channels for this authenticated account
    const youtube = google.youtube({ version: "v3", auth: oAuth2Client });
    const channelsResponse = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });

    const items = channelsResponse.data.items || [];
    if (!items.length) {
      return res
        .status(400)
        .send("No YouTube channels found for this Google account.");
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      console.warn(
        "OAuth callback completed but no refresh token was returned. Ensure access_type=offline and prompt=consent are configured.",
      );
    }

    const normalizedChannels = items
      .filter((item) => item && item.id && item.snippet?.title)
      .map((item) => ({
        channelId: item.id,
        channelName: item.snippet.title,
      }));

    if (!normalizedChannels.length) {
      return res
        .status(400)
        .send("Unable to extract channel information from YouTube.");
    }

    // If Google doesn't return a refresh token (common on re-auth), reuse the latest stored one.
    const channelIds = normalizedChannels.map((c) => c.channelId);
    const existingDocs = await Channel.find({ channelId: { $in: channelIds } })
      .sort({ created_at: -1 })
      .lean();

    const existingRefreshByChannelId = new Map();
    for (const doc of existingDocs) {
      if (
        doc &&
        doc.channelId &&
        typeof doc.refreshToken === "string" &&
        doc.refreshToken &&
        !existingRefreshByChannelId.has(doc.channelId)
      ) {
        existingRefreshByChannelId.set(doc.channelId, doc.refreshToken);
      }
    }

    const ops = [];
    const skipped = [];
    for (const ch of normalizedChannels) {
      const finalRefreshToken =
        refreshToken || existingRefreshByChannelId.get(ch.channelId) || "";

      // Without a refresh token we can't support background jobs; don't create invalid documents.
      if (!finalRefreshToken) {
        skipped.push(ch.channelId);
        continue;
      }

      ops.push({
        updateOne: {
          filter: { channelId: ch.channelId },
          update: {
            $set: {
              channelName: ch.channelName,
              googleEmail,
              accessToken: accessToken || "",
              refreshToken: finalRefreshToken,
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length) {
      await Channel.bulkWrite(ops, { ordered: false });
    }

    if (skipped.length) {
      console.warn(
        `OAuth callback: skipped saving ${skipped.length} channel(s) because no refresh token was available.`,
        { skipped },
      );
    }

    res.send(
      "YouTube authorization successful. You can close this window and return to the internal tool.",
    );
  } catch (err) {
    console.error("OAuth callback error", err);
    res.status(500).send("OAuth callback failed");
  }
});

export default router;
