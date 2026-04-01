import React, { useEffect, useState } from "react";
import ExcelUpload from "./components/ExcelUpload.jsx";
import DryRunPanel from "./components/DryRunPanel.jsx";
import LogsTable from "./components/LogsTable.jsx";
import ChannelSelector from "./components/ChannelSelector.jsx";
import TitleEditor from "./components/TitleEditor.jsx";
import {
  loadExcel,
  dryRun,
  startUpdate,
  processNow,
  fetchSummary,
  fetchLogs,
  downloadCsv,
  downloadDryRunCsv,
} from "./api/jobs.js";
import { cleanupTitle, removeSelectedWordIndexes } from "./utils/title.js";

export default function App() {
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [file, setFile] = useState(null);
  const [loadedRows, setLoadedRows] = useState([]);
  const [editsByVideoId, setEditsByVideoId] = useState({});
  const [dryRunResult, setDryRunResult] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");

  const [loadingLoad, setLoadingLoad] = useState(false);
  const [loadingDryRun, setLoadingDryRun] = useState(false);
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingProcess, setLoadingProcess] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function loadChannels() {
    try {
      const { fetchChannels } = await import("./api/channels.js");
      const res = await fetchChannels();
      const list = res.data || [];
      setChannels(list);
      setSelectedChannelId((prev) => {
        if (!list.length) return "";
        if (!prev || !list.some((c) => c.channelId === prev)) {
          return list[0].channelId;
        }
        return prev;
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function loadSummary() {
    if (!selectedChannelId) return;
    try {
      const res = await fetchSummary(selectedChannelId);
      setSummary(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadLogs() {
    try {
      setLoadingLogs(true);
      const res = await fetchLogs({
        channelId: selectedChannelId || undefined,
        status: statusFilter || undefined,
        limit: 100,
      });
      setLogs(res.data.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (selectedChannelId) {
      loadSummary();
      loadLogs();
    }
    const interval = setInterval(() => {
      if (selectedChannelId) {
        loadSummary();
        loadLogs();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedChannelId]);

  useEffect(() => {
    loadLogs();
  }, [statusFilter, selectedChannelId]);

  const handleLoadExcel = async () => {
    if (!file) {
      setError("Please select an Excel file first.");
      return;
    }
    setError("");
    setInfo("");
    setLoadingLoad(true);
    try {
      const res = await loadExcel(file);
      const rows = res.data.rows || [];
      setLoadedRows(rows);
      setEditsByVideoId({});
      setDryRunResult(null);
      setSessionId(null);
      setInfo(
        `Loaded ${rows.length} rows. Edit titles below, then run Dry Run.`,
      );
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || "Failed to load Excel.");
    } finally {
      setLoadingLoad(false);
    }
  };

  const handleDryRun = async () => {
    if (!selectedChannelId) {
      setError("Please select a YouTube channel first.");
      return;
    }
    if (!loadedRows.length) {
      setError("Load an Excel file first.");
      return;
    }
    setError("");
    setInfo("");
    setLoadingDryRun(true);
    try {
      const items = loadedRows.map((row, idx) => {
        const selectedIndexes =
          editsByVideoId[row.videoId]?.selectedIndexes || [];
        const proposed = removeSelectedWordIndexes(
          row.title || "",
          selectedIndexes,
        );
        return {
          excelRowIndex: row.excelRowIndex || idx + 1,
          videoId: row.videoId,
          titleFromExcel: row.title || "",
          newTitle: cleanupTitle(proposed),
        };
      });

      const res = await dryRun(selectedChannelId, items);
      setDryRunResult(res.data);
      setSessionId(res.data.sessionId);
      setInfo(
        "Dry run completed. Review changes, then click Start Update to create jobs.",
      );
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || "Run failed.");
    } finally {
      setLoadingDryRun(false);
    }
  };

  const handleStartUpdate = async () => {
    if (!sessionId) {
      setError("Run a dry run first.");
      return;
    }
    setError("");
    setInfo("");
    if (
      !window.confirm("Create update jobs based on the current runned results?")
    ) {
      return;
    }
    setLoadingStart(true);
    try {
      const res = await startUpdate(sessionId);
      setInfo(`Created ${res.data.created} jobs.`);
      await loadSummary();
      await loadLogs();
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || "Failed to create jobs.");
    } finally {
      setLoadingStart(false);
    }
  };

  const handleProcessNow = async () => {
    if (!selectedChannelId) {
      setError("Please select a YouTube channel first.");
      return;
    }
    setError("");
    setInfo("");
    setLoadingProcess(true);
    try {
      const res = await processNow(selectedChannelId);
      setInfo(`Processed ${res.data.processed} jobs in this run.`);
      await loadSummary();
      await loadLogs();
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || "Processing failed.");
    } finally {
      setLoadingProcess(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>YouTube Title Optimizer</h1>
          <p className="subtitle">
            Shorten YouTube titles by removing selected words (max 100 chars).
          </p>
        </div>
      </header>
      <main className="app-main">
        {(error || info) && (
          <div className="messages">
            {error && <div className="message error">{error}</div>}
            {info && <div className="message info">{info}</div>}
          </div>
        )}
        <ChannelSelector
          channels={channels}
          selectedChannelId={selectedChannelId}
          onChannelChange={setSelectedChannelId}
          onRefresh={loadChannels}
        />
        <section className="layout-grid">
          <div className="column">
            <ExcelUpload
              file={file}
              onFileChange={setFile}
              onLoad={handleLoadExcel}
              loading={loadingLoad}
              loadedCount={loadedRows.length || 0}
            />
            {loadedRows.length > 0 && (
              <TitleEditor
                rows={loadedRows}
                editsByVideoId={editsByVideoId}
                onEditChange={(videoId, patch) =>
                  setEditsByVideoId((prev) => ({
                    ...prev,
                    [videoId]: { ...(prev[videoId] || {}), ...patch },
                  }))
                }
              />
            )}
            <DryRunPanel
              dryRunResult={dryRunResult}
              onDryRun={handleDryRun}
              onStartUpdate={handleStartUpdate}
              onProcessNow={handleProcessNow}
              onDownloadDryRunCsv={(action) =>
                sessionId ? downloadDryRunCsv(sessionId, action) : null
              }
              loadingDryRun={loadingDryRun}
              loadingStart={loadingStart}
              loadingProcess={loadingProcess}
              summary={summary}
            />
          </div>
          <div className="column">
            <LogsTable
              logs={logs}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onRefresh={loadLogs}
              onDownloadCsv={(status) => downloadCsv(status, selectedChannelId)}
              loading={loadingLogs}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
