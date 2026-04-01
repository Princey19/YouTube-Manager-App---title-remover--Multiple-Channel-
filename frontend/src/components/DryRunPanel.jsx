import React from "react";

export default function DryRunPanel({
  dryRunResult,
  onDryRun,
  onStartUpdate,
  onProcessNow,
  onDownloadDryRunCsv,
  loadingDryRun,
  loadingStart,
  loadingProcess,
  summary,
}) {
  const hasDryRun = !!dryRunResult;
  const percentComplete =
    summary && summary.total
      ? Math.round(
          ((summary.updated + summary.skipped + summary.failed) /
            summary.total) *
            100,
        )
      : 0;

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Run & Processing</h2>
        <p className="card-subtitle">
          Dry run to preview changes before scheduling updates.
        </p>
      </div>
      <div className="card-body">
        <div className="actions-row">
          <button
            className="btn primary"
            onClick={onDryRun}
            disabled={loadingDryRun}
          >
            {loadingDryRun ? "Running…" : "Dry Run"}
          </button>
          <button
            className="btn"
            onClick={onStartUpdate}
            disabled={!hasDryRun || loadingStart}
          >
            {loadingStart ? "Processing…" : "Start Update"}
          </button>
          <button
            className="btn ghost"
            onClick={onProcessNow}
            disabled={loadingProcess}
          >
            {loadingProcess ? "Processing…" : "Process Now"}
          </button>
        </div>

        {dryRunResult && (
          <div className="dryrun-summary">
            <h3>Dry Run Summary</h3>
            <div className="stats-row">
              <div className="stat">
                <span className="stat-label">Total in Excel</span>
                <span className="stat-value">{dryRunResult.totalRows}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Will Update</span>
                <span className="stat-value highlight">
                  {dryRunResult.willUpdateCount}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Will Be Skipped</span>
                <span className="stat-value">{dryRunResult.willSkipCount}</span>
              </div>
            </div>

            <div className="actions-row" style={{ marginTop: "0.75rem" }}>
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  onDownloadDryRunCsv && onDownloadDryRunCsv("skip")
                }
              >
                Download Skipped Rows
              </button>
            </div>

            <div className="table-wrapper">
              <h4>Preview (first 20 rows)</h4>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Video Id</th>
                    <th>Excel Title</th>
                    <th>Current YouTube Title</th>
                    <th>New Title</th>
                    <th>Action</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {dryRunResult.preview.map((item) => (
                    <tr key={item.excelRowIndex}>
                      <td>{item.excelRowIndex}</td>
                      <td>{item.videoId || "—"}</td>
                      <td>{item.titleFromExcel || "—"}</td>
                      <td>{item.oldTitle || "—"}</td>
                      <td>{item.newTitle || "—"}</td>
                      <td>{item.action}</td>
                      <td>{item.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {summary && (
          <div className="progress-section">
            <h3>Processing Progress</h3>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
            <div className="stats-row small">
              <div className="stat">
                <span className="stat-label">Pending</span>
                <span className="stat-value">{summary.pending}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Updated</span>
                <span className="stat-value">{summary.updated}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Skipped</span>
                <span className="stat-value">{summary.skipped}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Failed</span>
                <span className="stat-value">{summary.failed}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Total Jobs</span>
                <span className="stat-value">{summary.total}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
