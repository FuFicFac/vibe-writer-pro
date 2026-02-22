import React, { useEffect, useMemo, useState } from 'react';
import { History, Save, RotateCcw, Copy, X } from 'lucide-react';
import clsx from 'clsx';
import useStore from '../store/useStore';

export default function VersionHistoryModal({ isOpen, onClose, documentId }) {
  const {
    documents,
    getDocumentSnapshots,
    createDocumentSnapshot,
    restoreDocumentSnapshot,
    duplicateDocumentSnapshotAsDocument,
  } = useStore();

  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const activeDocument = documents.find((d) => d.id === documentId) || null;
  const snapshots = useMemo(
    () => (documentId ? getDocumentSnapshots(documentId) : []),
    [documentId, documents, getDocumentSnapshots]
  );

  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage('');
    setSelectedSnapshotId((prev) => {
      if (prev && snapshots.some((s) => s.id === prev)) return prev;
      return snapshots[0]?.id || null;
    });
  }, [isOpen, snapshots]);

  if (!isOpen) return null;

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId) || null;

  const handleSaveVersion = () => {
    if (!documentId) return;
    createDocumentSnapshot(documentId, { source: 'manual', label: 'Manual save' });
    setStatusMessage('Saved a new version snapshot');
  };

  const handleRestore = async () => {
    if (!documentId || !selectedSnapshot) return;
    const confirmed = window.confirm('Restore this version and overwrite the current document content? A safety snapshot of the current version will be saved first.');
    if (!confirmed) return;

    setIsWorking(true);
    try {
      createDocumentSnapshot(documentId, { source: 'manual', label: 'Pre-restore backup' });
      restoreDocumentSnapshot(documentId, selectedSnapshot.id);
      setStatusMessage('Version restored');
    } finally {
      setIsWorking(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedSnapshot) return;
    setIsWorking(true);
    try {
      duplicateDocumentSnapshotAsDocument(selectedSnapshot.id);
      setStatusMessage('Restored version duplicated as a new document');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#001024]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-xl border border-[#001024] bg-seahawks-navy shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-[#001024] bg-seahawks-navy/60 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-xl flex items-center gap-2">
              <History size={18} className="text-seahawks-green" />
              Version History
            </h2>
            <p className="text-sm text-seahawks-gray mt-1">
              {activeDocument ? `Snapshots for ${activeDocument.name}` : 'Open a document to view version history.'}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-md text-seahawks-gray hover:text-white hover:bg-[#001730] flex items-center justify-center transition-colors" title="Close">
            <X size={18} />
          </button>
        </div>

        {!activeDocument ? (
          <div className="p-8 text-center text-seahawks-gray">No active document selected.</div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-[#001024] bg-[#001730] flex flex-col">
              <div className="p-4 border-b border-[#001024]">
                <button
                  onClick={handleSaveVersion}
                  disabled={isWorking}
                  className="w-full px-3 py-2 rounded-md text-sm font-semibold bg-seahawks-green text-[#001024] hover:bg-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={14} />
                  Save Version Now
                </button>
                <div className="mt-2 text-[11px] text-seahawks-gray">
                  Auto-snapshots are also captured while writing.
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {snapshots.length === 0 ? (
                  <div className="rounded-lg border border-seahawks-gray/10 bg-seahawks-navy/40 p-4 text-sm text-seahawks-gray">
                    No versions yet. Save a manual version or keep writing to trigger auto-snapshots.
                  </div>
                ) : (
                  snapshots.map((snapshot) => (
                    <button
                      key={snapshot.id}
                      onClick={() => setSelectedSnapshotId(snapshot.id)}
                      className={clsx(
                        'w-full text-left rounded-lg border p-3 transition-colors',
                        snapshot.id === selectedSnapshotId
                          ? 'border-seahawks-green/30 bg-seahawks-green/5'
                          : 'border-seahawks-gray/10 bg-seahawks-navy/40 hover:border-seahawks-gray/30'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-white font-semibold truncate">
                          {formatSnapshotTime(snapshot.createdAt)}
                        </span>
                        <span className={clsx(
                          'text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide',
                          snapshot.source === 'manual'
                            ? 'text-seahawks-green border-seahawks-green/30 bg-seahawks-green/10'
                            : 'text-seahawks-gray border-seahawks-gray/20'
                        )}>
                          {snapshot.source || 'auto'}
                        </span>
                      </div>
                      {snapshot.label ? (
                        <div className="mt-1 text-[11px] text-seahawks-green/90 truncate">{snapshot.label}</div>
                      ) : null}
                      <div className="mt-1 text-[11px] text-seahawks-gray">
                        {(snapshot.wordCount || 0).toLocaleString()} words • {(snapshot.tokenCount || 0).toLocaleString()} tokens
                      </div>
                      <div className="mt-2 text-[11px] text-seahawks-gray/90 line-clamp-2">
                        {snapshot.textPreview || '(No preview text)'}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-seahawks-gray font-bold">Preview</div>
                  <div className="text-sm text-white mt-1">
                    {selectedSnapshot ? (selectedSnapshot.label || selectedSnapshot.documentName || activeDocument.name) : 'Select a version'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDuplicate}
                    disabled={!selectedSnapshot || isWorking}
                    className={clsx(
                      'px-3 py-2 rounded-md text-sm border transition-colors flex items-center gap-2',
                      selectedSnapshot && !isWorking
                        ? 'border-seahawks-green/30 text-seahawks-green hover:bg-seahawks-green/10'
                        : 'border-seahawks-gray/10 text-seahawks-gray cursor-not-allowed'
                    )}
                  >
                    <Copy size={14} />
                    Duplicate as New Doc
                  </button>
                  <button
                    onClick={handleRestore}
                    disabled={!selectedSnapshot || isWorking}
                    className={clsx(
                      'px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2',
                      selectedSnapshot && !isWorking
                        ? 'bg-white text-[#001024] hover:bg-seahawks-green'
                        : 'bg-seahawks-gray/10 text-seahawks-gray cursor-not-allowed'
                    )}
                  >
                    <RotateCcw size={14} />
                    Restore Version
                  </button>
                </div>
              </div>

              <div className="flex-1 rounded-lg border border-[#001024] bg-[#001024] p-4 overflow-y-auto">
                {selectedSnapshot ? (
                  <div className="text-sm text-white whitespace-pre-wrap break-words">
                    {snapshotPreviewText(selectedSnapshot)}
                  </div>
                ) : (
                  <div className="text-sm text-seahawks-gray">Choose a snapshot from the left to preview it.</div>
                )}
              </div>

              <div className="mt-3 text-xs text-seahawks-gray min-h-5">
                {statusMessage}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatSnapshotTime(value) {
  if (!value) return 'Unknown time';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown time';
  return d.toLocaleString();
}

function snapshotPreviewText(snapshot) {
  const html = snapshot?.content || '';
  if (!html) return '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const text = doc.body?.textContent || '';
    return text.trim() || '(No text content)';
  } catch {
    return snapshot?.textPreview || '(Preview unavailable)';
  }
}
