import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    Highlighter, Eraser, Heading1, Heading2, Heading3,
    List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Undo, Redo, Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
    FileText, Plus, Sparkles, Wand2, MessageSquare, Check, Loader2, X
} from 'lucide-react';
import clsx from 'clsx';
import useStore from '../store/useStore';
import { generateText } from '../services/aiService';

export default function EditorArea({ documentId, isSecondary }) {
    const {
        documents, updateDocumentContent, createDocument,
        activeProjectId, folders,
        setActiveDocument, setActiveDocumentSecondary,
        personas, settings
    } = useStore();

    const [isGenerating, setIsGenerating] = useState(false);
    const [expandDialog, setExpandDialog] = useState({
        isOpen: false,
        from: null,
        to: null,
        selectedText: '',
        instructions: 'Expand this selection with more detail and specificity while preserving the original meaning and voice. Return only the revised text.',
        previewText: '',
        isGenerating: false,
        error: '',
    });

    const activeDocument = documents.find(d => d.id === documentId);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight.configure({ multicolor: true }),
            TextStyle,
            Color,
            Subscript,
            Superscript
        ],
        content: activeDocument?.content || '',
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-lg focus:outline-none max-w-none prose-headings:font-serif prose-p:font-serif',
            },
        },
        onUpdate: ({ editor }) => {
            // Small optimization: avoid updating Zustand on literally every keystroke if it causes lag,
            // but for now, direct update enables real-time word counting.
            if (documentId) {
                updateDocumentContent(documentId, editor.getHTML(), editor.getText());
            }
        },
    });

    // Sync editor content when active document changes
    useEffect(() => {
        if (editor && activeDocument && editor.getHTML() !== activeDocument.content) {
            // To strictly avoid cursor jumping and infinite loops, only set content if different
            // Note: TipTap's setContent handles focus/cursor relatively well, but we must be careful.
            editor.commands.setContent(activeDocument.content, false);
        }
    }, [documentId, editor, activeDocument]);

    // AI Action Handlers
    const handleAiAction = async (promptGenerator, customSystemPrompt = null) => {
        if (!editor || isGenerating) return;
        const { from, to } = editor.state.selection;
        if (from === to) return;

        const selectedText = editor.state.doc.textBetween(from, to, ' ');

        setIsGenerating(true);
        try {
            const finalPrompt = promptGenerator(selectedText);
            const sysPrompt = customSystemPrompt || settings.systemPrompt || 'You are an expert editor.';

            const resultText = await generateText({
                prompt: finalPrompt,
                systemPrompt: sysPrompt,
                temperature: 0.7
            });

            // Replace the selected text with the result
            editor.commands.insertContentAt({ from, to }, resultText.trim());
        } catch (error) {
            console.error("AI Generation failed:", error);
            alert("AI Action Failed: " + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const openExpandDialog = () => {
        if (!editor || !activeDocument || expandDialog.isGenerating) return;
        const { from, to } = editor.state.selection;
        if (from === to) return;

        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        if (!selectedText.trim()) return;

        setExpandDialog((prev) => ({
            ...prev,
            isOpen: true,
            from,
            to,
            selectedText,
            previewText: '',
            error: '',
        }));
    };

    const closeExpandDialog = () => {
        setExpandDialog((prev) => ({
            ...prev,
            isOpen: false,
            previewText: '',
            isGenerating: false,
            error: '',
        }));
    };

    const setExpandInstructions = (value) => {
        setExpandDialog((prev) => ({ ...prev, instructions: value }));
    };

    const generateExpandPreview = async () => {
        if (!expandDialog.selectedText.trim() || !expandDialog.instructions.trim()) return;

        setExpandDialog((prev) => ({ ...prev, isGenerating: true, error: '', previewText: '' }));
        try {
            const resultText = await generateText({
                prompt: [
                    'Apply the following expansion instructions to the selected text.',
                    '',
                    `Instructions:\n${expandDialog.instructions.trim()}`,
                    '',
                    `Selected text:\n${expandDialog.selectedText}`,
                    '',
                    'Return only the rewritten expanded text.',
                ].join('\n'),
                systemPrompt: settings.systemPrompt || 'You are an expert editor.',
                temperature: 0.7,
            });

            setExpandDialog((prev) => ({
                ...prev,
                previewText: (resultText || '').trim(),
                isGenerating: false,
            }));
        } catch (error) {
            console.error('Expand preview failed:', error);
            setExpandDialog((prev) => ({
                ...prev,
                isGenerating: false,
                error: error.message || 'Failed to generate expanded version.',
            }));
        }
    };

    const applyExpandedText = (mode) => {
        if (!editor || !activeDocument) return;
        const preview = expandDialog.previewText.trim();
        if (!preview) return;

        const previewHtml = plainTextToHtml(preview);

        if (mode === 'replace' && expandDialog.from != null && expandDialog.to != null) {
            editor.chain().focus().insertContentAt({ from: expandDialog.from, to: expandDialog.to }, previewHtml).run();
            closeExpandDialog();
            return;
        }

        if (mode === 'keep-both-inline' && expandDialog.to != null) {
            editor.chain().focus().insertContentAt(expandDialog.to, `<p></p>${previewHtml}`).run();
            closeExpandDialog();
            return;
        }

        if (mode === 'new-document') {
            const newName = buildExpandedDocumentName(activeDocument.name, documents);
            createDocument(activeDocument.folderId, newName, previewHtml);
            closeExpandDialog();
        }
    };

    if (!activeDocument) {
        // Calculate available documents for the current project
        const projectFolders = folders.filter(f => f.projectId === activeProjectId);
        const projectFolderIds = projectFolders.map(f => f.id);
        const projectDocuments = documents.filter(d => projectFolderIds.includes(d.folderId));

        return (
            <main className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="w-full max-w-md bg-[#001730] border border-seahawks-gray/10 rounded-xl overflow-hidden shadow-2xl">
                    <div className="px-6 py-4 border-b border-[#001024] bg-[#001024]/50">
                        <h3 className="text-lg font-semibold text-white">Select a Document</h3>
                        <p className="text-sm text-seahawks-gray">Choose a document to open in this pane.</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
                        {projectDocuments.length === 0 ? (
                            <div className="p-4 text-sm text-seahawks-gray">No documents found in this project.</div>
                        ) : (
                            projectDocuments.map(doc => (
                                <button
                                    key={doc.id}
                                    onClick={() => isSecondary ? setActiveDocumentSecondary(doc.id) : setActiveDocument(doc.id)}
                                    className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-seahawks-navy/80 rounded-lg transition-colors group"
                                >
                                    <FileText size={18} className="text-seahawks-gray group-hover:text-seahawks-green transition-colors" />
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-sm font-medium text-white truncate">{doc.name}</div>
                                        <div className="text-xs text-seahawks-gray mt-0.5">{(doc.wordCount || 0).toLocaleString()} words</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <div className="flex-1 flex flex-col relative w-full h-full">
            <main className="flex-1 overflow-y-auto px-12 py-16 scrollbar-hide">
                <div className="max-w-3xl mx-auto">
                    {/* Document Title */}
                    <h1
                        className="text-4xl font-serif text-white mb-2 outline-none"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                            // Update name in future. For now, it's read-only display of the file name
                            // Actually, we can just display the activeDocument.name here instead of contentEditable
                        }}
                    >
                        {activeDocument.name.replace(/_/g, ' ')}
                    </h1>

                    <div className="text-seahawks-gray/70 text-sm mb-12 flex items-center gap-4">
                        <span>Auto-saving enabled</span>
                    </div>

                    <div className="text-lg font-serif leading-relaxed text-seahawks-gray/90 pb-32 relative">
                        {editor && (
                            <BubbleMenu
                                editor={editor}
                                pluginKey={isSecondary ? 'bubbleMenuSecondary' : 'bubbleMenuPrimary'}
                                appendTo={() => document.body}
                                updateDelay={0}
                                options={{ placement: 'top', offset: 8 }}
                                shouldShow={({ editor: bubbleEditor, state, from, to }) => {
                                    if (!bubbleEditor?.isEditable) return false;
                                    if (state.selection.empty) return false;
                                    return state.doc.textBetween(from, to, ' ').trim().length > 0;
                                }}
                                className="flex items-center gap-1 p-1.5 rounded-lg border border-seahawks-green/30 bg-[#001024]/95 backdrop-blur-md shadow-2xl z-50 animate-in slide-in-from-bottom-2 fade-in"
                            >
                                {isGenerating ? (
                                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-seahawks-green">
                                        <Loader2 size={14} className="animate-spin" />
                                        Thinking...
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleAiAction(text => `Rewrite this text to be punchier, more engaging, and professional:\n\n${text}`)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-seahawks-navy bg-seahawks-green rounded hover:bg-white transition-colors shadow-sm"
                                        >
                                            <Sparkles size={14} />
                                            AI Rewrite
                                        </button>
                                        <div className="w-px h-4 bg-seahawks-gray/20 mx-1" />
                                        <button
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                openExpandDialog();
                                            }}
                                            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-seahawks-gray hover:text-white hover:bg-seahawks-navy/50 rounded transition-colors tooltip" title="Expand on this idea"
                                        >
                                            <Wand2 size={14} />
                                            Expand
                                        </button>
                                        <button
                                            onClick={() => handleAiAction(text => `Shorten and tighten this text, removing filler words and getting straight to the point:\n\n${text}`)}
                                            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-seahawks-gray hover:text-white hover:bg-seahawks-navy/50 rounded transition-colors tooltip" title="Shorten and tighten"
                                        >
                                            <MessageSquare size={14} />
                                            Shorten
                                        </button>
                                        <div className="w-px h-4 bg-seahawks-gray/20 mx-1" />
                                        <div className="relative group/menu">
                                            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-seahawks-green bg-seahawks-green/10 hover:bg-seahawks-green hover:text-[#001024] border border-seahawks-green/20 rounded transition-colors">
                                                Apply Skill <span className="text-[10px]">▼</span>
                                            </button>

                                            {/* Persona Dropdown (visible on hover) */}
                                            <div className="absolute hidden group-hover/menu:flex flex-col bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#001730] border border-[#001024] rounded-md shadow-2xl overflow-hidden py-1">
                                                <div className="text-[10px] font-bold text-seahawks-gray/50 uppercase px-3 py-1.5 bg-[#001024]/50 border-b border-[#001024] mb-1">Send to Persona</div>
                                                {personas && personas.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => handleAiAction(text => `Apply your specific skills to process and rewrite the following text according to your system instructions:\n\n${text}`, p.systemPrompt)}
                                                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-seahawks-navy/80 hover:text-seahawks-green transition-colors border-b border-[#001024]/50 last:border-0"
                                                    >
                                                        <div className="font-semibold truncate">{p.title}</div>
                                                        <div className="text-[10px] text-seahawks-gray truncate mt-0.5">{p.description}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </BubbleMenu>
                        )}
                        <EditorContent editor={editor} />
                    </div>
                </div>
            </main>

            {/* Bottom Advanced Formatting Toolbar */}
            <footer className="h-14 border-t border-[#001024] flex items-center justify-between px-6 bg-[#001730]/95 backdrop-blur-md absolute bottom-0 left-0 right-0 z-10 w-full overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-1 min-w-max">

                    {/* Font & Size (Visual Only for now) */}
                    <div className="flex items-center">
                        <button className="px-3 h-8 flex items-center justify-center rounded hover:bg-seahawks-navy/50 text-seahawks-gray transition-colors text-sm border border-transparent hover:border-seahawks-gray/20">
                            Times New Roman <span className="ml-2 text-[10px]">▼</span>
                        </button>
                        <div className="w-px h-4 bg-seahawks-gray/20 mx-2" />
                        <button className="px-3 h-8 flex items-center justify-center rounded hover:bg-seahawks-navy/50 text-seahawks-gray transition-colors text-sm border border-transparent hover:border-seahawks-gray/20">
                            16pt <span className="ml-2 text-[10px]">▼</span>
                        </button>
                    </div>

                    <div className="w-px h-6 bg-seahawks-gray/20 mx-3" />

                    {/* Core Formatting */}
                    <div className="flex items-center gap-1">
                        <ToolbarButton
                            editor={editor}
                            active={editor?.isActive('bold')}
                            onClick={() => editor?.chain().focus().toggleBold().run()}
                            icon={<Bold size={16} />}
                            title="Bold"
                        />
                        <ToolbarButton
                            editor={editor}
                            active={editor?.isActive('italic')}
                            onClick={() => editor?.chain().focus().toggleItalic().run()}
                            icon={<Italic size={16} />}
                            title="Italic"
                        />
                        <ToolbarButton
                            editor={editor}
                            active={editor?.isActive('underline')}
                            onClick={() => editor?.chain().focus().toggleUnderline().run()}
                            icon={<UnderlineIcon size={16} />}
                            title="Underline"
                        />
                        <ToolbarButton
                            editor={editor}
                            active={editor?.isActive('strike')}
                            onClick={() => editor?.chain().focus().toggleStrike().run()}
                            icon={<Strikethrough size={16} />}
                            title="Strikethrough"
                        />
                        <ToolbarButton
                            editor={editor}
                            active={editor?.isActive('subscript')}
                            onClick={() => editor?.chain().focus().toggleSubscript().run()}
                            icon={<SubscriptIcon size={16} />}
                            title="Subscript"
                        />
                        <ToolbarButton
                            editor={editor}
                            active={editor?.isActive('superscript')}
                            onClick={() => editor?.chain().focus().toggleSuperscript().run()}
                            icon={<SuperscriptIcon size={16} />}
                            title="Superscript"
                        />
                    </div>

                    <div className="w-px h-6 bg-seahawks-gray/20 mx-3" />

                    {/* Color & Cleanup */}
                    <div className="flex items-center gap-1">
                        <ToolbarButton
                            editor={editor}
                            active={editor?.isActive('highlight')}
                            onClick={() => editor?.chain().focus().toggleHighlight({ color: '#69BE28' }).run()}
                            icon={<Highlighter size={16} />}
                            title="Highlight (Action Green)"
                        />
                        <ToolbarButton
                            editor={editor}
                            onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
                            icon={<Eraser size={16} />}
                            title="Clear Formatting"
                        />
                    </div>

                    <div className="w-px h-6 bg-seahawks-gray/20 mx-3" />

                    {/* Headings */}
                    <div className="flex items-center gap-1">
                        <ToolbarButton editor={editor} active={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} icon={<Heading1 size={16} />} title="Heading 1" />
                        <ToolbarButton editor={editor} active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} icon={<Heading2 size={16} />} title="Heading 2" />
                        <ToolbarButton editor={editor} active={editor?.isActive('heading', { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} icon={<Heading3 size={16} />} title="Heading 3" />
                    </div>

                    <div className="w-px h-6 bg-seahawks-gray/20 mx-3" />

                    {/* Lists */}
                    <div className="flex items-center gap-1">
                        <ToolbarButton editor={editor} active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} icon={<List size={16} />} title="Bullet List" />
                        <ToolbarButton editor={editor} active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()} icon={<ListOrdered size={16} />} title="Numbered List" />
                    </div>

                    <div className="w-px h-6 bg-seahawks-gray/20 mx-3" />

                    {/* Alignment */}
                    <div className="flex items-center gap-1">
                        <ToolbarButton editor={editor} active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()} icon={<AlignLeft size={16} />} title="Align Left" />
                        <ToolbarButton editor={editor} active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()} icon={<AlignCenter size={16} />} title="Align Center" />
                        <ToolbarButton editor={editor} active={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()} icon={<AlignRight size={16} />} title="Align Right" />
                        <ToolbarButton editor={editor} active={editor?.isActive({ textAlign: 'justify' })} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} icon={<AlignJustify size={16} />} title="Justify" />
                    </div>

                    <div className="w-px h-6 bg-seahawks-gray/20 mx-3" />

                    {/* History */}
                    <div className="flex items-center gap-1">
                        <ToolbarButton editor={editor} onClick={() => editor?.chain().focus().undo().run()} icon={<Undo size={16} />} title="Undo" />
                        <ToolbarButton editor={editor} onClick={() => editor?.chain().focus().redo().run()} icon={<Redo size={16} />} title="Redo" />
                    </div>

                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-seahawks-gray ml-6 pl-6 border-l border-seahawks-gray/20 shrink-0">
                    <span className="opacity-80">Words: {(activeDocument.wordCount || 0).toLocaleString()}</span>
                    <span className="opacity-60">Tokens: {(activeDocument.tokenCount || 0).toLocaleString()}</span>
                </div>
            </footer>

            {expandDialog.isOpen && (
                <div className="fixed inset-0 z-[70] bg-[#001024]/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl bg-seahawks-navy border border-[#001024] rounded-xl shadow-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-[#001024] flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-semibold flex items-center gap-2">
                                    <Wand2 size={16} className="text-seahawks-green" />
                                    Expand Selection
                                </h3>
                                <p className="text-xs text-seahawks-gray mt-1">
                                    Write expansion instructions, preview the result, then choose how to apply it.
                                </p>
                            </div>
                            <button
                                onClick={closeExpandDialog}
                                className="w-8 h-8 rounded flex items-center justify-center text-seahawks-gray hover:text-white hover:bg-seahawks-navy/80"
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                            <div className="p-5 border-b lg:border-b-0 lg:border-r border-[#001024] space-y-4">
                                <div>
                                    <label className="text-xs uppercase tracking-wider text-seahawks-gray font-bold">Selected Text</label>
                                    <div className="mt-2 max-h-40 overflow-auto rounded-md border border-[#001024] bg-[#001024] p-3 text-sm text-seahawks-gray whitespace-pre-wrap">
                                        {expandDialog.selectedText}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs uppercase tracking-wider text-seahawks-gray font-bold">Expansion Instructions</label>
                                    <textarea
                                        value={expandDialog.instructions}
                                        onChange={(e) => setExpandInstructions(e.target.value)}
                                        placeholder="Tell the AI exactly how to expand this text..."
                                        className="mt-2 w-full min-h-[140px] bg-[#001024] border border-seahawks-gray/20 rounded-md py-3 px-3 text-sm text-white focus:outline-none focus:border-seahawks-green transition-colors shadow-inner resize-y"
                                    />
                                    <div className="mt-3 flex items-center gap-2">
                                        <button
                                            onClick={generateExpandPreview}
                                            disabled={expandDialog.isGenerating || !expandDialog.instructions.trim()}
                                            className={clsx(
                                                'px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2',
                                                expandDialog.isGenerating || !expandDialog.instructions.trim()
                                                    ? 'bg-seahawks-gray/10 text-seahawks-gray cursor-not-allowed'
                                                    : 'bg-seahawks-green text-[#001024] hover:bg-white'
                                            )}
                                        >
                                            {expandDialog.isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                            {expandDialog.isGenerating ? 'Generating...' : 'Generate Preview'}
                                        </button>
                                        <button
                                            onClick={closeExpandDialog}
                                            className="px-3 py-2 rounded-md text-sm text-seahawks-gray hover:text-white hover:bg-seahawks-navy/80 transition-colors"
                                        >
                                            Reject / Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 flex flex-col min-h-[420px]">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs uppercase tracking-wider text-seahawks-gray font-bold">Preview</label>
                                    {expandDialog.previewText && (
                                        <span className="text-[11px] text-seahawks-green">Ready to apply</span>
                                    )}
                                </div>

                                <div className="flex-1 rounded-md border border-[#001024] bg-[#001024] p-3 text-sm text-white whitespace-pre-wrap overflow-auto">
                                    {expandDialog.error ? (
                                        <div className="text-red-300">{expandDialog.error}</div>
                                    ) : expandDialog.previewText ? (
                                        expandDialog.previewText
                                    ) : (
                                        <div className="text-seahawks-gray">
                                            Generate a preview to review the expanded version before applying it.
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-2">
                                    <button
                                        onClick={() => applyExpandedText('replace')}
                                        disabled={!expandDialog.previewText || expandDialog.isGenerating}
                                        className={clsx(
                                            'w-full px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2',
                                            expandDialog.previewText && !expandDialog.isGenerating
                                                ? 'bg-white text-[#001024] hover:bg-seahawks-green'
                                                : 'bg-seahawks-gray/10 text-seahawks-gray cursor-not-allowed'
                                        )}
                                    >
                                        <Check size={14} />
                                        Accept and Replace Selection
                                    </button>
                                    <button
                                        onClick={() => applyExpandedText('keep-both-inline')}
                                        disabled={!expandDialog.previewText || expandDialog.isGenerating}
                                        className={clsx(
                                            'w-full px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2 border',
                                            expandDialog.previewText && !expandDialog.isGenerating
                                                ? 'border-seahawks-green/30 text-seahawks-green hover:bg-seahawks-green/10'
                                                : 'border-seahawks-gray/10 text-seahawks-gray cursor-not-allowed'
                                        )}
                                    >
                                        <Plus size={14} />
                                        Keep Both in This Document
                                    </button>
                                    <button
                                        onClick={() => applyExpandedText('new-document')}
                                        disabled={!expandDialog.previewText || expandDialog.isGenerating}
                                        className={clsx(
                                            'w-full px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2 border',
                                            expandDialog.previewText && !expandDialog.isGenerating
                                                ? 'border-seahawks-gray/20 text-white hover:bg-seahawks-navy/80'
                                                : 'border-seahawks-gray/10 text-seahawks-gray cursor-not-allowed'
                                        )}
                                    >
                                        <FileText size={14} />
                                        Keep Original Here, Save Expanded Version as New Document
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function plainTextToHtml(text) {
    return text
        .split(/\n{2,}/)
        .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
        .join('');
}

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildExpandedDocumentName(baseName, documents) {
    const stem = `${baseName.replace(/\.[^.]+$/, '')}_expanded`;
    const existingNames = new Set((documents || []).map(doc => doc.name));

    if (!existingNames.has(stem)) return stem;

    let i = 2;
    while (existingNames.has(`${stem}_${i}`)) {
        i += 1;
    }
    return `${stem}_${i}`;
}

// Reusable Toolbar Button
function ToolbarButton({ editor, active, onClick, icon, title }) {
    if (!editor) return null;

    return (
        <button
            onClick={onClick}
            title={title}
            className={clsx(
                "w-8 h-8 flex items-center justify-center rounded transition-all",
                active
                    ? "bg-seahawks-green text-[#001024] shadow-sm transform scale-105"
                    : "hover:bg-seahawks-navy/80 text-seahawks-gray hover:text-white"
            )}
        >
            {icon}
        </button>
    );
}
