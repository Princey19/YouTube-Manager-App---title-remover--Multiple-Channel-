import React from "react";

export default function ExcelUpload({
  file,
  onFileChange,
  onLoad,
  loading,
  loadedCount,
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Upload Excel File</h2>
        <p className="card-subtitle">
          Columns must include: <strong>videoId</strong> (or <strong>Id</strong>
          ) and <strong>title</strong>.
        </p>
      </div>
      <div className="card-body">
        <div className="field">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
          {file && <p className="hint">Selected: {file.name}</p>}
        </div>

        <div className="actions-row">
          <button
            className="btn primary"
            type="button"
            onClick={onLoad}
            disabled={!file || loading}
          >
            {loading ? "Loading…" : "Load Titles"}
          </button>
          {typeof loadedCount === "number" && (
            <span className="hint">Loaded rows: {loadedCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}
