import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { isRecord } from '../../../../../core/src/isRecord.js';
import type { AgentEvent } from '../../../../../core/src/provider.js';

const METADATA_MAX_BYTES = 512 * 1024;
const SESSION_ID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ROLLOUT_FILE_PATTERN = /^rollout-.*\.jsonl$/;
const DATE_DIRECTORY_PATTERNS = [/^\d{4}$/, /^\d{2}$/, /^\d{2}$/];
const TOOL_NAME_PATTERN = /^[a-z0-9_][a-z0-9_.:-]{0,127}$/i;

export interface CodexTranscript {
  sessionId: string;
  cwd: string;
  transcriptPath: string;
  mtimeMs: number;
  size: number;
}

interface CodexSessionMetadata {
  sessionId: string;
  cwd: string;
}

function rolloutRecord(line: string) {
  try {
    const record: unknown = JSON.parse(line);
    if (isRecord(record) && typeof record.type === 'string' && isRecord(record.payload)) {
      return { type: record.type, payload: record.payload };
    }
  } catch {
    // The last record may still be getting written.
  }
  return undefined;
}

function readSessionMetadata(file: string, size: number): CodexSessionMetadata | undefined {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, 'r');
    const head = Buffer.allocUnsafe(Math.min(size, METADATA_MAX_BYTES));
    const bytesRead = fs.readSync(fd, head, 0, head.length, 0);
    const lineEnd = head.subarray(0, bytesRead).indexOf(0x0a);
    if (lineEnd < 0) return undefined;
    const record = rolloutRecord(head.toString('utf8', 0, lineEnd));
    if (record?.type !== 'session_meta') return undefined;
    const { id, cwd, source, thread_source, parent_thread_id } = record.payload;
    if (
      typeof id !== 'string' ||
      !SESSION_ID_PATTERN.test(id) ||
      typeof cwd !== 'string' ||
      !path.isAbsolute(cwd) ||
      cwd.includes('\0') ||
      parent_thread_id ||
      thread_source === 'subagent' ||
      thread_source === 'guardian_review' ||
      thread_source === 'memory_consolidation' ||
      (isRecord(source) && ('subagent' in source || 'internal' in source))
    ) {
      return undefined;
    }
    return { sessionId: id, cwd };
  } catch {
    // A rollout may be archived or deleted while discovery is reading it.
    return undefined;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function* rolloutPaths(directory: string, depth = 0): Generator<string> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isFile() && ROLLOUT_FILE_PATTERN.test(entry.name)) {
      yield path.join(directory, entry.name);
    } else if (entry.isDirectory() && DATE_DIRECTORY_PATTERNS[depth]?.test(entry.name)) {
      yield* rolloutPaths(path.join(directory, entry.name), depth + 1);
    }
  }
}

interface CachedMetadata {
  metadata: CodexSessionMetadata | undefined;
  mtimeMs: number;
  size: number;
}

let previousMetadata = new Map<string, CachedMetadata>();

/** Check file mtimes across date directories because resuming a session can append to an old rollout. */
export function scanCodexTranscripts(modifiedSince: number): CodexTranscript[] {
  const sessionsRoot = path.resolve(
    process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
    'sessions',
  );
  const currentMetadata = new Map<string, CachedMetadata>();
  const sessions = new Map<string, CodexTranscript>();
  for (const transcriptPath of rolloutPaths(sessionsRoot)) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(transcriptPath);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.mtimeMs < modifiedSince) continue;
    const { size, mtimeMs } = stat;
    const cached = previousMetadata.get(transcriptPath);
    const metadata =
      cached?.mtimeMs === mtimeMs && cached.size === size
        ? cached.metadata
        : readSessionMetadata(transcriptPath, size);
    currentMetadata.set(transcriptPath, { metadata, size, mtimeMs });
    if (!metadata) continue;
    const previous = sessions.get(metadata.sessionId);
    if (!previous || mtimeMs > previous.mtimeMs) {
      sessions.set(metadata.sessionId, { ...metadata, transcriptPath, size, mtimeMs });
    }
  }
  previousMetadata = currentMetadata;
  return [...sessions.values()];
}

export function parseCodexTranscriptLine(line: string): AgentEvent | null {
  const record = rolloutRecord(line);
  if (!record) return null;
  const { type, payload } = record;
  if (type === 'event_msg') {
    switch (payload.type) {
      case 'task_started':
      case 'turn_started':
        return { kind: 'turnStart' };
      case 'task_complete':
      case 'turn_complete':
      case 'turn_aborted':
        return { kind: 'turnEnd' };
    }
  }

  const callId = payload.call_id;
  if (type !== 'response_item' || typeof callId !== 'string' || !callId) return null;
  switch (payload.type) {
    case 'custom_tool_call':
    case 'function_call':
      return typeof payload.name === 'string' && TOOL_NAME_PATTERN.test(payload.name)
        ? { kind: 'toolStart', toolId: callId, toolName: payload.name }
        : null;
    case 'tool_search_call':
      return { kind: 'toolStart', toolId: callId, toolName: 'tool_search' };
    case 'custom_tool_call_output':
    case 'function_call_output':
    case 'tool_search_output':
      return { kind: 'toolEnd', toolId: callId };
    default:
      return null;
  }
}
