import * as path from 'path';

/** Codex supplies its own thread ID. The title includes it as soon as a new
 *  thread opens, before the first prompt creates a rollout. The per-launch
 *  override keeps the user's status line, settings, and approvals in place. */
export function buildCodexLaunchCommand() {
  const codexHome = process.env.CODEX_HOME;
  return {
    command: 'codex',
    args: ['--no-alt-screen', '-c', 'tui.terminal_title=["app-name","thread"]'],
    env: codexHome ? { CODEX_HOME: path.resolve(codexHome) } : undefined,
  };
}

export function isInheritedCodexSessionEnv(name: string): boolean {
  return ['CODEX_SESSION_ID', 'CODEX_THREAD_ID', 'CODEX_TOOL_CALL_ID'].includes(name.toUpperCase());
}

const ID = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const CODEX_TITLE = `codex \\| (${ID})`;
const TITLE_BODY = new RegExp(`^${CODEX_TITLE}$`, 'i');
const TITLE_FRAME = new RegExp(`\\x1b\\]0;${CODEX_TITLE}(?:\\x07|\\x1b\\\\)`, 'i');
const TITLE_FRAME_LENGTH = 54;

export function codexSessionIdFromTitle(title: string): string | undefined {
  return TITLE_BODY.exec(title)?.[1].toLowerCase();
}

/** Read an exact title frame from this PTY's output, including frames split
 *  across chunks. Plain text UUIDs printed in the terminal do not count. */
export function codexTerminalTitles(): (chunk: string) => string | undefined {
  let tail = '';
  return (chunk) => {
    const data = tail + chunk;
    tail = data.slice(-TITLE_FRAME_LENGTH);
    return TITLE_FRAME.exec(data)?.[1].toLowerCase();
  };
}
