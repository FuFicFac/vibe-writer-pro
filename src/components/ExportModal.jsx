import React, { useState } from 'react';
import useStore from '../store/useStore';
import { X, FileText, Download, CheckSquare, Square } from 'lucide-react';
import clsx from 'clsx';
import TurndownService from 'turndown';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, UnderlineType } from 'docx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export default function ExportModal({ isOpen, onClose }) {
    const { activeProjectId, projects, folders, documents } = useStore();

    // State for which docs are selected
    const [selectedDocIds, setSelectedDocIds] = useState(new Set(documents.filter(d => d.includeInContext).map(d => d.id)));
    const [exportFormat, setExportFormat] = useState('md'); // 'md' or 'docx'
    const [exportMode, setExportMode] = useState('master'); // 'master' or 'individual-zip'
    const [isExporting, setIsExporting] = useState(false);

    if (!isOpen) return null;

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) return null;

    const projectFolders = folders.filter(f => f.projectId === activeProjectId).sort((a, b) => a.order - b.order);

    const toggleDoc = (docId) => {
        const newDocs = new Set(selectedDocIds);
        if (newDocs.has(docId)) {
            newDocs.delete(docId);
        } else {
            newDocs.add(docId);
        }
        setSelectedDocIds(newDocs);
    };

    const toggleAll = () => {
        const allProjectDocIds = documents.filter(d => projectFolders.map(f => f.id).includes(d.folderId)).map(d => d.id);
        if (selectedDocIds.size === allProjectDocIds.length) {
            setSelectedDocIds(new Set()); // Deselect all
        } else {
            setSelectedDocIds(new Set(allProjectDocIds)); // Select all
        }
    };

    const handleExport = async () => {
        if (selectedDocIds.size === 0) return;
        setIsExporting(true);

        try {
            // Gather selected documents in order
            const exportDocs = [];
            projectFolders.forEach(folder => {
                const folderDocs = documents.filter(d => d.folderId === folder.id).sort((a, b) => a.order - b.order);
                folderDocs.forEach(doc => {
                    if (selectedDocIds.has(doc.id)) {
                        exportDocs.push(doc);
                    }
                });
            });

            if (exportMode === 'master') {
                const isMaster = exportDocs.length > 1;
                const fileNameStr = isMaster ? `${activeProject.name}_Master` : exportDocs[0].name;

                if (exportFormat === 'md') {
                    const combinedMarkdown = buildMasterMarkdown(exportDocs);
                    const blob = new Blob([combinedMarkdown], { type: 'text/markdown;charset=utf-8' });
                    saveAs(blob, `${sanitizeFileName(fileNameStr)}.md`);
                } else if (exportFormat === 'docx') {
                    const blob = await buildMasterDocxBlob(exportDocs);
                    saveAs(blob, `${sanitizeFileName(fileNameStr)}.docx`);
                }
            } else if (exportMode === 'individual-zip') {
                const zip = new JSZip();
                const folderName = sanitizeFileName(activeProject.name || 'Project_Export');
                const root = zip.folder(folderName) || zip;

                if (exportFormat === 'md') {
                    for (const doc of exportDocs) {
                        const markdown = buildSingleMarkdown(doc);
                        root.file(`${sanitizeFileName(doc.name)}.md`, markdown);
                    }
                } else if (exportFormat === 'docx') {
                    for (const doc of exportDocs) {
                        const blob = await buildSingleDocxBlob(doc);
                        root.file(`${sanitizeFileName(doc.name)}.docx`, blob);
                    }
                }

                const zipBlob = await zip.generateAsync({ type: 'blob' });
                saveAs(zipBlob, `${folderName}_Individual_Documents.zip`);
            }

            onClose();
        } catch (err) {
            console.error("Export failed", err);
            alert("Export failed: " + err.message);
        } finally {
            setIsExporting(false);
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#001024]/80 backdrop-blur-md p-4">
            <div className="bg-seahawks-navy border border-[#001024] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">

                <div className="px-6 py-4 border-b border-[#001024] bg-seahawks-navy/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Download size={20} className="text-seahawks-green" />
                        Export Document
                    </h2>
                    <button onClick={onClose} className="text-seahawks-gray hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* Left Side: Document Selection */}
                    <div className="flex-1 border-b md:border-b-0 md:border-r border-[#001024] bg-[#001730] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-[#001024] flex justify-between items-center bg-seahawks-navy/30">
                            <span className="text-sm font-semibold text-white">Select Documents</span>
                            <button
                                onClick={toggleAll}
                                className="text-xs text-seahawks-green hover:underline flex items-center gap-1"
                            >
                                {selectedDocIds.size > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
                                Toggle All
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {projectFolders.map(folder => {
                                const folderDocs = documents.filter(d => d.folderId === folder.id).sort((a, b) => a.order - b.order);
                                if (folderDocs.length === 0) return null;

                                return (
                                    <div key={folder.id}>
                                        <h3 className="text-xs font-bold text-seahawks-gray tracking-wider uppercase mb-2 ml-1">{folder.name}</h3>
                                        <div className="space-y-1">
                                            {folderDocs.map(doc => (
                                                <div
                                                    key={doc.id}
                                                    onClick={() => toggleDoc(doc.id)}
                                                    className={clsx(
                                                        "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors border",
                                                        selectedDocIds.has(doc.id)
                                                            ? "bg-seahawks-green/10 border-seahawks-green/30 text-white"
                                                            : "hover:bg-seahawks-navy border-transparent text-seahawks-gray"
                                                    )}
                                                >
                                                    {selectedDocIds.has(doc.id) ? (
                                                        <CheckSquare size={16} className="text-seahawks-green shrink-0" />
                                                    ) : (
                                                        <Square size={16} className="opacity-50 shrink-0" />
                                                    )}
                                                    <FileText size={14} className="opacity-60 shrink-0" />
                                                    <span className="flex-1 truncate text-sm">{doc.name.replace(/_/g, ' ')}</span>
                                                    <span className="text-xs opacity-50 font-mono">{(doc.wordCount || 0)}w</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Side: Options */}
                    <div className="w-full md:w-64 bg-seahawks-navy p-6 flex flex-col">
                        <h3 className="text-sm font-semibold text-white mb-4">Export Type</h3>

                        <div className="space-y-3 mb-6">
                            <label className={clsx(
                                "flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-colors",
                                exportMode === 'master' ? "bg-[#001730] border-seahawks-green/50" : "border-[#001024] hover:bg-[#001730]"
                            )}>
                                <input
                                    type="radio"
                                    name="mode"
                                    value="master"
                                    checked={exportMode === 'master'}
                                    onChange={(e) => setExportMode(e.target.value)}
                                    className="hidden"
                                />
                                <div className={clsx("w-4 h-4 rounded-full border flex items-center justify-center", exportMode === 'master' ? "border-seahawks-green" : "border-seahawks-gray")}>
                                    {exportMode === 'master' && <div className="w-2 h-2 rounded-full bg-seahawks-green" />}
                                </div>
                                <div>
                                    <div className="text-sm text-white font-medium">Master Document</div>
                                    <div className="text-xs text-seahawks-gray">Combine checked docs into one export</div>
                                </div>
                            </label>

                            <label className={clsx(
                                "flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-colors",
                                exportMode === 'individual-zip' ? "bg-[#001730] border-seahawks-green/50" : "border-[#001024] hover:bg-[#001730]"
                            )}>
                                <input
                                    type="radio"
                                    name="mode"
                                    value="individual-zip"
                                    checked={exportMode === 'individual-zip'}
                                    onChange={(e) => setExportMode(e.target.value)}
                                    className="hidden"
                                />
                                <div className={clsx("w-4 h-4 rounded-full border flex items-center justify-center", exportMode === 'individual-zip' ? "border-seahawks-green" : "border-seahawks-gray")}>
                                    {exportMode === 'individual-zip' && <div className="w-2 h-2 rounded-full bg-seahawks-green" />}
                                </div>
                                <div>
                                    <div className="text-sm text-white font-medium">Individual Files (ZIP)</div>
                                    <div className="text-xs text-seahawks-gray">One file per checked doc, packed in a zip</div>
                                </div>
                            </label>
                        </div>

                        <h3 className="text-sm font-semibold text-white mb-4">Export Format</h3>

                        <div className="space-y-3 mb-8">
                            <label className={clsx(
                                "flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-colors",
                                exportFormat === 'md' ? "bg-[#001730] border-seahawks-green/50" : "border-[#001024] hover:bg-[#001730]"
                            )}>
                                <input
                                    type="radio"
                                    name="format"
                                    value="md"
                                    checked={exportFormat === 'md'}
                                    onChange={(e) => setExportFormat(e.target.value)}
                                    className="hidden"
                                />
                                <div className={clsx("w-4 h-4 rounded-full border flex items-center justify-center", exportFormat === 'md' ? "border-seahawks-green" : "border-seahawks-gray")}>
                                    {exportFormat === 'md' && <div className="w-2 h-2 rounded-full bg-seahawks-green" />}
                                </div>
                                <div>
                                    <div className="text-sm text-white font-medium">Markdown</div>
                                    <div className="text-xs text-seahawks-gray">Best for web/archives (.md)</div>
                                </div>
                            </label>

                            <label className={clsx(
                                "flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-colors",
                                exportFormat === 'docx' ? "bg-[#001730] border-seahawks-green/50" : "border-[#001024] hover:bg-[#001730]"
                            )}>
                                <input
                                    type="radio"
                                    name="format"
                                    value="docx"
                                    checked={exportFormat === 'docx'}
                                    onChange={(e) => setExportFormat(e.target.value)}
                                    className="hidden"
                                />
                                <div className={clsx("w-4 h-4 rounded-full border flex items-center justify-center", exportFormat === 'docx' ? "border-seahawks-green" : "border-seahawks-gray")}>
                                    {exportFormat === 'docx' && <div className="w-2 h-2 rounded-full bg-seahawks-green" />}
                                </div>
                                <div>
                                    <div className="text-sm text-white font-medium">Word Document</div>
                                    <div className="text-xs text-seahawks-gray">Best for printing/sharing (.docx)</div>
                                </div>
                            </label>
                        </div>

                        <div className="mt-auto">
                            <div className="text-xs text-seahawks-gray mb-3 text-center">
                                {selectedDocIds.size === 0
                                    ? "Select at least one document"
                                    : exportMode === 'individual-zip'
                                        ? `Preparing ZIP (${selectedDocIds.size} file${selectedDocIds.size === 1 ? '' : 's'})`
                                        : selectedDocIds.size === 1
                                            ? "Exporting 1 document"
                                            : `Compiling Master Document (${selectedDocIds.size} docs)`}
                            </div>

                            <button
                                disabled={selectedDocIds.size === 0 || isExporting}
                                onClick={handleExport}
                                className="w-full py-2.5 rounded-md font-bold text-sm transition-all text-[#001024] bg-seahawks-green hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isExporting ? "Exporting..." : "Download Export"}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function buildSingleMarkdown(doc) {
    const turndownService = new TurndownService({ headingStyle: 'atx' });
    return turndownService.turndown(doc.content || '') + '\n';
}

function buildMasterMarkdown(exportDocs) {
    const turndownService = new TurndownService({ headingStyle: 'atx' });
    const isMaster = exportDocs.length > 1;
    let combinedMarkdown = '';

    exportDocs.forEach((doc, idx) => {
        if (isMaster) combinedMarkdown += `# ${doc.name.replace(/_/g, ' ')}\n\n`;
        combinedMarkdown += turndownService.turndown(doc.content || '') + '\n\n';
        if (idx < exportDocs.length - 1 && isMaster) combinedMarkdown += '---\n\n';
    });

    return combinedMarkdown;
}

async function buildSingleDocxBlob(doc) {
    const docxData = new Document({
        sections: [{
            properties: {},
            children: buildDocxParagraphsForContent(doc.content || '', false, doc.name),
        }]
    });
    return Packer.toBlob(docxData);
}

async function buildMasterDocxBlob(exportDocs) {
    const docxSections = [];
    const isMaster = exportDocs.length > 1;

    exportDocs.forEach((doc, idx) => {
        docxSections.push(...buildDocxParagraphsForContent(doc.content || '', isMaster, doc.name));

        if (idx < exportDocs.length - 1 && isMaster) {
            docxSections.push(new Paragraph({ pageBreakBefore: true }));
        }
    });

    const docxData = new Document({
        sections: [{
            properties: {},
            children: docxSections
        }]
    });

    return Packer.toBlob(docxData);
}

function buildDocxParagraphsForContent(html, includeDocHeading, docName) {
    const paragraphs = [];

    if (includeDocHeading) {
        paragraphs.push(new Paragraph({
            text: (docName || '').replace(/_/g, ' '),
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 }
        }));
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html || '';

    Array.from(tempDiv.childNodes).forEach(node => {
        paragraphs.push(...convertHtmlNodeToDocxParagraphs(node));
    });

    return paragraphs;
}

function convertHtmlNodeToDocxParagraphs(node, context = {}) {
    if (!node) return [];

    if (node.nodeType === Node.TEXT_NODE) {
        const text = normalizeWhitespace(node.textContent || '');
        if (!text.trim()) return [];
        return [new Paragraph({
            children: [new TextRun(text)],
            spacing: { after: 200 }
        })];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return [];

    const tag = node.nodeName.toUpperCase();

    if (tag === 'P') {
        return [buildDocxParagraphFromInline(node, { spacing: { after: 200 } })].filter(Boolean);
    }

    if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
        const headingLevel = tag === 'H1'
            ? HeadingLevel.HEADING_1
            : tag === 'H2'
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3;

        const runs = buildTextRunsFromInline(node);
        if (!runs.length) return [];

        return [new Paragraph({
            children: runs,
            heading: headingLevel,
            spacing: { after: 200, before: 200 }
        })];
    }

    if (tag === 'UL' || tag === 'OL') {
        return buildListParagraphs(node, {
            ordered: tag === 'OL',
            level: context.level || 0,
        });
    }

    if (tag === 'BLOCKQUOTE') {
        const childParagraphs = [];

        Array.from(node.childNodes).forEach(child => {
            childParagraphs.push(...convertHtmlNodeToDocxParagraphs(child, context));
        });

        if (childParagraphs.length > 0) {
            return childParagraphs;
        }

        const quoteRuns = buildTextRunsFromInline(node, { italics: true });
        if (!quoteRuns.length) return [];
        return [new Paragraph({
            children: quoteRuns,
            spacing: { after: 200 },
            indent: { left: 480 },
        })];
    }

    if (tag === 'HR') {
        return [new Paragraph({
            children: [new TextRun({ text: '--------------------' })],
            spacing: { before: 180, after: 180 },
        })];
    }

    if (tag === 'PRE') {
        const text = node.textContent || '';
        if (!text.trim()) return [];
        return [new Paragraph({
            children: [new TextRun({ text, font: 'Courier New' })],
            spacing: { after: 200 },
        })];
    }

    // Fallback: recurse children to avoid dropping content from unknown wrappers.
    const paragraphs = [];
    Array.from(node.childNodes).forEach(child => {
        paragraphs.push(...convertHtmlNodeToDocxParagraphs(child, context));
    });
    return paragraphs;
}

function buildListParagraphs(listNode, { ordered = false, level = 0 } = {}) {
    const paragraphs = [];
    const listItems = Array.from(listNode.children).filter(child => child.nodeName.toUpperCase() === 'LI');

    listItems.forEach((li, idx) => {
        const clone = li.cloneNode(true);
        Array.from(clone.querySelectorAll('ul,ol')).forEach(nested => nested.remove());

        const itemRuns = buildTextRunsFromInline(clone);
        if (itemRuns.length) {
            const prefix = ordered ? `${idx + 1}. ` : '• ';
            paragraphs.push(new Paragraph({
                children: [new TextRun(prefix), ...itemRuns],
                spacing: { after: 120 },
                indent: {
                    left: 360 * (level + 1),
                    hanging: 180,
                },
            }));
        }

        Array.from(li.children)
            .filter(child => {
                const tag = child.nodeName.toUpperCase();
                return tag === 'UL' || tag === 'OL';
            })
            .forEach(nestedList => {
                paragraphs.push(...buildListParagraphs(nestedList, {
                    ordered: nestedList.nodeName.toUpperCase() === 'OL',
                    level: level + 1,
                }));
            });
    });

    return paragraphs;
}

function buildDocxParagraphFromInline(element, options = {}) {
    const runs = buildTextRunsFromInline(element);
    if (!runs.length) return null;
    return new Paragraph({
        children: runs,
        ...options,
    });
}

function buildTextRunsFromInline(node, marks = {}) {
    const runs = [];
    let hasVisible = false;

    const walk = (current, activeMarks) => {
        if (!current) return;

        if (current.nodeType === Node.TEXT_NODE) {
            const text = normalizeWhitespace(current.textContent || '');
            if (!text) return;
            if (text.trim()) hasVisible = true;
            runs.push(new TextRun({
                text,
                bold: Boolean(activeMarks.bold),
                italics: Boolean(activeMarks.italics),
                strike: Boolean(activeMarks.strike),
                underline: activeMarks.underline ? { type: UnderlineType.SINGLE } : undefined,
                font: activeMarks.code ? 'Courier New' : undefined,
                color: activeMarks.link ? '1D4ED8' : undefined,
            }));
            return;
        }

        if (current.nodeType !== Node.ELEMENT_NODE) return;

        const tag = current.nodeName.toUpperCase();

        if (tag === 'BR') {
            runs.push(new TextRun({ text: '', break: 1 }));
            return;
        }

        const nextMarks = { ...activeMarks };
        if (tag === 'STRONG' || tag === 'B') nextMarks.bold = true;
        if (tag === 'EM' || tag === 'I') nextMarks.italics = true;
        if (tag === 'U') nextMarks.underline = true;
        if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') nextMarks.strike = true;
        if (tag === 'CODE') nextMarks.code = true;
        if (tag === 'A') {
            nextMarks.link = true;
            nextMarks.underline = true;
        }

        Array.from(current.childNodes).forEach(child => walk(child, nextMarks));
    };

    walk(node, marks);

    if (!hasVisible) return [];
    return runs;
}

function normalizeWhitespace(text) {
    return String(text || '').replace(/\u00a0/g, ' ');
}


function sanitizeFileName(name) {
    return String(name || 'document')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}
