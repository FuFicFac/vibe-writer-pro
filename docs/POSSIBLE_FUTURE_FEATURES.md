# Possible Future Features (Vibe Writer Pro)

This document is a running idea bank for future Vibe Writer Pro features.

Purpose:
- Capture feature ideas before they are production-ready
- Preserve architecture notes and tradeoffs
- Share a clearer roadmap with future collaborators
- Keep "cool ideas" separate from the stable app until they are scoped

How to use this doc:
- Add ideas as sections or bullets
- Include pros/cons and risks
- Note whether the idea is MVP, Pro, or experimental
- Link to demos, repos, videos, or transcripts when relevant

---

## Obsidian / Second Brain Integration (Pro Concept)

### Summary

Potential Vibe Writer Pro feature: connect an Obsidian vault as an optional external memory layer for writing projects.

The goal is not to replace Vibe Writer's editor. The goal is to give Vibe Writer a persistent, user-owned memory system for:
- canon / lore
- character sheets
- plotlines
- worldbuilding
- research notes
- continuity references

This aligns with a local-first, modular architecture and works well with local AI CLI workflows (Codex / Claude Code / Gemini CLI style tools).

### Why this is compelling

- Obsidian vaults are local folders of Markdown files (portable, user-owned)
- Markdown is excellent for LLM-readable memory and human editing
- Gives persistent memory across sessions (reduces context loss)
- Supports a "human-in-the-loop" workflow: AI reads memory, writer edits in a real note system
- Strong Pro differentiator: writing workspace + agent-ready memory layer
- Can be Git-tracked for history, rollback, and auditability

### Key risks / downsides

- Significant complexity increase (sync, indexing, retrieval, conflicts)
- Higher support burden (path issues, vault layout differences, plugin assumptions)
- Privacy confusion risk ("local vault" does not always mean "nothing goes to the cloud")
- Cloud LLM usage may expose note contents unless users stay local-only
- AI write-backs can introduce canon drift or incorrect facts
- Multi-device sync + Git + AI edits can create merge conflicts
- Different agent CLIs behave differently (auth, commands, model support, tool semantics)

### Recommended product framing

Best framing for Vibe Writer Pro:
- Vibe Writer remains the writing workspace
- Obsidian is an optional external memory / second-brain layer

Avoid (at least initially):
- making Obsidian the primary writing UI
- automatic background edits to the vault without clear approvals

### Recommended rollout (MVP -> advanced)

#### Phase A (Safest MVP): Read-only vault connection
- User selects an Obsidian vault folder
- User chooses which folders are allowed for AI context (e.g. `Characters`, `World`, `Research`)
- Vibe Writer can retrieve relevant notes for AI actions (rewrite, continue, expand)
- No write-back to vault yet

#### Phase B: Explicit write-back actions
- "Save summary to vault"
- "Add canon note"
- "Create character note from current document"
- Every write requires explicit user confirmation

#### Phase C: Continuity tools
- Character consistency check against vault notes
- Timeline/canon conflict warnings
- "What changed?" summaries after AI edits

#### Phase D: Advanced memory workflows
- Optional Git integration for vault audit trail
- Snapshot/commit notes after AI memory updates
- Shared skills library (cross-agent patterns)
- Agent-specific adapters (Codex / Claude / Gemini)

### Trust and privacy modes (important)

If this is built, the UI should clearly expose trust modes:
- Local-only mode (preferred for sensitive notes)
- Cloud-assisted mode (selected notes may be sent to AI provider)
- External tools connected mode (e.g. MCP integrations)

Users should know exactly what leaves the machine.

### Architecture notes (early)

Potential Vibe Writer Pro components:
- Vault Connector (path + folder allowlist)
- Retrieval Layer (search/relevance over Markdown notes)
- Context Composer (shows what notes are being sent to AI)
- Write-back Adapter (explicit, audited writes only)
- Audit Trail (optional Git or internal log)
- Skill Packs (canon check, worldbuilding ingest, character dossier sync)

### Research signals / inspiration (captured from transcript review)

Patterns repeatedly seen across transcript examples:
- Obsidian as the human-facing knowledge canvas
- Agent CLI as the execution engine (local files + terminal + web)
- Skills as the capability router (progressive disclosure)
- Git as an audit/history layer for AI edits
- Shared skills directory + symlinks/adapters to reduce duplication across agents

### Open questions (for future collaborators)

- Should Obsidian be read-only in v1?
- Should Vibe Writer store its own index or query raw Markdown on demand?
- How do we prevent duplicate canon facts or contradictory write-backs?
- Do we support one vault per project, or one shared vault with project-scoped folders?
- What should be the minimum privacy messaging before enabling cloud providers?

---

## Other Future Features (Placeholder)

Add future sections here, for example:
- Installer / Desktop Packaging
- Team Collaboration / Shared Projects
- Advanced Version History Diff View
- Voice Profiles and Style Packs
- Obsidian Sync / Vault Templates
- Local Embeddings / Retrieval Index
