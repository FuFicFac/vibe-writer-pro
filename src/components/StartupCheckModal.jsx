import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { Terminal, KeyRound, Check, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export default function StartupCheckModal() {
    const { settings, updateSettings } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const [cliStatus, setCliStatus] = useState('checking'); // 'checking', 'found', 'auth-missing', 'not-found', 'error'
    const [cliVersion, setCliVersion] = useState('');
    const [cliProvider, setCliProvider] = useState('');
    const [cliAuthMessage, setCliAuthMessage] = useState('');
    const [detectedTools, setDetectedTools] = useState({ codex: { present: false }, claude: { present: false } });
    const [openRouterKey, setOpenRouterKey] = useState(settings.openRouterApiKey || '');

    // Run startup checks on mount:
    // - If CLI mode is enabled, verify runtime CLI health and auto-open on failure.
    // - If nothing is configured yet, open onboarding and run checks.
    useEffect(() => {
        const hasOpenRouter = !!settings.openRouterApiKey;
        const hasCliEnabled = settings.openAiCliEnabled;

        if (hasCliEnabled) {
            checkCli({ autoOpenOnFailure: true });
            return;
        }

        if (!hasOpenRouter) {
            setIsOpen(true);
            checkCli();
        }
    }, [settings.openRouterApiKey, settings.openAiCliEnabled]);

    const checkCli = async ({ autoOpenOnFailure = false } = {}) => {
        setCliStatus('checking');
        try {
            const res = await fetch('/api/openai-cli/check');
            const data = await res.json();

            if (data.installed) {
                setCliVersion(data.version);
                setCliProvider(data.provider || '');
                setDetectedTools(data.detectedTools || { codex: { present: false }, claude: { present: false } });
                if (data.authenticated === false) {
                    setCliStatus('auth-missing');
                    setCliAuthMessage(data.authError || 'OpenAI OAuth/session CLI is installed but not authenticated.');
                    if (autoOpenOnFailure) setIsOpen(true);
                } else {
                    setCliStatus('found');
                    setCliAuthMessage('');
                }
            } else {
                setCliStatus('not-found');
                setCliProvider('');
                setDetectedTools(data.detectedTools || { codex: { present: false }, claude: { present: false } });
                setCliAuthMessage('');
                if (autoOpenOnFailure) setIsOpen(true);
            }
        } catch (err) {
            console.error('Failed to check CLI API bridge - this requires the Vite dev server custom middleware.', err);
            setCliStatus('error');
            setCliProvider('');
            setCliAuthMessage('');
            if (autoOpenOnFailure) setIsOpen(true);
        }
    };

    const handleEnableCli = () => {
        updateSettings({ openAiCliEnabled: true });
        setIsOpen(false);
    };

    const handleSaveOpenRouter = () => {
        if (openRouterKey.trim().length > 10) {
            updateSettings({ openRouterApiKey: openRouterKey.trim() });
            setIsOpen(false);
        }
    };

    if (!isOpen) return null;

    const providerLabel = cliProvider === 'codex'
        ? 'Codex CLI (OpenAI OAuth / ChatGPT session)'
        : cliProvider === 'openai-python-cli'
            ? 'Python OpenAI CLI (API-key auth)'
            : 'No supported CLI detected';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#001024]/80 backdrop-blur-md p-4">
            <div className="bg-seahawks-navy border border-[#001024] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">

                <div className="px-6 py-5 border-b border-[#001024] bg-seahawks-navy/50 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-seahawks-green/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-seahawks-green font-black tracking-tighter uppercase text-2xl -rotate-3 select-none">Vibe</span>
                        <span>Initialization Check</span>
                    </h2>
                    <p className="text-sm text-seahawks-gray mt-1">Configure your AI providers before writing.</p>
                </div>

                <div className="p-6 flex flex-col gap-6 overflow-y-auto">

                    {/* OpenAI CLI Check Section */}
                    <div className="bg-[#001730] border border-seahawks-gray/10 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-seahawks-navy rounded-md shadow-inner border border-[#001024] text-seahawks-gray">
                                <Terminal size={20} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-white mb-1">OpenAI OAuth CLI Check (Codex Preferred)</h3>
                                <p className="text-xs text-seahawks-gray mb-3 leading-relaxed">
                                    Vibe Writer looks for a local CLI that can provide an OpenAI session. It checks for <code>codex</code> first (OAuth/ChatGPT login), then falls back to the Python <code>openai</code> CLI.
                                </p>

                                <div className="mb-3 rounded-md border border-[#001024] bg-seahawks-navy/60 px-3 py-2 text-[11px] text-seahawks-gray">
                                    Active path: <span className="text-white">{providerLabel}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                    {cliStatus === 'checking' && (
                                        <div className="flex items-center gap-2 text-xs text-seahawks-gray bg-seahawks-navy px-3 py-1.5 rounded-md shadow-inner border border-[#001024]">
                                            <Loader2 size={12} className="animate-spin text-seahawks-green" />
                                            Checking system path...
                                        </div>
                                    )}
                                    {cliStatus === 'found' && (
                                        <>
                                            <div className="flex items-center gap-2 text-xs text-seahawks-green font-medium bg-seahawks-green/10 px-3 py-1.5 rounded-md border border-seahawks-green/20">
                                                <Check size={12} />
                                                Ready ({cliVersion.split(' ')[1] || cliVersion})
                                            </div>
                                            <button
                                                onClick={handleEnableCli}
                                                className="text-xs bg-white text-[#001024] font-bold px-4 py-1.5 rounded-md hover:bg-seahawks-gray transition-colors shadow-sm"
                                            >
                                                Use local CLI
                                            </button>
                                        </>
                                    )}
                                    {cliStatus === 'auth-missing' && (
                                        <>
                                            <div className="flex items-center gap-2 text-xs text-amber-300 font-medium bg-amber-300/10 px-3 py-1.5 rounded-md border border-amber-300/20">
                                                <X size={12} />
                                                CLI found, but OpenAI OAuth/session is not ready
                                            </div>
                                            <button
                                                onClick={handleEnableCli}
                                                className="text-xs bg-white text-[#001024] font-bold px-4 py-1.5 rounded-md hover:bg-seahawks-gray transition-colors shadow-sm"
                                            >
                                                Use local CLI
                                            </button>
                                        </>
                                    )}
                                    {(cliStatus === 'not-found' || cliStatus === 'error') && (
                                            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 px-3 py-1.5 rounded-md border border-red-400/20">
                                                <X size={12} />
                                            No supported CLI detected
                                        </div>
                                    )}
                                </div>
                                {cliStatus === 'auth-missing' && (
                                    <p className="mt-3 text-[11px] leading-relaxed text-amber-200/90">
                                        {cliAuthMessage}
                                    </p>
                                )}

                                <div className="mt-4 rounded-lg border border-seahawks-gray/15 bg-[#001024]/70 p-4">
                                    <div className="text-xs font-bold uppercase tracking-wider text-seahawks-green mb-3">
                                        Prerequisites (OpenAI OAuth CLI)
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                        <div className="rounded-md border border-[#001024] bg-[#001730] px-3 py-2">
                                            <div className="text-[11px] text-seahawks-gray mb-1">Codex CLI</div>
                                            <div className={detectedTools?.codex?.present ? 'text-xs text-seahawks-green' : 'text-xs text-red-300'}>
                                                {detectedTools?.codex?.present ? 'Detected on this computer' : 'Not detected'}
                                            </div>
                                            {detectedTools?.codex?.version && (
                                                <div className="text-[10px] text-seahawks-gray mt-1 font-mono truncate">{detectedTools.codex.version}</div>
                                            )}
                                        </div>
                                        <div className="rounded-md border border-[#001024] bg-[#001730] px-3 py-2">
                                            <div className="text-[11px] text-seahawks-gray mb-1">Claude Code (prereq check only)</div>
                                            <div className={detectedTools?.claude?.present ? 'text-xs text-seahawks-green' : 'text-xs text-red-300'}>
                                                {detectedTools?.claude?.present ? 'Detected on this computer' : 'Not detected'}
                                            </div>
                                            {detectedTools?.claude?.version && (
                                                <div className="text-[10px] text-seahawks-gray mt-1 font-mono truncate">{detectedTools.claude.version}</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-[11px] leading-relaxed text-seahawks-gray">
                                        <div className="text-white font-semibold">Required for OpenAI OAuth mode (recommended): Codex CLI + login session</div>
                                        <div className="font-mono text-seahawks-gray/90 bg-[#001730] border border-[#001024] rounded px-2 py-1">
                                            npm install -g @openai/codex
                                        </div>
                                        <div className="font-mono text-seahawks-gray/90 bg-[#001730] border border-[#001024] rounded px-2 py-1">
                                            codex login
                                        </div>
                                        <div className="font-mono text-seahawks-gray/90 bg-[#001730] border border-[#001024] rounded px-2 py-1">
                                            codex login status
                                        </div>
                                        <div>Vibe Writer will use your local Codex OAuth/ChatGPT session in the background once the CLI is detected and logged in.</div>

                                        <div className="pt-1 text-white font-semibold">Checks you can run manually</div>
                                        <div className="font-mono text-seahawks-gray/90 bg-[#001730] border border-[#001024] rounded px-2 py-1">
                                            codex --version
                                        </div>
                                        <div className="font-mono text-seahawks-gray/90 bg-[#001730] border border-[#001024] rounded px-2 py-1">
                                            claude --version
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium text-seahawks-gray uppercase tracking-widest px-4">
                        <div className="flex-1 h-px bg-seahawks-gray/10" />
                        <span>— AND / OR —</span>
                        <div className="flex-1 h-px bg-seahawks-gray/10" />
                    </div>

                    {/* OpenRouter API Section */}
                    <div className="bg-[#001730] border border-seahawks-gray/10 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-seahawks-navy rounded-md shadow-inner border border-[#001024] text-seahawks-green">
                                <KeyRound size={20} />
                            </div>
                            <div className="flex-1 flex flex-col gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-white mb-1">OpenRouter API Key</h3>
                                    <p className="text-xs text-seahawks-gray leading-relaxed">
                                        Connect to hundreds of models via OpenRouter. Keys are stored safely in your local browser storage.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <input
                                        type="password"
                                        placeholder="sk-or-v1-..."
                                        value={openRouterKey}
                                        onChange={(e) => setOpenRouterKey(e.target.value)}
                                        className="w-full bg-[#001024] border border-seahawks-gray/20 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:border-seahawks-green transition-colors shadow-inner font-mono placeholder:text-seahawks-gray/30"
                                    />
                                    <div className="flex justify-end mt-1">
                                        <button
                                            onClick={handleSaveOpenRouter}
                                            disabled={openRouterKey.trim().length <= 10}
                                            className={clsx(
                                                "text-xs font-bold px-4 py-2 rounded-md transition-all shadow-sm",
                                                openRouterKey.trim().length > 10
                                                    ? "bg-seahawks-green text-[#001024] hover:bg-white hover:text-[#001024]"
                                                    : "bg-seahawks-gray/10 text-seahawks-gray cursor-not-allowed"
                                            )}
                                        >
                                            Save API Key
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Helper footer */}
                <div className="px-6 py-4 bg-[#001024] flex justify-between items-center text-xs text-seahawks-gray border-t border-seahawks-gray/10 shrink-0">
                    <span>You can change these in Settings later.</span>
                    <span className="text-seahawks-gray/80">CLI OAuth (Codex) is preferred for local use.</span>
                </div>
            </div>
        </div>
    );
}
