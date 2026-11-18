import type { TranscriptProvider } from '../../../../../core/src/provider.js';
import { parseCodexTranscriptLine, scanCodexTranscripts } from './codexTranscript.js';

export const CODEX_PROVIDER_ID = 'codex';

const toolStatuses = new Map([
  ['exec_command', 'Running command'],
  ['write_stdin', 'Checking command'],
  ['apply_patch', 'Editing files'],
  ['read_file', 'Reading file'],
  ['list_directory', 'Listing files'],
  ['grep_files', 'Searching files'],
  ['view_image', 'Viewing image'],
  ['tool_search', 'Finding tools'],
  ['web_search', 'Searching the web'],
  ['spawn_agent', 'Delegating work'],
  ['wait_agent', 'Waiting for agents'],
  ['update_plan', 'Updating plan'],
]);

export const codexProvider: TranscriptProvider = {
  id: CODEX_PROVIDER_ID,
  readingTools: new Set([
    'read_file',
    'list_directory',
    'grep_files',
    'view_image',
    'tool_search',
    'web_search',
  ]),
  scanTranscripts: scanCodexTranscripts,
  parseTranscriptLine: parseCodexTranscriptLine,
  formatToolStatus: (toolName) => toolStatuses.get(toolName) ?? 'Using a tool',
};
