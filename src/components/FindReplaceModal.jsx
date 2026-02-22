import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';

export default function FindReplaceModal({
  isOpen,
  onClose,
  activeProjectId,
  activeDocumentId,
  folders,
  documents,
  setActiveDocument,
  updateDocumentContent,
  onNavigateToResult,
}) {
  const [query, setQuery] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [scope, setScope] = useState('document'); // 'document' | 'project'
  const [matchCase, setMatchCase] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const projectFolderIds = new Set(folders.filter((f) => f.projectId === activeProjectId).map((f) => f.id));
  const projectDocuments = documents.filter((d) => projectFolderIds.has(d.folderId));
  const activeDocument = documents.find((d) => d.id === activeDocumentId) || null;

  const scopedDocuments = scope === 'document'
    ? (activeDocument ? [activeDocument] : [])
    : projectDocuments;

  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage('');
    runSearch(query, { preserveSelection: false });
  }, [isOpen, scope, matchCase, activeProjectId, activeDocumentId, documents]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    if (scope === 'document' && !activeDocumentId && results.length > 0) {
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen, scope, activeDocumentId, results.length]);

  if (!isOpen) return null;

  const runSearch = (searchValue = query, options = {}) => {
    const { preserveSelection = true } = options;
    const trimmed = searchValue;
    if (!trimmed) {
      setResults([]);
      setSelectedIndex(0);
      setStatusMessage('');
      return;
    }

    const nextResults = [];
    for (const doc of scopedDocuments) {
      const text = getPlainTextFromHtml(doc.content || '');
      const occurrences = findOccurrences(text, trimmed, { matchCase });
      occurrences.forEach((occ, occurrenceIndex) => {
        nextResults.push({
          key: `${doc.id}:${occurrenceIndex}`,
          docId: doc.id,
          docName: doc.name,
          occurrenceIndex,
          start: occ.start,
          end: occ.end,
          snippet: buildSnippet(text, occ.start, occ.end),
        });
      });
    }

    setResults(nextResults);
    setStatusMessage(nextResults.length ? `${nextResults.length} match${nextResults.length === 1 ? '' : 'es'} found` : 'No matches found');

    if (!preserveSelection) {
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex((prev) => Math.min(prev, Math.max(nextResults.length - 1, 0)));
  };

  const selectResult = (index) => {
    const normalized = Math.max(0, Math.min(index, results.length - 1));
    setSelectedIndex(normalized);
    const result = results[normalized];
    if (result?.docId) {
      setActiveDocument(result.docId);
      onNavigateToResult?.({
        docId: result.docId,
        occurrenceIndex: result.occurrenceIndex,
        query,
        matchCase,
      });
    }
  };

  const handleReplaceSelected = (resultOverride = null) => {
    const result = resultOverride || results[selectedIndex];
    if (!result || !query) return;

    const doc = documents.find((d) => d.id === result.docId);
    if (!doc) return;

    const replaced = replaceOccurrenceInHtml(doc.content || '', query, replaceWith, result.occurrenceIndex, { matchCase });
    if (!replaced.changed) {
      setStatusMessage('Could not replace selected match (document may have changed).');
      return;
    }

    updateDocumentContent(doc.id, replaced.html, getPlainTextFromHtml(replaced.html));
    setActiveDocument(doc.id);
    onNavigateToResult?.({
      docId: doc.id,
      occurrenceIndex: result.occurrenceIndex,
      query,
      matchCase,
    });
    setStatusMessage('Replaced 1 match');
    window.setTimeout(() => runSearch(query), 0);
  };

  const handleReplaceAll = () => {
    if (!query) return;
    let total = 0;

    for (const doc of scopedDocuments) {
      const replaced = replaceAllInHtml(doc.content || '', query, replaceWith, { matchCase });
      if (replaced.count > 0) {
        total += replaced.count;
        updateDocumentContent(doc.id, replaced.html, getPlainTextFromHtml(replaced.html));
      }
    }

    setStatusMessage(total > 0 ? `Replaced ${total} match${total === 1 ? '' : 'es'}` : 'No matches replaced');
    window.setTimeout(() => runSearch(query, { preserveSelection: false }), 0);
  };

  const canReplace = !!query && results.length > 0;
  const currentResult = results[selectedIndex] || null;

  return (
    <div className="fixed inset-0 z-50 bg-[#001024]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-xl border border-[#001024] bg-seahawks-navy shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-[#001024] bg-seahawks-navy/60 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-xl flex items-center gap-2">
              <Search size={18} className="text-seahawks-green" />
              Find & Replace
            </h2>
            <p className="text-sm text-seahawks-gray mt-1">
              Search the current document or the entire project and replace one-by-one or all at once.
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-md text-seahawks-gray hover:text-white hover:bg-[#001730] flex items-center justify-center transition-colors" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 border-b border-[#001024] bg-seahawks-navy/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-seahawks-gray font-bold">Find</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch(e.currentTarget.value, { preserveSelection: false }); }}
                placeholder="Search text..."
                className="mt-1 w-full bg-[#001024] border border-seahawks-gray/20 rounded-md py-2.5 px-3 text-sm text-white focus:outline-none focus:border-seahawks-green"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-seahawks-gray font-bold">Replace With</label>
              <input
                value={replaceWith}
                onChange={(e) => setReplaceWith(e.target.value)}
                placeholder="Replacement text..."
                className="mt-1 w-full bg-[#001024] border border-seahawks-gray/20 rounded-md py-2.5 px-3 text-sm text-white focus:outline-none focus:border-seahawks-green"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setScope('document')}
              className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', scope === 'document' ? 'bg-seahawks-green/10 border-seahawks-green/30 text-seahawks-green' : 'border-seahawks-gray/20 text-seahawks-gray hover:text-white')}
            >
              Current Document
            </button>
            <button
              onClick={() => setScope('project')}
              className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', scope === 'project' ? 'bg-seahawks-green/10 border-seahawks-green/30 text-seahawks-green' : 'border-seahawks-gray/20 text-seahawks-gray hover:text-white')}
            >
              Entire Project
            </button>
            <label className="ml-2 flex items-center gap-2 text-xs text-seahawks-gray">
              <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
              Match case
            </label>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button onClick={() => runSearch(query, { preserveSelection: false })} className="px-3 py-2 rounded-md text-sm border border-seahawks-gray/20 text-seahawks-gray hover:text-white hover:bg-[#001730]">
                Find All
              </button>
              <button onClick={handleReplaceSelected} disabled={!canReplace} className={clsx('px-3 py-2 rounded-md text-sm border transition-colors', canReplace ? 'border-seahawks-green/30 text-seahawks-green hover:bg-seahawks-green/10' : 'border-seahawks-gray/10 text-seahawks-gray cursor-not-allowed')}>
                Replace Selected
              </button>
              <button onClick={handleReplaceAll} disabled={!canReplace} className={clsx('px-3 py-2 rounded-md text-sm font-semibold transition-colors', canReplace ? 'bg-white text-[#001024] hover:bg-seahawks-green' : 'bg-seahawks-gray/10 text-seahawks-gray cursor-not-allowed')}>
                Replace All
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-seahawks-gray">{statusMessage || 'Enter text to search'}</span>
            {results.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => selectResult(selectedIndex - 1)} className="px-2 py-1 rounded border border-seahawks-gray/20 text-seahawks-gray hover:text-white">Prev</button>
                <span className="text-seahawks-gray">{selectedIndex + 1} / {results.length}</span>
                <button onClick={() => selectResult(selectedIndex + 1)} className="px-2 py-1 rounded border border-seahawks-gray/20 text-seahawks-gray hover:text-white">Next</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 ? (
            <div className="rounded-lg border border-seahawks-gray/10 bg-[#001730] p-6 text-center text-seahawks-gray">
              No results to display.
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result, index) => (
                <div
                  key={result.key}
                  className={clsx(
                    'rounded-lg border p-3 transition-colors cursor-pointer',
                    index === selectedIndex ? 'border-seahawks-green/30 bg-seahawks-green/5' : 'border-seahawks-gray/10 bg-[#001730] hover:border-seahawks-gray/30'
                  )}
                  onClick={() => selectResult(index)}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-seahawks-gray">
                        {result.docName} <span className="opacity-60">• match {result.occurrenceIndex + 1}</span>
                      </div>
                      <div className="mt-1 text-sm text-white whitespace-pre-wrap break-words">
                        {result.snippet.before}
                        <mark className="bg-seahawks-green text-[#001024] px-0.5 rounded">{result.snippet.match}</mark>
                        {result.snippet.after}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIndex(index);
                        handleReplaceSelected(result);
                      }}
                      className="shrink-0 px-2.5 py-1.5 rounded-md text-xs border border-seahawks-green/30 text-seahawks-green hover:bg-seahawks-green/10"
                    >
                      Replace
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {currentResult && (
          <div className="px-4 py-3 border-t border-[#001024] text-xs text-seahawks-gray bg-seahawks-navy/40">
            Selected result: <span className="text-white">{currentResult.docName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getPlainTextFromHtml(html) {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body?.textContent || '';
}

function buildSnippet(text, start, end, context = 40) {
  return {
    before: text.slice(Math.max(0, start - context), start),
    match: text.slice(start, end),
    after: text.slice(end, Math.min(text.length, end + context)),
  };
}

function findOccurrences(text, query, { matchCase = false } = {}) {
  if (!query) return [];
  const haystack = matchCase ? text : text.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();
  const results = [];
  let idx = 0;
  while (idx <= haystack.length - needle.length) {
    const found = haystack.indexOf(needle, idx);
    if (found === -1) break;
    results.push({ start: found, end: found + needle.length });
    idx = found + Math.max(needle.length, 1);
  }
  return results;
}

function replaceOccurrenceInHtml(html, query, replacement, targetOccurrenceIndex, { matchCase = false } = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let globalOccurrence = 0;
  let changed = false;
  let node;

  while ((node = walker.nextNode())) {
    const text = node.nodeValue || '';
    const occs = findOccurrences(text, query, { matchCase });
    if (occs.length === 0) continue;

    for (const occ of occs) {
      if (globalOccurrence === targetOccurrenceIndex) {
        node.nodeValue = text.slice(0, occ.start) + replacement + text.slice(occ.end);
        changed = true;
        break;
      }
      globalOccurrence += 1;
    }
    if (changed) break;
  }

  return { html: doc.body.innerHTML, changed };
}

function replaceAllInHtml(html, query, replacement, { matchCase = false } = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node;

  while ((node = walker.nextNode())) {
    const text = node.nodeValue || '';
    const replaced = replaceAllInText(text, query, replacement, { matchCase });
    if (replaced.count > 0) {
      node.nodeValue = replaced.text;
      count += replaced.count;
    }
  }

  return { html: doc.body.innerHTML, count };
}

function replaceAllInText(text, query, replacement, { matchCase = false } = {}) {
  const occs = findOccurrences(text, query, { matchCase });
  if (occs.length === 0) return { text, count: 0 };

  let out = '';
  let cursor = 0;
  for (const occ of occs) {
    out += text.slice(cursor, occ.start) + replacement;
    cursor = occ.end;
  }
  out += text.slice(cursor);
  return { text: out, count: occs.length };
}
