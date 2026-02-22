import React, { useState } from 'react';
import useStore from '../store/useStore';
import { X, Settings2, KeyRound, Bot, Sparkles, UserCircle2, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';

export default function AiSettingsModal({ isOpen, onClose, mode = 'all' }) {
    const { settings, updateSettings, personas, createPersona, updatePersona, deletePersona } = useStore();
    const isPersonaOnly = mode === 'persona';
    const isApiOnly = mode === 'api';
    const showPersonaTab = !isApiOnly;
    const showApiTab = !isPersonaOnly;
    const defaultTab = isApiOnly ? 'api' : 'persona';

    const [openRouterKey, setOpenRouterKey] = useState(settings.openRouterApiKey || '');
    const [openAiKey, setOpenAiKey] = useState(settings.openAiApiKey || '');
    const [activeTab, setActiveTab] = useState(defaultTab); // 'persona' or 'api'

    // Default to the first persona in the list
    const [selectedPersonaId, setSelectedPersonaId] = useState(personas.length > 0 ? personas[0].id : null);

    // Local edit state
    const [editForm, setEditForm] = useState({ title: '', description: '', systemPrompt: '' });

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
            setOpenAiKey(settings.openAiApiKey || '');
            setActiveTab(defaultTab);
        }
    }, [isOpen, settings.openRouterApiKey, settings.openAiApiKey, defaultTab]);

    if (!isOpen) return null;

    const handleSaveAPI = () => {
        updateSettings({
            openRouterApiKey: openRouterKey.trim(),
            openAiApiKey: openAiKey.trim(),
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

    // The handleSave was replaced by handleSaveAPI above

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#001024]/80 backdrop-blur-md p-4">
            <div className="bg-seahawks-navy border border-[#001024] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">

                <div className="px-6 py-4 border-b border-[#001024] bg-seahawks-navy/50 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
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
                        <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-[#001024] bg-[#001730] flex md:flex-col shrink-0">
                            <button
                                onClick={() => setActiveTab('persona')}
                                className={clsx(
                                    "flex-1 md:flex-none flex items-center gap-3 px-4 py-4 md:py-3 text-sm font-medium transition-colors border-l-2",
                                    activeTab === 'persona'
                                        ? "bg-seahawks-navy/50 text-white border-seahawks-green"
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
                                        ? "bg-seahawks-navy/50 text-white border-seahawks-green"
                                        : "text-seahawks-gray hover:bg-seahawks-navy/30 border-transparent hover:text-white"
                                )}
                            >
                                <Settings2 size={16} className={activeTab === 'api' ? "text-seahawks-green" : "opacity-60"} />
                                API Connections
                            </button>
                        </div>
                    ) : (
                        <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-[#001024] bg-[#001730] flex md:flex-col shrink-0">
                            <div className="px-4 py-4 md:py-3 text-sm font-medium text-white flex items-center gap-3 border-l-2 border-seahawks-green bg-seahawks-navy/40">
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
                                        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
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

                                <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">

                                    {/* Left half: List of Personas */}
                                    <div className="w-full md:w-1/3 flex flex-col gap-2 overflow-y-auto pr-2 border-r border-[#001024]/50 custom-scrollbar">
                                        {personas.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedPersonaId(p.id)}
                                                className={clsx(
                                                    "text-left p-3 rounded-lg border transition-all relative group",
                                                    selectedPersonaId === p.id
                                                        ? "bg-[#001730] border-seahawks-green shadow-inner"
                                                        : "border-seahawks-gray/10 hover:border-seahawks-gray/30 hover:bg-[#001730]/50"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "font-semibold text-sm mb-1 truncate",
                                                    selectedPersonaId === p.id ? "text-seahawks-green" : "text-white"
                                                )}>
                                                    {p.title || 'Untitled'}
                                                </div>
                                                <div className="text-xs text-seahawks-gray truncate">
                                                    {p.description || 'No description...'}
                                                </div>

                                                {/* Delete Button overlaid on hover */}
                                                <div
                                                    className={clsx(
                                                        "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-[#001024]/80 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 transition-colors opacity-0 group-hover:opacity-100",
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
                                                        className="w-full bg-[#001024] border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:border-seahawks-green transition-colors"
                                                        placeholder="e.g. Strict Editor"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-xs font-bold text-seahawks-gray uppercase tracking-wider pl-1">Description</label>
                                                    <input
                                                        value={editForm.description}
                                                        onChange={(e) => handleUpdateField('description', e.target.value)}
                                                        className="w-full bg-[#001024] border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:border-seahawks-green transition-colors"
                                                        placeholder="Brief summary of this skill..."
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5 flex-1 min-h-[200px]">
                                                    <label className="text-xs font-bold text-seahawks-gray uppercase tracking-wider pl-1">System Instructions</label>
                                                    <textarea
                                                        value={editForm.systemPrompt}
                                                        onChange={(e) => handleUpdateField('systemPrompt', e.target.value)}
                                                        className="w-full flex-1 bg-[#001024] border border-seahawks-gray/20 rounded-md py-3 px-4 text-sm text-white focus:outline-none focus:border-seahawks-green transition-colors shadow-inner font-sans resize-none placeholder:text-seahawks-gray/30"
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
                                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                        <KeyRound size={18} className="text-seahawks-green" />
                                        API Connections
                                    </h3>
                                    <p className="text-sm text-seahawks-gray leading-relaxed mb-4">
                                        Manage how Vibe Writer connects to various AI models. Keys are stored locally in your browser and never sent to our servers.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 p-4 bg-[#001730] rounded-lg border border-seahawks-gray/10">
                                    <label className="text-sm font-semibold text-white">
                                        OpenRouter API Key
                                    </label>
                                    <p className="text-xs text-seahawks-gray mb-2">
                                        Used to access hundreds of different LLMs (Claude, GPT-4, Llama, etc.).
                                    </p>
                                    <input
                                        type="password"
                                        value={openRouterKey}
                                        onChange={(e) => setOpenRouterKey(e.target.value)}
                                        className="w-full bg-[#001024] border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:border-seahawks-green transition-colors shadow-inner font-mono placeholder:text-seahawks-gray/30"
                                        placeholder="sk-or-v1-..."
                                    />
                                </div>

                                <div className="flex flex-col gap-2 p-4 bg-[#001730] rounded-lg border border-seahawks-green/20 relative overflow-hidden">
                                    <div className="absolute right-0 top-0 w-16 h-16 bg-seahawks-green/10 rounded-full blur-xl -mr-4 -mt-4" />
                                    <label className="text-sm font-semibold text-white flex items-center justify-between">
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
                                    <label className="text-sm mt-1 text-white font-medium">OpenAI API Key (Optional / legacy fallback)</label>
                                    <input
                                        type="password"
                                        value={openAiKey}
                                        onChange={(e) => setOpenAiKey(e.target.value)}
                                        className="w-full bg-[#001024] border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:border-seahawks-green transition-colors shadow-inner font-mono placeholder:text-seahawks-gray/30"
                                        placeholder="Not required for CLI mode"
                                    />
                                    <div className="text-xs font-mono text-seahawks-green/70">
                                        Status: {settings.openAiCliEnabled ? "Active: using local CLI bridge (Codex preferred)" : "Disabled"}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                <div className="px-6 py-4 border-t border-[#001024] bg-seahawks-navy/50 flex justify-end shrink-0">
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
