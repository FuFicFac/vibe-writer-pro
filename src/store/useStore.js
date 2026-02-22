import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

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
            personas: [], // { id, title, description, systemPrompt }

            settings: {
                openRouterApiKey: '',
                openAiApiKey: '',
                openAiCliEnabled: false,
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

            deleteFolder: (id) => set((state) => ({
                folders: state.folders.filter(f => f.id !== id),
                documents: state.documents.filter(d => d.folderId !== id),
                activeDocumentId: state.documents.find(d => d.id === state.activeDocumentId)?.folderId === id ? null : state.activeDocumentId,
            })),

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
                // Very basic word count approximation
                const words = textContent.trim().split(/\s+/).filter(word => word.length > 0).length;
                // Basic token count approximation (1 word ~ 1.3 tokens)
                const tokens = Math.ceil(words * 1.3);

                return {
                    documents: state.documents.map(doc =>
                        doc.id === id
                            ? { ...doc, content: htmlContent, wordCount: words, tokenCount: tokens }
                            : doc
                    )
                };
            }),

            toggleDocumentContext: (id) => set((state) => ({
                documents: state.documents.map(doc =>
                    doc.id === id ? { ...doc, includeInContext: !doc.includeInContext } : doc
                )
            })),

            deleteDocument: (id) => set((state) => ({
                documents: state.documents.filter(d => d.id !== id),
                activeDocumentId: state.activeDocumentId === id ? null : state.activeDocumentId,
                activeDocumentIdSecondary: state.activeDocumentIdSecondary === id ? null : state.activeDocumentIdSecondary,
            })),

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
