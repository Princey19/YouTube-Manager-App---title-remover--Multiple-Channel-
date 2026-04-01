import React from "react";

export default function LogsTable({
  logs,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  onDownloadCsv,
  loading,
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Logs</h2>
        <p className="card-subtitle">
          View per-video update history and export a CSV report.
        </p>
      </div>
      <div className="card-body">
        <div className="actions-row">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="updated">Updated</option>
            <option value="skipped">Skipped</option>
            <option value="failed">Failed</option>
          </select>
          <button className="btn" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className="btn ghost"
            onClick={() => onDownloadCsv(statusFilter)}
          >
            Download
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Video Id</th>
                <th>Old Title</th>
                <th>New Title</th>
                <th>Status</th>
                <th>Error</th>
                <th>Processed At</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", padding: "1rem" }}
                  >
                    No logs yet.
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr key={item._id}>
                    <td>{item.videoId}</td>
                    <td>{item.oldTitle || "—"}</td>
                    <td>{item.newTitle || "—"}</td>
                    <td>{item.status}</td>
                    <td>{item.errorMessage || "—"}</td>
                    <td>
                      {item.processedAt
                        ? new Date(item.processedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
