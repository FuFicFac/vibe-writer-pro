import React, { useState } from 'react';
import useStore from '../store/useStore';
import { X, Settings2, KeyRound, Bot, Sparkles, UserCircle2, Plus, Trash2, Palette, SunMedium, Moon, Keyboard, Monitor, Brain, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const PREFERRED_OPENROUTER_MODELS = ['openrouter/auto', 'openai/gpt-4.1-mini', 'anthropic/claude-sonnet-4.5'];
const PREFERRED_OPENAI_MODELS = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'o4-mini', 'o3-mini'];

function preferredRank(id, preferredIds) {
    const idx = preferredIds.indexOf(id);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

export default function AiSettingsModal({ isOpen, onClose, mode = 'all' }) {
    const { settings, updateSettings, personas, createPersona, updatePersona, deletePersona } = useStore();
    const isPersonaOnly = mode === 'persona';
    const isApiOnly = mode === 'api';
    const showPersonaTab = !isApiOnly;
    const showApiTab = !isPersonaOnly;
    const defaultTab = isApiOnly ? 'api' : 'persona';

    const [openRouterKey, setOpenRouterKey] = useState(settings.openRouterApiKey || '');
    const [openRouterModel, setOpenRouterModel] = useState(settings.openRouterModel || DEFAULT_OPENROUTER_MODEL);
    const [openRouterThinkingEnabled, setOpenRouterThinkingEnabled] = useState(Boolean(settings.openRouterThinkingEnabled));
    const [openAiKey, setOpenAiKey] = useState(settings.openAiApiKey || '');
    const [openAiModel, setOpenAiModel] = useState(settings.openAiModel || DEFAULT_OPENAI_MODEL);
    const [themeMode, setThemeMode] = useState(settings.themeMode || 'dark');
    const [quickAiContinueEnabled, setQuickAiContinueEnabled] = useState(Boolean(settings.quickAiContinueEnabled));
    const [activeTab, setActiveTab] = useState(defaultTab); // 'persona' or 'api'

    // Default to the first persona in the list
    const [selectedPersonaId, setSelectedPersonaId] = useState(personas.length > 0 ? personas[0].id : null);

    // Local edit state
    const [editForm, setEditForm] = useState({ title: '', description: '', systemPrompt: '' });
    const [openRouterModels, setOpenRouterModels] = useState([]);
    const [openRouterModelsLoading, setOpenRouterModelsLoading] = useState(false);
    const [openRouterModelsError, setOpenRouterModelsError] = useState('');
    const [openRouterModelSearch, setOpenRouterModelSearch] = useState('');
    const [openAiModels, setOpenAiModels] = useState([]);
    const [openAiModelsLoading, setOpenAiModelsLoading] = useState(false);
    const [openAiModelsError, setOpenAiModelsError] = useState('');
    const [openAiModelsSource, setOpenAiModelsSource] = useState('');
    const [openAiModelSearch, setOpenAiModelSearch] = useState('');

    // Sync form when selection changes
    React.useEffect(() => {
        if (selectedPersonaId) {
            const p = personas.find(x => x.id === selectedPersonaId);
            if (p) {
                setEditForm({ title: p.title, description: p.description, systemPrompt: p.systemPrompt });
            }
        }
    }, [selectedPersonaId, personas]);

    React.useEffect(() => {
        if (isOpen) {
            setOpenRouterKey(settings.openRouterApiKey || '');
            setOpenRouterModel(settings.openRouterModel || DEFAULT_OPENROUTER_MODEL);
            setOpenRouterThinkingEnabled(Boolean(settings.openRouterThinkingEnabled));
            setOpenAiKey(settings.openAiApiKey || '');
            setOpenAiModel(settings.openAiModel || DEFAULT_OPENAI_MODEL);
            setThemeMode(settings.themeMode || 'dark');
            setQuickAiContinueEnabled(Boolean(settings.quickAiContinueEnabled));
            setActiveTab(defaultTab);
        }
    }, [isOpen, settings.openRouterApiKey, settings.openRouterModel, settings.openRouterThinkingEnabled, settings.openAiApiKey, settings.openAiModel, settings.themeMode, settings.quickAiContinueEnabled, defaultTab]);

    React.useEffect(() => {
        if (!isOpen || !showPersonaTab) return;
        if (openRouterModels.length > 0 || openRouterModelsLoading) return;
        loadOpenRouterModels();
    }, [isOpen, showPersonaTab]); // intentionally only on open/show

    React.useEffect(() => {
        if (!isOpen || !showApiTab) return;
        if (openAiModels.length > 0 || openAiModelsLoading) return;
        loadOpenAiModels();
    }, [isOpen, showApiTab]); // intentionally only on open/show

    if (!isOpen) return null;

    const handleSaveAPI = () => {
        updateSettings({
            openRouterApiKey: openRouterKey.trim(),
            openRouterModel: openRouterModel || DEFAULT_OPENROUTER_MODEL,
            openRouterThinkingEnabled: Boolean(openRouterThinkingEnabled),
            openAiApiKey: openAiKey.trim(),
            openAiModel: openAiModel || DEFAULT_OPENAI_MODEL,
            themeMode: themeMode === 'light' ? 'light' : 'dark',
            quickAiContinueEnabled: Boolean(quickAiContinueEnabled),
        });
        // Persona changes are saved immediately via onBlur/onChange logic below, 
        // but API keys we save on explicit close/save
        onClose();
    };

    const handleCreateNew = () => {
        const id = uuidv4();
        // createPersona generates its own ID, so we just use the global action
        createPersona('New Skill', 'Description of this persona...', 'You are...');
        // We need to wait for render or just manually grab the last one. 
        // A better pattern: create returns ID, or we just select it on next render.
        // For now, we'll let it render and user has to click it, or we find it by generic name.
    };

    const handleUpdateField = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
        if (selectedPersonaId) {
            // Auto-save the persona to the store
            updatePersona(selectedPersonaId, { [field]: value });
        }
    };

    const handleThemeModeChange = (mode) => {
        const nextMode = mode === 'light' ? 'light' : mode === 'system' ? 'system' : 'dark';
        setThemeMode(nextMode);
        // Apply immediately so the user gets instant visual feedback.
        updateSettings({ themeMode: nextMode });
    };

    const handleQuickAiContinueToggle = () => {
        setQuickAiContinueEnabled((prev) => {
            const next = !prev;
            updateSettings({ quickAiContinueEnabled: next });
            return next;
        });
    };

    const loadOpenRouterModels = async () => {
        setOpenRouterModelsLoading(true);
        setOpenRouterModelsError('');
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models');
            if (!response.ok) {
                throw new Error(`OpenRouter models request failed (${response.status})`);
            }
            const data = await response.json();
            const models = Array.isArray(data?.data) ? data.data : [];

            const normalized = models
                .filter((m) => m?.id && (m?.architecture?.output_modalities || ['text']).includes('text'))
                .map((m) => ({
                    id: m.id,
                    name: m.name || m.id,
                    contextLength: m.context_length || m.top_provider?.context_length || null,
                    supportsReasoning: Array.isArray(m.supported_parameters)
                        ? m.supported_parameters.includes('reasoning')
                        : false,
                    supportedParameters: Array.isArray(m.supported_parameters) ? m.supported_parameters : [],
                }))
                .sort((a, b) => {
                    const rankDiff = preferredRank(a.id, PREFERRED_OPENROUTER_MODELS) - preferredRank(b.id, PREFERRED_OPENROUTER_MODELS);
                    if (rankDiff !== 0) return rankDiff;
                    return a.name.localeCompare(b.name);
                });

            setOpenRouterModels(normalized);

            if (!normalized.some(m => m.id === openRouterModel)) {
                const fallback = normalized.find(m => m.id === DEFAULT_OPENROUTER_MODEL) || normalized[0];
                if (fallback) setOpenRouterModel(fallback.id);
            }
        } catch (error) {
            console.error('Failed to load OpenRouter models:', error);
            setOpenRouterModelsError(error.message || 'Failed to load model list.');
        } finally {
            setOpenRouterModelsLoading(false);
        }
    };

    const filteredOpenRouterModels = openRouterModels.filter((model) => {
        const q = openRouterModelSearch.trim().toLowerCase();
        if (!q) return true;
        return model.id.toLowerCase().includes(q) || model.name.toLowerCase().includes(q);
    });

    const selectedOpenRouterModelMeta = openRouterModels.find(m => m.id === openRouterModel) || null;
    const selectedModelSupportsReasoning = Boolean(selectedOpenRouterModelMeta?.supportsReasoning);

    React.useEffect(() => {
        if (!openRouterModels.length) return;
        if (!openRouterModels.some(m => m.id === openRouterModel)) {
            const fallback = openRouterModels.find(m => m.id === DEFAULT_OPENROUTER_MODEL) || openRouterModels[0];
            if (fallback) setOpenRouterModel(fallback.id);
        }
    }, [openRouterModel, openRouterModels]);

    React.useEffect(() => {
        if (selectedOpenRouterModelMeta && !selectedOpenRouterModelMeta.supportsReasoning && openRouterThinkingEnabled) {
            setOpenRouterThinkingEnabled(false);
        }
    }, [selectedOpenRouterModelMeta, openRouterThinkingEnabled]);

    const handleOpenRouterModelChange = (value) => {
        setOpenRouterModel(value);
        const modelMeta = openRouterModels.find(m => m.id === value);
        if (modelMeta && !modelMeta.supportsReasoning) {
            setOpenRouterThinkingEnabled(false);
        }
    };

    const loadOpenAiModels = async () => {
        setOpenAiModelsLoading(true);
        setOpenAiModelsError('');
        try {
            const response = await fetch('/api/openai-cli/models');
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                setOpenAiModelsError(data?.error || `OpenAI models request failed (${response.status})`);
                setOpenAiModelsSource(data?.source || '');
                return;
            }

            const models = Array.isArray(data?.models) ? data.models : [];
            const normalized = models
                .filter((m) => m?.id)
                .map((m) => ({
                    id: m.id,
                    ownedBy: m.owned_by || m.ownedBy || '',
                    created: m.created || null,
                }))
                .sort((a, b) => {
                    const rankDiff = preferredRank(a.id, PREFERRED_OPENAI_MODELS) - preferredRank(b.id, PREFERRED_OPENAI_MODELS);
                    if (rankDiff !== 0) return rankDiff;
                    return a.id.localeCompare(b.id);
                });

            setOpenAiModels(normalized);
            setOpenAiModelsSource(data?.source || '');

            if (!normalized.some(m => m.id === openAiModel)) {
                const fallback = normalized.find(m => m.id === DEFAULT_OPENAI_MODEL) || normalized[0];
                if (fallback) setOpenAiModel(fallback.id);
            }
        } catch (error) {
            console.error('Failed to load OpenAI models:', error);
            setOpenAiModelsError(error.message || 'Failed to load OpenAI model list.');
        } finally {
            setOpenAiModelsLoading(false);
        }
    };

    const filteredOpenAiModels = openAiModels.filter((model) => {
        const q = openAiModelSearch.trim().toLowerCase();
        if (!q) return true;
        return model.id.toLowerCase().includes(q) || String(model.ownedBy || '').toLowerCase().includes(q);
    });

    React.useEffect(() => {
        if (!openAiModels.length) return;
        if (!openAiModels.some(m => m.id === openAiModel)) {
            const fallback = openAiModels.find(m => m.id === DEFAULT_OPENAI_MODEL) || openAiModels[0];
            if (fallback) setOpenAiModel(fallback.id);
        }
    }, [openAiModel, openAiModels]);

    // The handleSave was replaced by handleSaveAPI above

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center vw-overlay backdrop-blur-md p-4">
            <div className="vw-surface border vw-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">

                <div className="px-6 py-4 border-b vw-border bg-seahawks-navy/50 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold vw-text-primary flex items-center gap-2">
                        {isApiOnly ? <Settings2 size={20} className="text-seahawks-green" /> : <Sparkles size={20} className="text-seahawks-green" />}
                        {isApiOnly ? 'AI Connection Settings' : 'AI Assistant Configuration'}
                    </h2>
                    <button onClick={onClose} className="text-seahawks-gray hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* Left Side: Tabs */}
                    {(showPersonaTab && showApiTab) ? (
                        <div className="w-full md:w-48 border-b md:border-b-0 md:border-r vw-border vw-surface-2 flex md:flex-col shrink-0">
                            <button
                                onClick={() => setActiveTab('persona')}
                                className={clsx(
                                    "flex-1 md:flex-none flex items-center gap-3 px-4 py-4 md:py-3 text-sm font-medium transition-colors border-l-2",
                                    activeTab === 'persona'
                                        ? "bg-seahawks-navy/50 text-seahawks-gray border-seahawks-green"
                                        : "text-seahawks-gray hover:bg-seahawks-navy/30 border-transparent hover:text-white"
                                )}
                            >
                                <UserCircle2 size={16} className={activeTab === 'persona' ? "text-seahawks-green" : "opacity-60"} />
                                Skills & Persona
                            </button>
                            <button
                                onClick={() => setActiveTab('api')}
                                className={clsx(
                                    "flex-1 md:flex-none flex items-center gap-3 px-4 py-4 md:py-3 text-sm font-medium transition-colors border-l-2",
                                    activeTab === 'api'
                                        ? "bg-seahawks-navy/50 text-seahawks-gray border-seahawks-green"
                                        : "text-seahawks-gray hover:bg-seahawks-navy/30 border-transparent hover:text-white"
                                )}
                            >
                                <Settings2 size={16} className={activeTab === 'api' ? "text-seahawks-green" : "opacity-60"} />
                                API Connections
                            </button>
                        </div>
                    ) : (
                        <div className="w-full md:w-48 border-b md:border-b-0 md:border-r vw-border vw-surface-2 flex md:flex-col shrink-0">
                            <div className="px-4 py-4 md:py-3 text-sm font-medium text-seahawks-gray flex items-center gap-3 border-l-2 border-seahawks-green bg-seahawks-navy/40">
                                {isApiOnly ? <Settings2 size={16} className="text-seahawks-green" /> : <UserCircle2 size={16} className="text-seahawks-green" />}
                                {isApiOnly ? 'API Connections' : 'Skills & Persona'}
                            </div>
                        </div>
                    )}

                    {/* Right Side: Tab Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-seahawks-navy">

                        {showPersonaTab && activeTab === 'persona' && (
                            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">

                                <div className="mb-6 flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-semibold vw-text-primary mb-2 flex items-center gap-2">
                                            <Bot size={18} className="text-seahawks-green" />
                                            Skills / Persona Library
                                        </h3>
                                        <p className="text-sm text-seahawks-gray leading-relaxed">
                                            Create and manage the different expert "Skills" your AI can use.
                                            Select one from the list below to edit its system instructions.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleCreateNew}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-seahawks-green/10 text-seahawks-green rounded-md hover:bg-seahawks-green hover:text-[#001024] transition-colors text-sm font-medium border border-seahawks-green/30"
                                    >
                                        <Plus size={16} /> New Skill
                                    </button>
                                </div>

                                <div className="mb-6 rounded-lg border border-seahawks-gray/10 vw-surface-2 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h4 className="text-sm font-semibold vw-text-primary flex items-center gap-2">
                                                <Brain size={16} className="text-seahawks-green" />
                                                OpenRouter Model Picker
                                            </h4>
                                            <p className="text-xs text-seahawks-gray mt-1 leading-relaxed">
                                                Used for AI actions when OpenRouter is the active provider (CLI mode ignores this).
                                                Thinking can be toggled only for models that support OpenRouter <code>reasoning</code>.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={loadOpenRouterModels}
                                            disabled={openRouterModelsLoading}
                                            className={clsx(
                                                'shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors',
                                                openRouterModelsLoading
                                                    ? 'border-seahawks-gray/20 text-seahawks-gray cursor-not-allowed'
                                                    : 'border-seahawks-green/30 text-seahawks-green hover:bg-seahawks-green/10'
                                            )}
                                            title="Refresh model list from OpenRouter"
                                        >
                                            <RefreshCw size={13} className={clsx(openRouterModelsLoading && 'animate-spin')} />
                                            Refresh
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_auto] gap-3 mt-4">
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={openRouterModelSearch}
                                                onChange={(e) => setOpenRouterModelSearch(e.target.value)}
                                                placeholder="Search OpenRouter models..."
                                                className="w-full vw-surface-3 border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm vw-text-primary focus:outline-none focus:border-seahawks-green transition-colors"
                                            />
                                            <select
                                                value={openRouterModel}
                                                onChange={(e) => handleOpenRouterModelChange(e.target.value)}
                                                className="w-full vw-surface-3 border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm vw-text-primary focus:outline-none focus:border-seahawks-green transition-colors"
                                            >
                                                {(filteredOpenRouterModels.length ? filteredOpenRouterModels : [{ id: openRouterModel, name: openRouterModel }]).map((model) => (
                                                    <option key={model.id} value={model.id}>
                                                        {model.name} ({model.id})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex flex-col gap-2 min-w-[220px]">
                                            <button
                                                type="button"
                                                disabled={!selectedModelSupportsReasoning}
                                                onClick={() => setOpenRouterThinkingEnabled((prev) => !prev)}
                                                className={clsx(
                                                    'flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors',
                                                    !selectedModelSupportsReasoning
                                                        ? 'border-seahawks-gray/20 text-seahawks-gray/60 cursor-not-allowed opacity-70'
                                                        : openRouterThinkingEnabled
                                                            ? 'border-seahawks-green/40 bg-seahawks-green/10 text-seahawks-green'
                                                            : 'border-seahawks-gray/20 text-seahawks-gray hover:text-white hover:bg-seahawks-navy/30'
                                                )}
                                                title={selectedModelSupportsReasoning ? 'Toggle OpenRouter reasoning (thinking)' : 'Selected model does not expose reasoning controls'}
                                            >
                                                <span>Thinking</span>
                                                <span className="text-xs font-semibold">
                                                    {selectedModelSupportsReasoning ? (openRouterThinkingEnabled ? 'On' : 'Off') : 'Unsupported'}
                                                </span>
                                            </button>

                                            <div className="text-[11px] text-seahawks-gray leading-relaxed">
                                                {openRouterModelsLoading
                                                    ? 'Loading OpenRouter model list...'
                                                    : openRouterModelsError
                                                        ? `Model list error: ${openRouterModelsError}`
                                                        : selectedOpenRouterModelMeta
                                                            ? `${selectedOpenRouterModelMeta.contextLength ? `${selectedOpenRouterModelMeta.contextLength.toLocaleString()} context` : 'Context unknown'} • ${selectedModelSupportsReasoning ? 'Reasoning supported' : 'No reasoning control'}`
                                                            : 'Select a model to see capabilities.'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">

                                    {/* Left half: List of Personas */}
                                    <div className="w-full md:w-1/3 flex flex-col gap-2 overflow-y-auto pr-2 border-r vw-border custom-scrollbar">
                                        {personas.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedPersonaId(p.id)}
                                                className={clsx(
                                                    "text-left p-3 rounded-lg border transition-all relative group",
                                                    selectedPersonaId === p.id
                                                        ? "vw-surface-2 border-seahawks-green shadow-inner"
                                                        : "border-seahawks-gray/10 hover:border-seahawks-gray/30 hover:bg-seahawks-navy/20"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "font-semibold text-sm mb-1 truncate",
                                                        selectedPersonaId === p.id ? "text-seahawks-green" : "vw-text-primary"
                                                )}>
                                                    {p.title || 'Untitled'}
                                                </div>
                                                <div className="text-xs text-seahawks-gray truncate">
                                                    {p.description || 'No description...'}
                                                </div>

                                                {/* Delete Button overlaid on hover */}
                                                <div
                                                    className={clsx(
                                                        "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md vw-surface-3 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 transition-colors opacity-0 group-hover:opacity-100",
                                                        personas.length <= 1 && "hidden" // Don't allow delete if it's the last one
                                                    )}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deletePersona(p.id);
                                                        if (selectedPersonaId === p.id && personas.length > 1) {
                                                            const newSelection = personas.filter(x => x.id !== p.id)[0];
                                                            setSelectedPersonaId(newSelection.id);
                                                        }
                                                    }}
                                                    title="Delete Persona"
                                                >
                                                    <Trash2 size={14} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Right half: Edit Active Persona */}
                                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pl-2">
                                        {!selectedPersonaId ? (
                                            <div className="h-full flex items-center justify-center text-sm text-seahawks-gray">Select a skill to edit</div>
                                        ) : (
                                            <>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-bold text-seahawks-gray uppercase tracking-wider pl-1">Name / Title</label>
                                                    <input
                                                        value={editForm.title}
                                                        onChange={(e) => handleUpdateField('title', e.target.value)}
                                                        className="w-full vw-surface-3 border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm vw-text-primary focus:outline-none focus:border-seahawks-green transition-colors"
                                                        placeholder="e.g. Strict Editor"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-bold text-seahawks-gray uppercase tracking-wider pl-1">Description</label>
                                                    <input
                                                        value={editForm.description}
                                                        onChange={(e) => handleUpdateField('description', e.target.value)}
                                                        className="w-full vw-surface-3 border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm vw-text-primary focus:outline-none focus:border-seahawks-green transition-colors"
                                                        placeholder="Brief summary of this skill..."
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5 flex-1 min-h-[200px]">
                                                    <label className="text-xs font-bold text-seahawks-gray uppercase tracking-wider pl-1">System Instructions</label>
                                                    <textarea
                                                        value={editForm.systemPrompt}
                                                        onChange={(e) => handleUpdateField('systemPrompt', e.target.value)}
                                                        className="w-full flex-1 vw-surface-3 border border-seahawks-gray/20 rounded-md py-3 px-4 text-sm vw-text-primary focus:outline-none focus:border-seahawks-green transition-colors shadow-inner font-sans resize-none placeholder:text-seahawks-gray/30"
                                                        placeholder="You are an expert... Tell the AI exactly how to behave."
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                </div>
                            </div>
                        )}

                        {showApiTab && activeTab === 'api' && (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-semibold vw-text-primary mb-2 flex items-center gap-2">
                                        <KeyRound size={18} className="text-seahawks-green" />
                                        API Connections
                                    </h3>
                                    <p className="text-sm text-seahawks-gray leading-relaxed mb-4">
                                        Manage how Vibe Writer connects to various AI models. Keys are stored locally in your browser and never sent to our servers.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 p-4 vw-surface-2 rounded-lg border border-seahawks-gray/10">
                                    <label className="text-sm font-semibold vw-text-primary">
                                        OpenRouter API Key
                                    </label>
                                    <p className="text-xs text-seahawks-gray mb-2">
                                        Used to access hundreds of different LLMs (Claude, GPT-4, Llama, etc.).
                                    </p>
                                    <input
                                        type="password"
                                        value={openRouterKey}
                                        onChange={(e) => setOpenRouterKey(e.target.value)}
                                        className="w-full vw-surface-3 border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm vw-text-primary focus:outline-none focus:border-seahawks-green transition-colors shadow-inner font-mono placeholder:text-seahawks-gray/30"
                                        placeholder="sk-or-v1-..."
                                    />
                                </div>

                                <div className="flex flex-col gap-2 p-4 vw-surface-2 rounded-lg border border-seahawks-green/20 relative overflow-hidden">
                                    <div className="absolute right-0 top-0 w-16 h-16 bg-seahawks-green/10 rounded-full blur-xl -mr-4 -mt-4" />
                                    <label className="text-sm font-semibold vw-text-primary flex items-center justify-between">
                                        <span>Local CLI (Codex / OpenAI)</span>
                                        {settings.openAiCliEnabled ? (
                                            <span className="text-xs bg-seahawks-green/20 text-seahawks-green px-2 py-0.5 rounded border border-seahawks-green/30">Enabled</span>
                                        ) : (
                                            <span className="text-xs bg-seahawks-gray/10 text-seahawks-gray px-2 py-0.5 rounded border border-seahawks-gray/20">Disabled</span>
                                        )}
                                    </label>
                                    <p className="text-xs text-seahawks-gray mb-1">
                                        Vibe Writer uses a local CLI in the background (prefers logged-in `codex` OAuth/session, falls back to Python `openai` CLI) and does not require a browser-stored key for Codex CLI mode.
                                    </p>
                                    <label className="text-sm mt-1 vw-text-primary font-medium">OpenAI API Key (Optional / legacy fallback)</label>
                                    <input
                                        type="password"
                                        value={openAiKey}
                                        onChange={(e) => setOpenAiKey(e.target.value)}
                                        className="w-full vw-surface-3 border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm vw-text-primary focus:outline-none focus:border-seahawks-green transition-colors shadow-inner font-mono placeholder:text-seahawks-gray/30"
                                        placeholder="Not required for CLI mode"
                                    />
                                    <div className="text-xs font-mono text-seahawks-green/70">
                                        Status: {settings.openAiCliEnabled ? "Active: using local CLI bridge (Codex preferred)" : "Disabled"}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 p-4 vw-surface-2 rounded-lg border border-seahawks-gray/10">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Brain size={16} className="text-seahawks-green" />
                                                <label className="text-sm font-semibold vw-text-primary">
                                                    OpenAI Model Picker (CLI/API)
                                                </label>
                                            </div>
                                            <p className="text-xs text-seahawks-gray mt-1 leading-relaxed">
                                                Select the model used for the local OpenAI/Codex path. The app will try to load the full live OpenAI models list. In Codex OAuth-only mode, list-all may be unavailable unless Python <code>openai</code> CLI or a server-side OpenAI key is available.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={loadOpenAiModels}
                                            disabled={openAiModelsLoading}
                                            className={clsx(
                                                'shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors',
                                                openAiModelsLoading
                                                    ? 'border-seahawks-gray/20 text-seahawks-gray cursor-not-allowed'
                                                    : 'border-seahawks-green/30 text-seahawks-green hover:bg-seahawks-green/10'
                                            )}
                                        >
                                            <RefreshCw size={13} className={clsx(openAiModelsLoading && 'animate-spin')} />
                                            Refresh
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={openAiModelSearch}
                                            onChange={(e) => setOpenAiModelSearch(e.target.value)}
                                            placeholder="Search OpenAI models..."
                                            className="w-full vw-surface-3 border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm vw-text-primary focus:outline-none focus:border-seahawks-green transition-colors"
                                        />
                                        <select
                                            value={openAiModel}
                                            onChange={(e) => setOpenAiModel(e.target.value)}
                                            className="w-full vw-surface-3 border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm vw-text-primary focus:outline-none focus:border-seahawks-green transition-colors"
                                        >
                                            {(filteredOpenAiModels.length ? filteredOpenAiModels : [{ id: openAiModel }]).map((model) => (
                                                <option key={model.id} value={model.id}>
                                                    {model.id}{model.ownedBy ? ` (${model.ownedBy})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="text-[11px] text-seahawks-gray leading-relaxed">
                                            {openAiModelsLoading
                                                ? 'Loading OpenAI models...'
                                                : openAiModelsError
                                                    ? `Model list unavailable: ${openAiModelsError}`
                                                    : openAiModels.length > 0
                                                        ? `Loaded ${openAiModels.length.toLocaleString()} models${openAiModelsSource ? ` via ${openAiModelsSource}` : ''}. Selected model will be passed to OpenAI CLI or Codex.`
                                                        : 'No models loaded yet. You can still type/select a saved model value.'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 p-4 vw-surface-2 rounded-lg border border-seahawks-gray/10">
                                    <div className="flex items-center gap-2">
                                        <Palette size={16} className="text-seahawks-green" />
                                        <label className="text-sm font-semibold vw-text-primary">
                                            Appearance
                                        </label>
                                    </div>
                                    <p className="text-xs text-seahawks-gray">
                                        Dark mode is the current production theme. Additional theme modes are temporarily disabled while contrast and UI consistency are being finalized.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            disabled
                                            className={clsx(
                                                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                                                'border-seahawks-gray/20 text-seahawks-gray/60 cursor-not-allowed opacity-70'
                                            )}
                                        >
                                            <Monitor size={15} />
                                            System (Coming Soon)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleThemeModeChange('dark')}
                                            className={clsx(
                                                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                                                themeMode === 'dark'
                                                    ? 'border-seahawks-green/40 bg-seahawks-green/10 text-seahawks-green'
                                                    : 'border-seahawks-gray/20 text-seahawks-gray hover:text-white hover:bg-seahawks-navy/30'
                                            )}
                                        >
                                            <Moon size={15} />
                                            Dark Mode
                                        </button>
                                        <button
                                            type="button"
                                            disabled
                                            className={clsx(
                                                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                                                'border-seahawks-gray/20 text-seahawks-gray/60 cursor-not-allowed opacity-70'
                                            )}
                                        >
                                            <SunMedium size={15} />
                                            Light (Coming Soon)
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 p-4 vw-surface-2 rounded-lg border border-seahawks-gray/10">
                                    <div className="flex items-center gap-2">
                                        <Keyboard size={16} className="text-seahawks-green" />
                                        <label className="text-sm font-semibold vw-text-primary">
                                            Quick AI Continue
                                        </label>
                                    </div>
                                    <p className="text-xs text-seahawks-gray">
                                        When enabled, pressing <span className="font-mono text-white">`</span> inside the editor asks AI to continue from your cursor and inserts the next two sentences.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleQuickAiContinueToggle}
                                        className={clsx(
                                            'flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors',
                                            quickAiContinueEnabled
                                                ? 'border-seahawks-green/40 bg-seahawks-green/10 text-seahawks-green'
                                                : 'border-seahawks-gray/20 text-seahawks-gray hover:text-white hover:bg-seahawks-navy/30'
                                        )}
                                    >
                                        <span>{quickAiContinueEnabled ? 'Enabled' : 'Disabled'}</span>
                                        <span className={clsx(
                                            'text-[11px] px-2 py-0.5 rounded border',
                                            quickAiContinueEnabled
                                                ? 'border-seahawks-green/30 bg-seahawks-green/15'
                                                : 'border-seahawks-gray/20'
                                        )}>
                                            Shortcut: `
                                        </span>
                                    </button>
                                    <div className="text-[11px] text-seahawks-gray/80">
                                        Tip: Leave this off if you regularly type backticks in your document.
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                <div className="px-6 py-4 border-t vw-border bg-seahawks-navy/50 flex justify-end shrink-0">
                    <button
                        onClick={handleSaveAPI}
                        className="px-6 py-2 rounded-md font-bold text-sm transition-all text-[#001024] bg-seahawks-green hover:bg-white shadow-sm"
                    >
                        Close & Save
                    </button>
                </div>
            </div>
        </div>
    );
}
