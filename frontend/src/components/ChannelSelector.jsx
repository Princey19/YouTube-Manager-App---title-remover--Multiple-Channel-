import React, { useState } from "react";
import api from "../api/client.js";

export default function ChannelSelector({
  channels,
  selectedChannelId,
  onChannelChange,
  onRefresh,
}) {
  const [connecting, setConnecting] = useState(false);

  async function handleConnectChannel() {
    setConnecting(true);
    try {
      const res = await api.get("/auth/url");
      const url = res.data?.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="card channel-selector">
      <div className="card-header">
        <h2 className="card-title">YouTube Channel</h2>
        <p className="card-subtitle">
          Select the channel to manage. Connect more channels via OAuth.
        </p>
      </div>
      <div className="card-body">
        <div className="field">
          <label className="label">Channel</label>
          <select
            value={selectedChannelId}
            onChange={(e) => onChannelChange(e.target.value)}
            disabled={!channels.length}
          >
            <option value="">
              {channels.length
                ? "Select a channel…"
                : "No channels connected"}
            </option>
            {channels.map((ch) => (
              <option key={ch.channelId} value={ch.channelId}>
                {ch.channelName}
                {ch.googleEmail ? ` (${ch.googleEmail})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="actions-row">
          <button
            type="button"
            className="btn ghost"
            onClick={onRefresh}
          >
            Refresh channels
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={handleConnectChannel}
            disabled={connecting}
          >
            {connecting ? "Opening…" : "Connect new channel"}
          </button>
        </div>
      </div>
    </div>
  );
}
