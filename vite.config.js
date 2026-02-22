import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec, execFile } from 'child_process'
import util from 'util'
import fs from 'fs/promises'

const execPromise = util.promisify(exec)
const execFilePromise = util.promisify(execFile)

import os from 'os'
import path from 'path'

// Custom Vite plugin to create a local API bridge for CLI integration
function openAiCliBridge() {
  const resolveOpenAiCliBinary = async () => {
    try {
      const result = await execPromise('command -v openai')
      const resolved = result.stdout.trim()
      if (resolved) return resolved
    } catch {
      // fall through to known macOS Python user install path
    }

    return path.join(os.homedir(), 'Library/Python/3.9/bin/openai')
  }

  const resolveCodexBinary = async () => {
    try {
      const result = await execPromise('command -v codex')
      const resolved = result.stdout.trim()
      if (resolved) return resolved
    } catch {
      // fall through to Codex macOS app bundle path
    }

    return '/Applications/Codex.app/Contents/Resources/codex'
  }

  const resolveClaudeBinary = async () => {
    try {
      const result = await execPromise('command -v claude')
      const resolved = result.stdout.trim()
      if (resolved) return resolved
    } catch {
      // fall through
    }
    try {
      const result = await execPromise('command -v claude-code')
      const resolved = result.stdout.trim()
      if (resolved) return resolved
    } catch {
      // fall through
    }
    return null
  }

  const runOpenAiCli = async (args, options = {}) => {
    const cliBinary = await resolveOpenAiCliBinary()
    return execFilePromise(cliBinary, args, {
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    })
  }

  const runCodexCli = async (args, options = {}) => {
    const cliBinary = await resolveCodexBinary()
    return execFilePromise(cliBinary, args, {
      maxBuffer: 20 * 1024 * 1024,
      ...options,
    })
  }

  const runClaudeCli = async (args, options = {}) => {
    const cliBinary = await resolveClaudeBinary()
    if (!cliBinary) throw new Error('Claude Code CLI not found')
    return execFilePromise(cliBinary, args, {
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    })
  }

  const safeJsonParse = (raw) => {
    try {
      return JSON.parse(raw)
    } catch {
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(raw.slice(start, end + 1))
      }
      throw new Error('Failed to parse CLI JSON output')
    }
  }

  const formatCliError = (rawMessage) => {
    const msg = (rawMessage || '').trim()
    const lower = msg.toLowerCase()

    if (!msg) return 'OpenAI CLI request failed.'
    if (lower.includes('api_key client option must be set') || lower.includes('openai_api_key')) {
      return 'OpenAI CLI is installed but not authenticated. Set OPENAI_API_KEY in the shell/environment that starts Vite, then restart the app.'
    }
    if (lower.includes('command not found') || lower.includes('no such file or directory')) {
      return 'OpenAI CLI was not found. Install the official `openai` CLI and restart the app.'
    }
    if (lower.includes('not logged in') || lower.includes('login')) {
      return 'Codex CLI is installed but not logged in. Run `codex login` (OAuth/session) and restart the app.'
    }
    if (lower.includes('missing bearer authentication') || lower.includes('you didn\'t provide an api key')) {
      return 'OpenAI CLI is installed but not authenticated. Set OPENAI_API_KEY in the shell/environment that starts Vite, then restart the app.'
    }

    return msg
  }

  const checkCodexCliStatus = async () => {
    try {
      const versionResult = await runCodexCli(['--version'])
      const statusResult = await runCodexCli(['login', 'status'])
      const statusText = `${statusResult.stdout || ''}\n${statusResult.stderr || ''}`.trim()
      const authenticated = /logged in/i.test(statusText)
      return {
        installed: true,
        version: (versionResult.stdout || versionResult.stderr || '').trim() || 'codex',
        authenticated,
        authError: authenticated ? null : 'Codex CLI is installed but not logged in. Run `codex login` and choose ChatGPT/device auth, then restart the app.',
        provider: 'codex',
      }
    } catch {
      return null
    }
  }

  const checkPythonOpenAiCliStatus = async () => {
    try {
      const versionResult = await runOpenAiCli(['--version']);
      const version = versionResult.stdout.trim();

      let authenticated = false;
      let authError = null;
      try {
        await runOpenAiCli(['api', 'models.list']);
        authenticated = true;
      } catch (authCheckError) {
        authenticated = false;
        authError = formatCliError(authCheckError.stderr || authCheckError.stdout || authCheckError.message);
      }

      return { installed: true, version, authenticated, authError, provider: 'openai-python-cli' }
    } catch {
      return null
    }
  }

  const checkPreferredCliStatus = async () => {
    const codexStatus = await checkCodexCliStatus()
    if (codexStatus) return codexStatus
    const openaiStatus = await checkPythonOpenAiCliStatus()
    if (openaiStatus) return openaiStatus
    return { installed: false, error: 'No supported local CLI found' }
  }

  const checkDetectedTools = async () => {
    const codex = { present: false, version: null }
    const claude = { present: false, version: null }

    try {
      const result = await runCodexCli(['--version'])
      codex.present = true
      codex.version = (result.stdout || result.stderr || '').trim() || null
    } catch {
      // ignore
    }

    try {
      const result = await runClaudeCli(['--version'])
      claude.present = true
      claude.version = (result.stdout || result.stderr || '').trim() || null
    } catch {
      // ignore
    }

    return { codex, claude }
  }

  const runCodexTextGeneration = async ({ messages, systemPrompt }) => {
    const tmpFile = path.join(os.tmpdir(), `vibe-codex-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
    const parts = []
    if (systemPrompt) {
      parts.push(`System instructions:\n${systemPrompt}`)
    }

    const conversation = (Array.isArray(messages) ? messages : [])
      .filter(msg => msg?.role && typeof msg?.content === 'string')
      .map(msg => `${msg.role.toUpperCase()}:\n${msg.content}`)
      .join('\n\n')

    if (conversation) {
      parts.push(`Conversation:\n${conversation}`)
    }

    parts.push(
      'Task:\nProduce the assistant response text only. Do not include commentary, preambles, markdown fences, or explanations unless explicitly requested in the conversation.'
    )

    const prompt = parts.join('\n\n')

    try {
      await runCodexCli(
        ['exec', '--ephemeral', '--skip-git-repo-check', '--color', 'never', '-o', tmpFile, prompt],
        { timeout: 120000 }
      )
      const output = await fs.readFile(tmpFile, 'utf8')
      return output.trim()
    } finally {
      await fs.rm(tmpFile, { force: true }).catch(() => {})
    }
  }

  return {
    name: 'openai-cli-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/openai-cli/check' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          try {
            const status = await checkPreferredCliStatus()
            const detectedTools = await checkDetectedTools()
            res.end(JSON.stringify({ ...status, detectedTools }));
          } catch (error) {
            res.end(JSON.stringify({ installed: false, error: 'No supported CLI found' }));
          }
          return; // Prevent passing to other middlewares
        }

        if (req.url === '/api/openai-cli/chat' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const parsedBody = JSON.parse(body);
              const { messages, systemPrompt, temperature } = parsedBody;
              const allMessages = [];
              if (systemPrompt) {
                allMessages.push({ role: 'system', content: systemPrompt });
              }
              if (Array.isArray(messages)) {
                allMessages.push(...messages);
              }

              if (allMessages.length === 0) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'No messages provided.' }));
              }

              const preferredStatus = await checkPreferredCliStatus()
              let data

              if (preferredStatus.provider === 'codex') {
                const text = await runCodexTextGeneration({ messages: messages || [], systemPrompt })
                data = {
                  choices: [{ message: { role: 'assistant', content: text } }],
                  provider: 'codex',
                }
              } else {
                const cliArgs = ['api', 'chat.completions.create', '-m', 'gpt-4o-mini'];
                if (typeof temperature === 'number') {
                  cliArgs.push('-t', String(temperature));
                }

                for (const msg of allMessages) {
                  if (!msg?.role || typeof msg?.content !== 'string') continue;
                  cliArgs.push('-g', msg.role, msg.content);
                }

                const { stdout } = await runOpenAiCli(cliArgs);
                data = safeJsonParse(stdout);
              }

              res.end(JSON.stringify(data));

            } catch (error) {
              console.error("Local Bridge Backend Error:", error);
              const stderr = (error.stderr || error.stdout || '').trim();
              const friendlyError = formatCliError(stderr || error.message);
              const lower = friendlyError.toLowerCase();
              res.statusCode = lower.includes('api key') || lower.includes('authentication') ? 401 : 500;
              res.end(JSON.stringify({ error: friendlyError }));
            }
          });
          return;
        }

        next(); // Let other requests pass through naturally
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), openAiCliBridge()],
})
