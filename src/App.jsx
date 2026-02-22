import { useState, useEffect, useRef } from 'react';
import { Search, History, Sparkles, BookOpen, Menu, Download, Upload, Settings, X, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import useStore from './store/useStore';
import Sidebar from './components/Sidebar';
import EditorArea from './components/EditorArea';
import StartupCheckModal from './components/StartupCheckModal';
import ExportModal from './components/ExportModal';
import AiSettingsModal from './components/AiSettingsModal';
import FindReplaceModal from './components/FindReplaceModal';
import ProjectHubModal from './components/ProjectHubModal';
import VersionHistoryModal from './components/VersionHistoryModal';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiSettingsMode, setAiSettingsMode] = useState('persona');
  const [projectHubOpen, setProjectHubOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [importPreviewState, setImportPreviewState] = useState(null);
  const [findNavigationRequest, setFindNavigationRequest] = useState(null);
  const fileInputRef = useRef(null);
  const {
    initializeDemoData, activeProjectId, projects,
    splitMode, activeDocumentId, activeDocumentIdSecondary, toggleSplitMode,
    setActiveProject, createProject,
    folders, documents, updateDocumentContent, setActiveDocument, settings
  } = useStore();

  const handleExportWorkspaceJson = () => {
    const state = useStore.getState();
    const dataToExport = {
      backupVersion: 2,
      exportedAt: new Date().toISOString(),
      projects: state.projects,
      folders: state.folders,
      documents: state.documents,
      personas: state.personas,
      settings: state.settings,
      activeProjectId: state.activeProjectId,
      activeDocumentId: state.activeDocumentId,
      splitMode: state.splitMode,
      activeDocumentIdSecondary: state.activeDocumentIdSecondary,
    };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibe-processor-workspace-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const resetImportInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const applyImportedWorkspace = (data) => {
    const currentState = useStore.getState();
    const mergedProjects = mergeById(currentState.projects, data.projects);

    const mergedProjectIds = new Set(mergedProjects.map((p) => p?.id).filter(Boolean));
    const mergedFolders = mergeById(currentState.folders, data.folders)
      .filter((f) => f && mergedProjectIds.has(f.projectId));

    const mergedFolderIds = new Set(mergedFolders.map((f) => f.id));
    const mergedDocuments = mergeById(currentState.documents, data.documents)
      .filter((d) => d && mergedFolderIds.has(d.folderId));

    const mergedPersonas = Array.isArray(data.personas)
      ? mergeById(currentState.personas, data.personas)
      : currentState.personas;

    const mergedDocumentIds = new Set(mergedDocuments.map((d) => d.id));
    const mergedProjectIdSet = new Set(mergedProjects.map((p) => p.id));

    const nextActiveProjectId =
      (mergedProjectIdSet.has(currentState.activeProjectId) && currentState.activeProjectId) ||
      (mergedProjectIdSet.has(data.activeProjectId) && data.activeProjectId) ||
      mergedProjects[0]?.id ||
      null;

    const nextActiveDocumentId =
      (mergedDocumentIds.has(currentState.activeDocumentId) && currentState.activeDocumentId) ||
      (mergedDocumentIds.has(data.activeDocumentId) && data.activeDocumentId) ||
      null;

    useStore.setState({
      projects: mergedProjects,
      folders: mergedFolders,
      documents: mergedDocuments,
      personas: mergedPersonas,
      settings: data.settings && typeof data.settings === 'object'
        ? { ...currentState.settings, ...data.settings }
        : currentState.settings,
      activeProjectId: nextActiveProjectId,
      activeDocumentId: nextActiveDocumentId,
      splitMode: false,
      activeDocumentIdSecondary: null,
    });
  };

  const handleConfirmImport = () => {
    if (!importPreviewState?.data) return;

    const currentState = useStore.getState();
    const safetyBackup = buildWorkspaceBackupPayload(currentState, { reason: 'pre-import-safety-backup' });
    const safetyStored = storeLocalImportSafetyBackup(safetyBackup);

    applyImportedWorkspace(importPreviewState.data);
    setImportPreviewState(null);

    alert(
      `Workspace imported successfully! Backup data was merged with your existing projects (existing unmatched items were kept).${safetyStored ? ' A pre-import safety backup was saved locally.' : ' (Local safety backup could not be stored.)'}`
    );
  };

  const handleImportWorkspace = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data.projects) && Array.isArray(data.folders) && Array.isArray(data.documents)) {
          const currentState = useStore.getState();
          setImportPreviewState({
            fileName: file.name,
            data,
            summary: buildImportMergeSummary(currentState, data),
          });
        } else {
          alert('Invalid workspace file format. Missing projects, folders, or documents.');
        }
      } catch (err) {
        alert('Error parsing JSON file.');
      }
      resetImportInput();
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    initializeDemoData();
  }, [initializeDemoData]);

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
  }, [settings?.themeMode]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const openAiSettings = (mode) => {
    setAiSettingsMode(mode);
    setAiSettingsOpen(true);
  };

  const handleOpenProject = (projectId) => {
    setActiveProject(projectId);
    setProjectHubOpen(false);
  };

  const handleCreateProjectFromHub = () => {
    const name = prompt('Enter new project name:');
    if (!name || !name.trim()) return;
    createProject(name.trim());
    setProjectHubOpen(false);
  };

  const handleNavigateFindResult = (payload) => {
    setFindNavigationRequest({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...payload,
    });
  };

  return (
    <div className="flex h-screen w-full bg-seahawks-navy text-seahawks-gray overflow-hidden font-sans">
      <StartupCheckModal />
      <ExportModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <AiSettingsModal isOpen={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} mode={aiSettingsMode} />
      <FindReplaceModal
        isOpen={findReplaceOpen}
        onClose={() => setFindReplaceOpen(false)}
        activeProjectId={activeProjectId}
        activeDocumentId={activeDocumentId}
        folders={folders}
        documents={documents}
        setActiveDocument={setActiveDocument}
        updateDocumentContent={updateDocumentContent}
        onNavigateToResult={handleNavigateFindResult}
      />
      <VersionHistoryModal
        isOpen={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        documentId={activeDocumentId}
      />
      <ImportPreviewModal
        state={importPreviewState}
        onCancel={() => setImportPreviewState(null)}
        onConfirm={handleConfirmImport}
      />
      <ProjectHubModal
        isOpen={projectHubOpen}
        onClose={() => setProjectHubOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onOpenProject={handleOpenProject}
        onCreateProject={handleCreateProjectFromHub}
      />

      {/* LEFT PANE: Document Editor & Header/Footer */}
      <div className="flex-1 flex flex-col relative transition-all duration-300 w-full">

        {/* Top Header Bar */}
        <header className="h-14 border-b vw-border-soft flex items-center justify-between px-6 bg-seahawks-navy/95 backdrop-blur-sm z-10 w-full shrink-0">
          <div className="flex items-center gap-3">
            {/* Disjointed Bold Vibe Writer Logo */}
            <div className="flex items-baseline ml-2 select-none group cursor-default">
              <div className="flex items-center font-black uppercase text-4xl tracking-tighter">
                <span className="vw-text-primary transform -rotate-3 hover:rotate-0 transition-transform">V</span>
                <span className="text-seahawks-green transform translate-y-1 hover:translate-y-0 transition-transform">i</span>
                <span className="vw-text-primary transform scale-110 hover:scale-100 transition-transform">b</span>
                <span className="text-seahawks-gray transform -translate-y-0.5 hover:-translate-y-0 transition-transform">e</span>
              </div>
              <span className="ml-3 font-bold text-lg tracking-[0.3em] text-seahawks-green uppercase opacity-80 group-hover:opacity-100 transition-opacity">Writer</span>
            </div>

            {/* Project Breadcrumb */}
            {activeProject && (
              <div className="hidden md:flex flex-row items-center gap-2 ml-6 text-sm">
                <div className="w-px h-4 bg-seahawks-gray/20 mx-2" />
                <button
                  onClick={() => setProjectHubOpen(true)}
                  className="text-seahawks-gray/50 hover:text-seahawks-green transition-colors"
                  title="Open Project Hub"
                >
                  Projects
                </button>
                <span className="text-seahawks-gray/30">/</span>
                <span className="vw-text-primary font-medium">{activeProject.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setFindReplaceOpen(true)} title="Find & Replace" className="p-2 rounded-md hover:bg-seahawks-navy/30 text-seahawks-gray transition-colors hover:text-white"><Search size={18} /></button>
            <button
              onClick={() => setVersionHistoryOpen(true)}
              title="Version History"
              className={clsx(
                "p-2 rounded-md transition-colors",
                versionHistoryOpen
                  ? "text-[#001024] bg-seahawks-green hover:bg-white"
                  : "hover:bg-seahawks-navy/30 text-seahawks-gray hover:text-white"
              )}
            >
              <History size={18} />
            </button>
            <button
              onClick={toggleSplitMode}
              title="Toggle Split Screen"
              className={clsx(
                "p-2 rounded-md transition-colors",
                splitMode
                  ? "text-[#001024] bg-seahawks-green hover:bg-white"
                  : "hover:bg-seahawks-navy/30 text-seahawks-gray hover:text-seahawks-green"
              )}
            >
              <BookOpen size={18} />
            </button>
            <button onClick={() => openAiSettings('persona')} title="AI Skills & Personas" className="p-2 rounded-md hover:bg-seahawks-navy/30 text-seahawks-green transition-colors hover:text-white"><Sparkles size={18} /></button>
            <button onClick={() => setExportModalOpen(true)} title="Export Document(s)" className="p-2 rounded-md hover:bg-seahawks-navy/30 text-seahawks-gray transition-colors hover:text-white"><Download size={18} /></button>

            <div className="w-px h-6 bg-seahawks-navy/30 mx-1" />

            {/* Kept original JSON workspace backup as strictly an upload icon, since user wanted both export capabilities */}
            <button onClick={handleExportWorkspaceJson} title="Backup Workspace JSON" className="p-2 rounded-md hover:bg-seahawks-navy/30 text-seahawks-gray transition-colors hover:text-white text-xs font-mono px-3 border border-seahawks-gray/20 hover:border-seahawks-gray/50">Backup</button>
            <button onClick={handleImportClick} title="Restore Workspace JSON" className="p-2 rounded-md hover:bg-seahawks-navy/30 text-seahawks-gray transition-colors hover:text-white"><Upload size={18} /></button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportWorkspace} />

            <div className="w-px h-6 bg-seahawks-navy/30 mx-1" />

            <button onClick={() => openAiSettings('api')} title="AI Connections & CLI / OAuth" className="p-2 rounded-md hover:bg-seahawks-navy/30 text-seahawks-gray transition-colors hover:text-white"><Settings size={18} /></button>
          </div>
        </header>

        {/* Editor Wrapper */}
        <div className="flex-1 flex flex-row overflow-hidden relative w-full h-full">
          {/* Primary View */}
          <div className={clsx("h-full relative transition-all duration-300 flex flex-col", splitMode ? "w-1/2 border-r vw-border" : "w-full")}>
            <EditorArea documentId={activeDocumentId} isSecondary={false} findNavigationRequest={findNavigationRequest} />
          </div>

          {/* Secondary View */}
          {splitMode && (
            <div className="w-1/2 h-full relative flex flex-col vw-surface-4">
              <EditorArea documentId={activeDocumentIdSecondary} isSecondary={true} findNavigationRequest={findNavigationRequest} />
            </div>
          )}
        </div>

      </div>

      {/* RIGHT PANE: Binder (Sidebar) */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          title="Open Sidebar"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-lg border border-seahawks-gray/20 vw-surface-2 backdrop-blur-sm text-seahawks-gray hover:text-white hover:border-seahawks-green/40 hover:bg-seahawks-navy transition-colors shadow-lg"
        >
          <Menu size={18} />
        </button>
      )}

    </div>
  );
}

export default App;

function mergeById(currentItems = [], importedItems = []) {
  const byId = new Map();

  for (const item of currentItems) {
    if (!item || !item.id) continue;
    byId.set(item.id, item);
  }

  for (const item of importedItems) {
    if (!item || !item.id) continue;
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? { ...existing, ...item } : item);
  }

  return Array.from(byId.values());
}

function buildWorkspaceBackupPayload(state, extras = {}) {
  return {
    backupVersion: 2,
    exportedAt: new Date().toISOString(),
    ...extras,
    projects: state.projects,
    folders: state.folders,
    documents: state.documents,
    personas: state.personas,
    settings: state.settings,
    activeProjectId: state.activeProjectId,
    activeDocumentId: state.activeDocumentId,
    splitMode: state.splitMode,
    activeDocumentIdSecondary: state.activeDocumentIdSecondary,
  };
}

function storeLocalImportSafetyBackup(payload) {
  try {
    const key = 'vibe-processor-import-safety-backups';
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(existing) ? existing : [];
    const next = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        payload,
      },
      ...list,
    ].slice(0, 5);
    localStorage.setItem(key, JSON.stringify(next));
    return true;
  } catch (error) {
    console.warn('Failed to store local import safety backup', error);
    return false;
  }
}

function buildImportMergeSummary(currentState, importedData) {
  return {
    projects: summarizeById(currentState.projects, importedData.projects),
    folders: summarizeById(currentState.folders, importedData.folders),
    documents: summarizeById(currentState.documents, importedData.documents),
    personas: Array.isArray(importedData.personas)
      ? summarizeById(currentState.personas, importedData.personas)
      : { imported: 0, newItems: 0, updates: 0, unchanged: 0 },
    settings: importedData.settings && typeof importedData.settings === 'object'
      ? {
          keysIncoming: Object.keys(importedData.settings).length,
          keysChanged: Object.entries(importedData.settings).filter(([k, v]) => currentState.settings?.[k] !== v).length,
        }
      : { keysIncoming: 0, keysChanged: 0 },
  };
}

function summarizeById(currentItems = [], importedItems = []) {
  const currentById = new Map((currentItems || []).filter(x => x?.id).map(x => [x.id, x]));
  let newItems = 0;
  let updates = 0;
  let unchanged = 0;

  for (const item of importedItems || []) {
    if (!item?.id) continue;
    const existing = currentById.get(item.id);
    if (!existing) {
      newItems += 1;
    } else {
      const isDifferent = JSON.stringify(existing) !== JSON.stringify({ ...existing, ...item });
      if (isDifferent) updates += 1;
      else unchanged += 1;
    }
  }

  return {
    imported: (importedItems || []).length,
    newItems,
    updates,
    unchanged,
  };
}

function ImportPreviewModal({ state, onCancel, onConfirm }) {
  if (!state) return null;
  const { fileName, summary } = state;

  return (
    <div className="fixed inset-0 z-50 bg-[#001024]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl border border-[#001024] bg-seahawks-navy shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#001024] bg-seahawks-navy/60 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-xl flex items-center gap-2">
              <AlertTriangle size={18} className="text-seahawks-green" />
              Import Preview (Merge)
            </h2>
            <p className="text-sm text-seahawks-gray mt-1">
              Review what will be merged before applying the backup import.
            </p>
          </div>
          <button onClick={onCancel} className="w-9 h-9 rounded-md text-seahawks-gray hover:text-white hover:bg-[#001730] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm text-seahawks-gray">
            File: <span className="text-white font-medium">{fileName || 'Imported JSON'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SummaryCard title="Projects" data={summary.projects} />
            <SummaryCard title="Folders" data={summary.folders} />
            <SummaryCard title="Documents" data={summary.documents} />
            <SummaryCard title="Personas" data={summary.personas} />
          </div>

          <div className="rounded-lg border border-seahawks-gray/10 bg-[#001730] p-4">
            <div className="text-sm font-semibold text-white mb-2">Settings Overlay</div>
            <div className="text-xs text-seahawks-gray">
              Incoming keys: <span className="text-white">{summary.settings.keysIncoming}</span>
            </div>
            <div className="text-xs text-seahawks-gray mt-1">
              Keys that will change current values: <span className="text-white">{summary.settings.keysChanged}</span>
            </div>
          </div>

          <div className="rounded-lg border border-seahawks-green/20 bg-seahawks-green/5 p-4 text-xs text-seahawks-gray leading-relaxed">
            Import is non-destructive by default: existing projects/documents not present in the backup will be kept. Matching items are merged by internal ID. A local pre-import safety backup will be stored before the merge is applied.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#001024] bg-seahawks-navy/50 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-md text-sm text-seahawks-gray hover:text-white hover:bg-[#001730] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-md text-sm font-semibold bg-white text-[#001024] hover:bg-seahawks-green transition-colors">
            Merge Import
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, data }) {
  return (
    <div className="rounded-lg border border-seahawks-gray/10 bg-[#001730] p-4">
      <div className="text-sm font-semibold text-white mb-2">{title}</div>
      <div className="text-xs text-seahawks-gray">Incoming: <span className="text-white">{data.imported}</span></div>
      <div className="text-xs text-seahawks-gray mt-1">New: <span className="text-seahawks-green">{data.newItems}</span></div>
      <div className="text-xs text-seahawks-gray mt-1">Updates: <span className="text-white">{data.updates}</span></div>
      <div className="text-xs text-seahawks-gray mt-1">Unchanged: <span className="text-white">{data.unchanged}</span></div>
    </div>
  );
}
