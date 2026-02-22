import React, { useState } from 'react';
import useStore from '../store/useStore';
import { X, FileText, Download, CheckSquare, Square } from 'lucide-react';
import clsx from 'clsx';
import TurndownService from 'turndown';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function ExportModal({ isOpen, onClose }) {
    const { activeProjectId, projects, folders, documents } = useStore();

    // State for which docs are selected
    const [selectedDocIds, setSelectedDocIds] = useState(new Set(documents.filter(d => d.includeInContext).map(d => d.id)));
    const [exportFormat, setExportFormat] = useState('md'); // 'md' or 'docx'
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

            const isMaster = exportDocs.length > 1;
            const fileNameStr = isMaster ? `${activeProject.name}_Master` : exportDocs[0].name;

            if (exportFormat === 'md') {
                const turndownService = new TurndownService({ headingStyle: 'atx' });
                let combinedMarkdown = '';

                exportDocs.forEach((doc, idx) => {
                    if (isMaster) combinedMarkdown += `# ${doc.name.replace(/_/g, ' ')}\n\n`;
                    combinedMarkdown += turndownService.turndown(doc.content) + '\n\n';
                    if (idx < exportDocs.length - 1 && isMaster) combinedMarkdown += '---\n\n';
                });

                const blob = new Blob([combinedMarkdown], { type: 'text/markdown;charset=utf-8' });
                saveAs(blob, `${fileNameStr}.md`);

            } else if (exportFormat === 'docx') {

                // Very basic HTML to DOCX parser for now
                const docxSections = [];

                exportDocs.forEach((doc, idx) => {
                    if (isMaster) {
                        docxSections.push(new Paragraph({
                            text: doc.name.replace(/_/g, ' '),
                            heading: HeadingLevel.HEADING_1,
                            spacing: { after: 300 }
                        }));
                    }

                    // Parse the HTML content simply (real implementation needs a more robust HTML parser like html-to-docx, 
                    // but sticking to docx library basics for the moment)
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = doc.content;

                    Array.from(tempDiv.childNodes).forEach(node => {
                        if (node.nodeName === 'P' || node.nodeType === 3) {
                            let text = node.textContent || "";
                            if (text.trim()) {
                                docxSections.push(new Paragraph({
                                    children: [new TextRun(text)],
                                    spacing: { after: 200 }
                                }));
                            }
                        } else if (node.nodeName === 'H1') {
                            docxSections.push(new Paragraph({ text: node.textContent, heading: HeadingLevel.HEADING_1, spacing: { after: 200, before: 200 } }));
                        } else if (node.nodeName === 'H2') {
                            docxSections.push(new Paragraph({ text: node.textContent, heading: HeadingLevel.HEADING_2, spacing: { after: 200, before: 200 } }));
                        } else if (node.nodeName === 'H3') {
                            docxSections.push(new Paragraph({ text: node.textContent, heading: HeadingLevel.HEADING_3, spacing: { after: 200, before: 200 } }));
                        }
                    });

                    // Add page break if master document
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

                const blob = await Packer.toBlob(docxData);
                saveAs(blob, `${fileNameStr}.docx`);
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
