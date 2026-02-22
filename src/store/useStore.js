import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

const MAX_SNAPSHOTS_PER_DOCUMENT = 50;
const AUTO_SNAPSHOT_MIN_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const AUTO_SNAPSHOT_MIN_TEXT_LENGTH = 120;

function calculateCounts(textContent = '') {
    const words = textContent.trim().split(/\s+/).filter(word => word.length > 0).length;
    const tokens = Math.ceil(words * 1.3);
    return { words, tokens };
}

function pruneSnapshotsForDocument(documentVersions, documentId) {
    const versionsForDoc = documentVersions
        .filter(v => v.documentId === documentId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (versionsForDoc.length <= MAX_SNAPSHOTS_PER_DOCUMENT) return documentVersions;

    const toRemove = new Set(
        versionsForDoc
            .slice(0, versionsForDoc.length - MAX_SNAPSHOTS_PER_DOCUMENT)
            .map(v => v.id)
    );

    return documentVersions.filter(v => !toRemove.has(v.id));
}

function createSnapshotRecord({ documentId, documentName, htmlContent, textContent, source = 'manual', label = '' }) {
    const { words, tokens } = calculateCounts(textContent);
    return {
        id: uuidv4(),
        documentId,
        documentName,
        content: htmlContent,
        textPreview: (textContent || '').slice(0, 300),
        wordCount: words,
        tokenCount: tokens,
        source, // 'manual' | 'auto'
        label,
        createdAt: new Date().toISOString(),
    };
}

function buildUniqueSnapshotDocumentName(baseName, documents = []) {
    const stem = `${baseName || 'Document'}_restored`;
    const existingNames = new Set(documents.map(d => d.name));
    if (!existingNames.has(stem)) return stem;

    let i = 2;
    while (existingNames.has(`${stem}_${i}`)) {
        i += 1;
    }
    return `${stem}_${i}`;
}

const useStore = create(
    persist(
        (set, get) => ({
            // --- STATE ---
            activeProjectId: null,
            activeDocumentId: null,
            splitMode: false,
            activeDocumentIdSecondary: null,

            projects: [], // { id, name, createdAt, updatedAt }
            folders: [], // { id, projectId, name, order }
            documents: [], // { id, folderId, name, content, order, includeInContext, wordCount, tokenCount }
            documentVersions: [], // { id, documentId, documentName, content, textPreview, wordCount, tokenCount, source, label, createdAt }
            personas: [], // { id, title, description, systemPrompt }

            settings: {
                openRouterApiKey: '',
                openAiApiKey: '',
                openAiCliEnabled: false,
                themeMode: 'dark', // 'dark' | 'light' | 'system'
                quickAiContinueEnabled: false,
            },

            // --- ACTIONS ---

            // Projects
            createProject: (name) => set((state) => {
                const newProject = {
                    id: uuidv4(),
                    name,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                return {
                    projects: [...state.projects, newProject],
                    activeProjectId: newProject.id, // Auto-select new project
                    activeDocumentId: null,
                    splitMode: false,
                    activeDocumentIdSecondary: null,
                };
            }),

            setActiveProject: (id) => set({
                activeProjectId: id,
                activeDocumentId: null,
                splitMode: false,
                activeDocumentIdSecondary: null
            }),

            // Folders
            createFolder: (projectId, name) => set((state) => {
                const newFolder = {
                    id: uuidv4(),
                    projectId,
                    name,
                    order: state.folders.filter(f => f.projectId === projectId).length,
                };
                return { folders: [...state.folders, newFolder] };
            }),

            deleteFolder: (id) => set((state) => {
                const deletedDocIds = new Set(state.documents.filter(d => d.folderId === id).map(d => d.id));
                return {
                    folders: state.folders.filter(f => f.id !== id),
                    documents: state.documents.filter(d => d.folderId !== id),
                    documentVersions: state.documentVersions.filter(v => !deletedDocIds.has(v.documentId)),
                    activeDocumentId: state.documents.find(d => d.id === state.activeDocumentId)?.folderId === id ? null : state.activeDocumentId,
                    activeDocumentIdSecondary: state.documents.find(d => d.id === state.activeDocumentIdSecondary)?.folderId === id ? null : state.activeDocumentIdSecondary,
                };
            }),

            // Documents
            createDocument: (folderId, name, content = '') => set((state) => {
                const newDoc = {
                    id: uuidv4(),
                    folderId,
                    name,
                    content,
                    order: state.documents.filter(d => d.folderId === folderId).length,
                    includeInContext: true, // Default to true for story context
                    wordCount: 0,
                    tokenCount: 0,
                };
                return {
                    documents: [...state.documents, newDoc],
                    activeDocumentId: newDoc.id, // Auto-select new doc
                };
            }),

            setActiveDocument: (id) => set((state) => {
                // If attempting to open a doc in main view that is already open in split view, close it in split
                let updates = { activeDocumentId: id };
                if (state.activeDocumentIdSecondary === id) {
                    updates.activeDocumentIdSecondary = null;
                }
                return updates;
            }),

            toggleSplitMode: () => set((state) => ({
                splitMode: !state.splitMode,
                // If turning split mode ON, try to put nothing in the second pane to start or a generic state
                // If turning it OFF, clear the secondary document
                activeDocumentIdSecondary: state.splitMode ? null : state.activeDocumentIdSecondary
            })),

            setActiveDocumentSecondary: (id) => set((state) => {
                // If attempting to open a doc in split view that is already open in main view, optionally swap them or just set it
                let updates = { activeDocumentIdSecondary: id };
                // Enforce split mode is on if we set a secondary doc
                updates.splitMode = true;
                if (state.activeDocumentId === id) {
                    updates.activeDocumentId = null;
                }
                return updates;
            }),

            updateDocumentContent: (id, htmlContent, textContent) => set((state) => {
                const { words, tokens } = calculateCounts(textContent);
                const currentDoc = state.documents.find(doc => doc.id === id);
                const nextDocuments = state.documents.map(doc =>
                    doc.id === id
                        ? { ...doc, content: htmlContent, wordCount: words, tokenCount: tokens }
                        : doc
                );

                let nextVersions = state.documentVersions;
                const normalizedText = (textContent || '').trim();

                if (currentDoc && normalizedText.length >= AUTO_SNAPSHOT_MIN_TEXT_LENGTH && currentDoc.content !== htmlContent) {
                    const latestVersion = state.documentVersions
                        .filter(v => v.documentId === id)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

                    const latestVersionTime = latestVersion ? new Date(latestVersion.createdAt).getTime() : 0;
                    const now = Date.now();
                    const elapsed = now - latestVersionTime;
                    const contentChangedSinceLatest = !latestVersion || latestVersion.content !== htmlContent;

                    if (contentChangedSinceLatest && (!latestVersion || elapsed >= AUTO_SNAPSHOT_MIN_INTERVAL_MS)) {
                        const snapshot = createSnapshotRecord({
                            documentId: id,
                            documentName: currentDoc.name,
                            htmlContent,
                            textContent,
                            source: 'auto',
                        });

                        nextVersions = pruneSnapshotsForDocument([...state.documentVersions, snapshot], id);
                    }
                }

                return {
                    documents: nextDocuments,
                    documentVersions: nextVersions,
                };
            }),

            updateDocumentName: (id, name) => set((state) => ({
                documents: state.documents.map(doc =>
                    doc.id === id ? { ...doc, name } : doc
                )
            })),

            toggleDocumentContext: (id) => set((state) => ({
                documents: state.documents.map(doc =>
                    doc.id === id ? { ...doc, includeInContext: !doc.includeInContext } : doc
                )
            })),

            deleteDocument: (id) => set((state) => ({
                documents: state.documents.filter(d => d.id !== id),
                documentVersions: state.documentVersions.filter(v => v.documentId !== id),
                activeDocumentId: state.activeDocumentId === id ? null : state.activeDocumentId,
                activeDocumentIdSecondary: state.activeDocumentIdSecondary === id ? null : state.activeDocumentIdSecondary,
            })),

            // Version History (Snapshots)
            createDocumentSnapshot: (documentId, options = {}) => set((state) => {
                const doc = state.documents.find(d => d.id === documentId);
                if (!doc) return state;

                const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
                if (tempDiv) tempDiv.innerHTML = doc.content || '';
                const textContent = tempDiv ? (tempDiv.textContent || '') : '';

                const snapshot = createSnapshotRecord({
                    documentId: doc.id,
                    documentName: doc.name,
                    htmlContent: doc.content || '',
                    textContent,
                    source: options.source || 'manual',
                    label: options.label || '',
                });

                return {
                    documentVersions: pruneSnapshotsForDocument([...state.documentVersions, snapshot], doc.id),
                };
            }),

            getDocumentSnapshots: (documentId) => {
                return get()
                    .documentVersions
                    .filter(v => v.documentId === documentId)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            },

            restoreDocumentSnapshot: (documentId, snapshotId) => set((state) => {
                const snapshot = state.documentVersions.find(v => v.id === snapshotId && v.documentId === documentId);
                if (!snapshot) return state;

                return {
                    documents: state.documents.map(doc =>
                        doc.id === documentId
                            ? {
                                ...doc,
                                content: snapshot.content,
                                wordCount: snapshot.wordCount ?? doc.wordCount,
                                tokenCount: snapshot.tokenCount ?? doc.tokenCount,
                            }
                            : doc
                    )
                };
            }),

            duplicateDocumentSnapshotAsDocument: (snapshotId, options = {}) => set((state) => {
                const snapshot = state.documentVersions.find(v => v.id === snapshotId);
                if (!snapshot) return state;

                const sourceDoc = state.documents.find(d => d.id === snapshot.documentId);
                if (!sourceDoc) return state;

                const name = options.name || buildUniqueSnapshotDocumentName(snapshot.documentName || sourceDoc.name, state.documents);
                const newDoc = {
                    id: uuidv4(),
                    folderId: sourceDoc.folderId,
                    name,
                    content: snapshot.content || '',
                    order: state.documents.filter(d => d.folderId === sourceDoc.folderId).length,
                    includeInContext: true,
                    wordCount: snapshot.wordCount || 0,
                    tokenCount: snapshot.tokenCount || 0,
                };

                return {
                    documents: [...state.documents, newDoc],
                    activeDocumentId: newDoc.id,
                    splitMode: false,
                    activeDocumentIdSecondary: null,
                };
            }),

            // Settings
            updateSettings: (newSettings) => set((state) => ({
                settings: { ...state.settings, ...newSettings }
            })),

            // Personas (Skills)
            createPersona: (title, description, systemPrompt) => set((state) => ({
                personas: [...state.personas, { id: uuidv4(), title, description, systemPrompt }]
            })),

            updatePersona: (id, updates) => set((state) => ({
                personas: state.personas.map(p => p.id === id ? { ...p, ...updates } : p)
            })),

            deletePersona: (id) => set((state) => ({
                personas: state.personas.filter(p => p.id !== id)
            })),

            // Helper for first run initialization
            initializeDemoData: () => set((state) => {
                if (state.projects.length > 0) return state; // Only run if empty

                const projectId = uuidv4();

                return {
                    activeProjectId: projectId,
                    activeDocumentId: null,
                    projects: [{ id: projectId, name: 'My First Project', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
                    folders: [],
                    documents: [],
                    documentVersions: [],
                    personas: [
                        { id: uuidv4(), title: 'Strict Editor', description: 'Focuses on technical perfection and critique.', systemPrompt: 'You are a ruthless, highly critical editor. Point out every single grammar mistake, plot inconsistency, and weak verb. Do not hold back. Suggest punchy alternatives.' },
                        { id: uuidv4(), title: 'Creative Muse', description: 'Focuses on brainstorming and expansion.', systemPrompt: 'You are an imaginative creative writing partner. Help the author brainstorm wild ideas, expand on metaphors, and push the boundaries of their concepts. Respond enthusiastically and creatively.' }
                    ]
                };
            })
        }),
        {
            name: 'vibe-processor-storage', // unique name for localStorage key
        }
    )
);

export default useStore;
