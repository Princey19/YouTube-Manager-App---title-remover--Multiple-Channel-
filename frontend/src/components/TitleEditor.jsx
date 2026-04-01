import React, { useMemo } from 'react';
import {
  cleanupTitle,
  removeSelectedWordIndexes,
  stripEdgePunctuation,
  tokenizeBySpaces,
} from '../utils/title.js';

function WordChips({ words, selectedIndexes, onToggle }) {
  return (
    <div className="chips">
      {words.map((w, idx) => {
        const selected = selectedIndexes.includes(idx);
        const label = w;
        const normalized = stripEdgePunctuation(w);
        const isSelectable = !!normalized;
        return (
          <button
            key={`${idx}-${label}`}
            type="button"
            className={`chip ${selected ? 'selected' : ''}`}
            onClick={() => (isSelectable ? onToggle(idx) : null)}
            disabled={!isSelectable}
            title={isSelectable ? 'Click to remove/restore' : 'Not a word'}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function TitleEditor({ rows, editsByVideoId, onEditChange }) {
  const computed = useMemo(() => {
    return rows.map((row) => {
      const videoId = row.videoId;
      const originalTitle = row.title || '';
      const words = tokenizeBySpaces(originalTitle);
      const selectedIndexes = editsByVideoId[videoId]?.selectedIndexes || [];
      const newTitle = removeSelectedWordIndexes(originalTitle, selectedIndexes);
      const originalClean = cleanupTitle(originalTitle);
      const changed = cleanupTitle(newTitle) !== originalClean;
      return {
        ...row,
        words,
        selectedIndexes,
        newTitle,
        changed,
        originalLength: originalClean.length,
        newLength: newTitle.length,
        valid: newTitle.length > 0 && newTitle.length <= 100,
      };
    });
  }, [rows, editsByVideoId]);

  const summary = useMemo(() => {
    let modified = 0;
    let unchanged = 0;
    let invalid = 0;
    for (const r of computed) {
      if (!r.valid) invalid += 1;
      if (r.changed) modified += 1;
      else unchanged += 1;
    }
    return { total: computed.length, modified, unchanged, invalid };
  }, [computed]);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Title Editor</h2>
        <p className="card-subtitle">
          Click words to remove them. Titles must be under 100 characters.
        </p>
      </div>
      <div className="card-body">
        <div className="stats-row">
          <div className="stat">
            <span className="stat-label">Loaded</span>
            <span className="stat-value">{summary.total}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Modified</span>
            <span className="stat-value highlight">{summary.modified}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Unchanged</span>
            <span className="stat-value">{summary.unchanged}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Invalid</span>
            <span className="stat-value warn">{summary.invalid}</span>
          </div>
        </div>

        <div className="editor-list">
          {computed.map((row) => (
            <div key={row.videoId} className="editor-row">
              <div className="editor-meta">
                <div className="mono">videoId: {row.videoId}</div>
                <div className="counter">
                  <span className="muted">Original</span>{' '}
                  <strong>{row.originalLength}</strong>
                  <span className="muted"> → New</span>{' '}
                  <strong className={row.newLength > 100 ? 'text-bad' : ''}>
                    {row.newLength}
                  </strong>
                  <span className="muted">/100</span>
                </div>
              </div>

              <div className="editor-original">
                <div className="label">Original</div>
                <div className="text">{row.title}</div>
              </div>

              <WordChips
                words={row.words}
                selectedIndexes={row.selectedIndexes}
                onToggle={(idx) => {
                  const prev = editsByVideoId[row.videoId]?.selectedIndexes || [];
                  const set = new Set(prev);
                  if (set.has(idx)) set.delete(idx);
                  else set.add(idx);
                  onEditChange(row.videoId, { selectedIndexes: Array.from(set).sort((a, b) => a - b) });
                }}
              />

              <div className="editor-preview">
                <div className="label">Preview</div>
                <div className={`text ${row.valid ? '' : 'text-bad'}`}>{row.newTitle || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

