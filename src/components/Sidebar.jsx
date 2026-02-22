import React from 'react';
import { Sidebar as SidebarIcon, FolderOpen, FileText, Columns, FolderPlus, FilePlus } from 'lucide-react';
import clsx from 'clsx';
import useStore from '../store/useStore';

export default function Sidebar({ isOpen, onClose }) {
    const {
        activeProjectId, activeDocumentId, activeDocumentIdSecondary, splitMode,
        folders, documents,
        setActiveDocument, setActiveDocumentSecondary, toggleDocumentContext,
        createFolder, createDocument
    } = useStore();

    const projectFolders = folders
        .filter(f => f.projectId === activeProjectId)
        .sort((a, b) => a.order - b.order);

    const handleAddFolder = () => {
        if (!activeProjectId) return;
        const name = prompt("Enter new folder name:");
        if (name && name.trim()) {
            createFolder(activeProjectId, name.trim());
        }
    };

    const handleAddDocument = (folderId, e) => {
        e.stopPropagation();
        const name = prompt("Enter new document name:");
        if (name && name.trim()) {
            createDocument(folderId, name.trim());
        }
    };

    return (
        <aside
            className={clsx(
                "bg-[#001730] border-l border-[#001024] flex flex-col transition-all duration-300 ease-in-out z-20",
                isOpen ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden border-none"
            )}
        >
            <div className="h-14 border-b border-[#001024] flex items-center justify-between px-4 shrink-0 bg-seahawks-navy/20">
                <div className="flex items-center gap-2 font-medium text-white">
                    <SidebarIcon size={18} className="text-seahawks-gray" />
                    <span>Binder</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleAddFolder}
                        title="New Folder"
                        className="p-1.5 rounded-md hover:bg-seahawks-navy/50 text-seahawks-green transition-colors"
                    >
                        <FolderPlus size={16} />
                    </button>
                    <button
                        onClick={onClose}
                        title="Close Sidebar"
                        className="p-1.5 rounded-md hover:bg-seahawks-navy/50 text-seahawks-gray transition-colors"
                    >
                        <SidebarIcon size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                {projectFolders.map(folder => {
                    const folderDocs = documents
                        .filter(d => d.folderId === folder.id)
                        .sort((a, b) => a.order - b.order);

                    const folderWordCount = folderDocs.reduce((acc, d) => acc + (d.wordCount || 0), 0);

                    return (
                        <div key={folder.id} className="mb-2">
                            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-seahawks-gray hover:bg-seahawks-navy/50 rounded-md group cursor-pointer text-white">
                                <FolderOpen size={16} className="text-seahawks-green" />
                                <span className="flex-1 truncate">{folder.name}</span>
                                <span className="text-xs text-seahawks-gray/50 font-mono">{folderWordCount.toLocaleString()}</span>
                                <button
                                    onClick={(e) => handleAddDocument(folder.id, e)}
                                    title="New Document"
                                    className="opacity-0 group-hover:opacity-100 p-1 text-seahawks-green hover:text-white transition-all rounded hover:bg-[#001024]"
                                >
                                    <FilePlus size={14} />
                                </button>
                            </div>

                            <div className="ml-4 mt-1 space-y-0.5 border-l border-[#002244] pl-2">
                                {folderDocs.map(doc => {
                                    const isPrimary = doc.id === activeDocumentId;
                                    const isSecondary = doc.id === activeDocumentIdSecondary;
                                    const isActive = isPrimary || isSecondary;
                                    return (
                                        <div
                                            key={doc.id}
                                            onClick={() => setActiveDocument(doc.id)}
                                            className={clsx(
                                                "flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer group",
                                                isActive ? "bg-seahawks-navy/80 text-white border border-[#001024]" : "text-seahawks-gray hover:bg-seahawks-navy/50 border border-transparent"
                                            )}
                                        >
                                            <FileText size={14} className={isActive ? "text-seahawks-green" : "opacity-60 group-hover:opacity-100 transition-opacity"} />
                                            <span className="flex-1 truncate">{doc.name}</span>

                                            {/* Open in Split View button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveDocumentSecondary(doc.id);
                                                }}
                                                title="Open in Right Pane"
                                                className="opacity-0 group-hover:opacity-100 hover:text-white text-seahawks-gray p-0.5 transition-opacity"
                                            >
                                                <Columns size={12} />
                                            </button>

                                            <span className="text-xs opacity-60 font-mono text-seahawks-gray">{(doc.wordCount || 0).toLocaleString()}</span>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleDocumentContext(doc.id);
                                                }}
                                                title={doc.includeInContext ? "Included in AI Context" : "Excluded from AI Context"}
                                                className={clsx(
                                                    "w-8 h-4 rounded-full relative shadow-inner border transition-colors",
                                                    doc.includeInContext
                                                        ? "bg-seahawks-green/20 border-seahawks-green/30"
                                                        : "bg-seahawks-navy border-seahawks-gray/20"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "w-3 h-3 rounded-full absolute top-0.5 shadow-sm transition-all",
                                                    doc.includeInContext ? "bg-seahawks-green right-0.5" : "bg-white left-0.5"
                                                )} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
