import { useState, useEffect, useRef } from 'react';
import { Search, History, Sparkles, BookOpen, Menu, Download, Upload, Settings, Columns, X, FolderOpen, Plus } from 'lucide-react';
import clsx from 'clsx';
import useStore from './store/useStore';
import Sidebar from './components/Sidebar';
import EditorArea from './components/EditorArea';
import StartupCheckModal from './components/StartupCheckModal';
import ExportModal from './components/ExportModal';
import AiSettingsModal from './components/AiSettingsModal';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiSettingsMode, setAiSettingsMode] = useState('persona');
  const [projectHubOpen, setProjectHubOpen] = useState(false);
  const fileInputRef = useRef(null);
  const {
    initializeDemoData, activeProjectId, projects,
    splitMode, activeDocumentId, activeDocumentIdSecondary, toggleSplitMode,
    setActiveProject, createProject
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

  const handleImportWorkspace = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data.projects) && Array.isArray(data.folders) && Array.isArray(data.documents)) {
          const currentState = useStore.getState();
          const projectIds = new Set(data.projects.map((p) => p?.id).filter(Boolean));
          const validFolders = data.folders.filter((f) => f && projectIds.has(f.projectId));
          const folderIds = new Set(validFolders.map((f) => f.id));
          const validDocuments = data.documents.filter((d) => d && folderIds.has(d.folderId));

          const importedActiveProjectId = projectIds.has(data.activeProjectId) ? data.activeProjectId : null;
          const fallbackActiveProjectId = importedActiveProjectId || (data.projects[0]?.id ?? null);
          const documentIds = new Set(validDocuments.map((d) => d.id));
          const importedActiveDocumentId = documentIds.has(data.activeDocumentId) ? data.activeDocumentId : null;
          const importedSecondaryId = documentIds.has(data.activeDocumentIdSecondary) ? data.activeDocumentIdSecondary : null;

          useStore.setState({
            projects: data.projects,
            folders: validFolders,
            documents: validDocuments,
            personas: Array.isArray(data.personas) ? data.personas : currentState.personas,
            settings: data.settings && typeof data.settings === 'object'
              ? { ...currentState.settings, ...data.settings }
              : currentState.settings,
            activeProjectId: fallbackActiveProjectId,
            activeDocumentId: importedActiveDocumentId,
            splitMode: Boolean(data.splitMode && importedSecondaryId),
            activeDocumentIdSecondary: Boolean(data.splitMode) ? importedSecondaryId : null,
          });
          alert('Workspace imported successfully! Projects, documents, personas, and settings were restored.');
        } else {
          alert('Invalid workspace file format. Missing projects, folders, or documents.');
        }
      } catch (err) {
        alert('Error parsing JSON file.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    initializeDemoData();
  }, [initializeDemoData]);

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

  return (
    <div className="flex h-screen w-full bg-seahawks-navy text-seahawks-gray overflow-hidden font-sans">
      <StartupCheckModal />
      <ExportModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <AiSettingsModal isOpen={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} mode={aiSettingsMode} />
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
        <header className="h-14 border-b border-[#001730]/50 flex items-center justify-between px-6 bg-seahawks-navy/95 backdrop-blur-sm z-10 w-full shrink-0">
          <div className="flex items-center gap-3">
            {/* Disjointed Bold Vibe Writer Logo */}
            <div className="flex items-baseline ml-2 select-none group cursor-default">
              <div className="flex items-center font-black uppercase text-2xl tracking-tighter">
                <span className="text-white transform -rotate-3 hover:rotate-0 transition-transform">V</span>
                <span className="text-seahawks-green transform translate-y-1 hover:translate-y-0 transition-transform">i</span>
                <span className="text-white transform scale-110 hover:scale-100 transition-transform">b</span>
                <span className="text-seahawks-gray transform -translate-y-0.5 hover:-translate-y-0 transition-transform">e</span>
              </div>
              <span className="ml-3 font-bold text-sm tracking-[0.3em] text-seahawks-green uppercase opacity-80 group-hover:opacity-100 transition-opacity">Writer</span>
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
                <span className="text-white font-medium">{activeProject.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleSplitMode} title="Toggle Split Screen" className={clsx("p-2 rounded-md transition-colors", splitMode ? "text-seahawks-navy bg-seahawks-green hover:bg-white" : "hover:bg-[#001730] text-seahawks-gray hover:text-seahawks-green")}><Columns size={18} /></button>
            <div className="w-px h-6 bg-[#001730] mx-1" />
            <button className="p-2 rounded-md hover:bg-[#001730] text-seahawks-gray transition-colors"><Search size={18} /></button>
            <button className="p-2 rounded-md hover:bg-[#001730] text-seahawks-gray transition-colors"><History size={18} /></button>
            <button className="p-2 rounded-md hover:bg-[#001730] text-seahawks-gray transition-colors hover:text-seahawks-green"><BookOpen size={18} /></button>
            <button onClick={() => openAiSettings('persona')} title="AI Skills & Personas" className="p-2 rounded-md hover:bg-[#001730] text-seahawks-green transition-colors hover:text-white"><Sparkles size={18} /></button>
            <button onClick={() => setExportModalOpen(true)} title="Export Document(s)" className="p-2 rounded-md hover:bg-[#001730] text-seahawks-gray transition-colors hover:text-white"><Download size={18} /></button>

            <div className="w-px h-6 bg-[#001730] mx-1" />

            {/* Kept original JSON workspace backup as strictly an upload icon, since user wanted both export capabilities */}
            <button onClick={handleExportWorkspaceJson} title="Backup Workspace JSON" className="p-2 rounded-md hover:bg-[#001730] text-seahawks-gray transition-colors hover:text-white text-xs font-mono px-3 border border-seahawks-gray/20 hover:border-seahawks-gray/50">Backup</button>
            <button onClick={handleImportClick} title="Restore Workspace JSON" className="p-2 rounded-md hover:bg-[#001730] text-seahawks-gray transition-colors hover:text-white"><Upload size={18} /></button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportWorkspace} />

            <div className="w-px h-6 bg-[#001730] mx-1" />

            <button onClick={() => openAiSettings('api')} title="AI Connections & CLI / OAuth" className="p-2 rounded-md hover:bg-[#001730] text-seahawks-gray transition-colors hover:text-white"><Settings size={18} /></button>
          </div>
        </header>

        {/* Editor Wrapper */}
        <div className="flex-1 flex flex-row overflow-hidden relative w-full h-full">
          {/* Primary View */}
          <div className={clsx("h-full relative transition-all duration-300 flex flex-col", splitMode ? "w-1/2 border-r border-[#001024]" : "w-full")}>
            <EditorArea documentId={activeDocumentId} isSecondary={false} />
          </div>

          {/* Secondary View */}
          {splitMode && (
            <div className="w-1/2 h-full relative flex flex-col bg-[#001429]">
              <EditorArea documentId={activeDocumentIdSecondary} isSecondary={true} />
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
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-lg border border-seahawks-gray/20 bg-[#001730]/95 backdrop-blur-sm text-seahawks-gray hover:text-white hover:border-seahawks-green/40 hover:bg-seahawks-navy transition-colors shadow-lg"
        >
          <Menu size={18} />
        </button>
      )}

    </div>
  );
}

export default App;

function ProjectHubModal({ isOpen, onClose, projects, activeProjectId, onOpenProject, onCreateProject }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#001024]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[86vh] overflow-hidden rounded-xl border border-[#001024] bg-seahawks-navy shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-[#001024] flex items-center justify-between bg-seahawks-navy/60">
          <div>
            <h2 className="text-white font-bold text-xl flex items-center gap-2">
              <FolderOpen size={18} className="text-seahawks-green" />
              Project Hub
            </h2>
            <p className="text-sm text-seahawks-gray mt-1">
              View all projects and jump between them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateProject}
              className="px-3 py-2 rounded-md text-sm font-medium bg-seahawks-green/10 text-seahawks-green border border-seahawks-green/30 hover:bg-seahawks-green hover:text-[#001024] transition-colors flex items-center gap-1.5"
              title="Create Project"
            >
              <Plus size={14} />
              New Project
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-md text-seahawks-gray hover:text-white hover:bg-[#001730] transition-colors flex items-center justify-center"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="rounded-lg border border-seahawks-gray/10 bg-[#001730] p-6 text-center text-seahawks-gray">
              No projects yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => {
                const isActive = project.id === activeProjectId;
                return (
                  <button
                    key={project.id}
                    onClick={() => onOpenProject(project.id)}
                    className={clsx(
                      'text-left rounded-xl border p-4 transition-all shadow-sm',
                      isActive
                        ? 'border-seahawks-green/40 bg-seahawks-green/5'
                        : 'border-seahawks-gray/10 bg-[#001730] hover:border-seahawks-gray/30 hover:bg-[#001730]/80'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={clsx('font-semibold truncate', isActive ? 'text-seahawks-green' : 'text-white')}>
                          {project.name}
                        </div>
                        <div className="text-xs text-seahawks-gray mt-1">
                          Created {formatProjectDate(project.createdAt)}
                        </div>
                        <div className="text-xs text-seahawks-gray/80 mt-0.5">
                          Updated {formatProjectDate(project.updatedAt)}
                        </div>
                      </div>
                      {isActive && (
                        <span className="text-[10px] px-2 py-1 rounded border border-seahawks-green/30 bg-seahawks-green/10 text-seahawks-green font-bold uppercase tracking-wide shrink-0">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="mt-4 text-xs text-seahawks-gray">
                      Click to open this project
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatProjectDate(value) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString();
}
