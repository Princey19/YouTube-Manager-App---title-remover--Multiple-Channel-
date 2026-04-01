import { google } from "googleapis";
import Channel from "../models/Channel.js";

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI,
  );
}

/**
 * Returns an authorized YouTube client for a specific channel.
 * Uses the most recently created Channel document matching the given channelId.
 */
export async function getAuthorizedYoutubeClientForChannel(channelId) {
  if (!channelId) {
    throw new Error(
      "channelId is required to create an authorized YouTube client.",
    );
  }

  const channelDoc = await Channel.findOne({ channelId })
    .sort({ created_at: -1 })
    .lean();

  if (!channelDoc || !channelDoc.refreshToken) {
    throw new Error(
      "No stored refresh token found for this channel. Please complete OAuth flow.",
    );
  }

  const oAuth2Client = createOAuthClient();

  oAuth2Client.setCredentials({
    access_token: channelDoc.accessToken,
    refresh_token: channelDoc.refreshToken,
  });

  // When tokens are refreshed, persist the latest ones back to the same channel record
  oAuth2Client.on("tokens", async (tokens) => {
    if (!tokens) return;
    await Channel.updateOne(
      { _id: channelDoc._id },
      {
        $set: {
          accessToken: tokens.access_token || channelDoc.accessToken,
          refreshToken: tokens.refresh_token || channelDoc.refreshToken,
        },
      },
    );
  });

  const youtube = google.youtube({
    version: "v3",
    auth: oAuth2Client,
  });
  const response = await youtube.channels.list({
    part: "snippet",
    mine: true,
  });

  return youtube;
}
