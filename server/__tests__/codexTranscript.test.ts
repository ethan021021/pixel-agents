import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  parseCodexTranscriptLine,
  scanCodexTranscripts,
} from '../src/providers/hook/codex/codexTranscript.js';

const SESSION_ID = '12345678-1234-1234-1234-123456789abc';
const SECOND_ID = '87654321-1234-1234-1234-123456789abc';
const CWD = path.resolve('example-project');

const line = (type: string, payload: Record<string, unknown>) => JSON.stringify({ type, payload });

function metadata(id: string, extras: Record<string, unknown> = {}): string {
  return line('session_meta', { id, cwd: CWD, source: 'cli', ...extras });
}

describe('Codex rollout discovery', () => {
  let codexHome: string;
  let datedDirectory: string;

  beforeEach(() => {
    codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-agents-codex-'));
    vi.stubEnv('CODEX_HOME', codexHome);
    datedDirectory = path.join(codexHome, 'sessions', '2025', '01', '02');
    fs.mkdirSync(datedDirectory, { recursive: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(codexHome, { recursive: true, force: true });
  });

  function writeRollout(name: string, record: string): string {
    const file = path.join(datedDirectory, name);
    fs.writeFileSync(file, `${record}\n`);
    return file;
  }

  it('discovers recently modified CLI and desktop sessions even under old date directories', () => {
    const cli = writeRollout('rollout-cli.jsonl', metadata(SESSION_ID));
    writeRollout('rollout-desktop.jsonl', metadata(SECOND_ID, { source: 'vscode' }));
    const old = new Date('2025-01-02T00:00:00Z');
    fs.utimesSync(cli, old, old);
    const cutoff = old.getTime() + 1000;
    expect(scanCodexTranscripts(cutoff).map((entry) => entry.sessionId)).toEqual([SECOND_ID]);

    fs.appendFileSync(cli, `${line('event_msg', { type: 'task_started' })}\n`);
    expect(scanCodexTranscripts(cutoff)).toContainEqual({
      sessionId: SESSION_ID,
      cwd: CWD,
      transcriptPath: cli,
      mtimeMs: fs.statSync(cli).mtimeMs,
      size: fs.statSync(cli).size,
    });
  });

  it('ignores child rollouts, internal threads and other files', () => {
    writeRollout('rollout-child.jsonl', metadata(SESSION_ID, { parent_thread_id: SECOND_ID }));
    writeRollout(
      'rollout-legacy-child.jsonl',
      metadata(SESSION_ID, { source: { subagent: 'review' } }),
    );
    writeRollout(
      'rollout-internal.jsonl',
      metadata(SESSION_ID, { thread_source: 'guardian_review' }),
    );
    writeRollout('rollout-compressed.jsonl.zst', metadata(SESSION_ID));
    writeRollout('other.jsonl', metadata(SESSION_ID));
    writeRollout('rollout-invalid.jsonl', metadata('invalid'));
    writeRollout('rollout-relative.jsonl', metadata(SESSION_ID, { cwd: 'example-project' }));
    expect(scanCodexTranscripts(0)).toEqual([]);
  });

  it('retries partial metadata and takes the latest rollout for a session', () => {
    const file = path.join(datedDirectory, 'rollout-opening.jsonl');
    const header = metadata(SESSION_ID);
    fs.writeFileSync(file, header.slice(0, -1));
    expect(scanCodexTranscripts(0)).toEqual([]);

    fs.appendFileSync(file, `${header.at(-1)}\n`);
    expect(scanCodexTranscripts(0)).toMatchObject([{ transcriptPath: file }]);

    const next = writeRollout('rollout-reverted.jsonl', metadata(SESSION_ID));
    const later = new Date(Date.now() + 1000);
    fs.utimesSync(next, later, later);
    expect(scanCodexTranscripts(0)).toMatchObject([{ transcriptPath: next }]);
  });
});

describe('Codex rollout activity', () => {
  it.each([
    ['task_started', 'turnStart'],
    ['turn_started', 'turnStart'],
    ['task_complete', 'turnEnd'],
    ['turn_complete', 'turnEnd'],
    ['turn_aborted', 'turnEnd'],
  ])('maps %s to %s', (type, kind) => {
    expect(parseCodexTranscriptLine(line('event_msg', { type }))).toEqual({ kind });
  });

  it.each([
    ['function_call', 'function_call_output'],
    ['custom_tool_call', 'custom_tool_call_output'],
    ['tool_search_call', 'tool_search_output'],
  ])('pairs %s with %s without forwarding content', (type, resultType) => {
    const toolName = type === 'tool_search_call' ? 'tool_search' : 'a_tool';
    expect(
      parseCodexTranscriptLine(
        line('response_item', {
          type,
          name: toolName,
          call_id: 'a-call',
          arguments: 'a private command',
          input: 'private input',
        }),
      ),
    ).toEqual({ kind: 'toolStart', toolId: 'a-call', toolName });
    expect(
      parseCodexTranscriptLine(
        line('response_item', { type: resultType, call_id: 'a-call', output: 'private output' }),
      ),
    ).toEqual({ kind: 'toolEnd', toolId: 'a-call' });
  });

  it('ignores malformed, incomplete and unrelated entries', () => {
    expect(parseCodexTranscriptLine('{"type":"event_msg"')).toBeNull();
    expect(parseCodexTranscriptLine(metadata(SESSION_ID))).toBeNull();
    expect(parseCodexTranscriptLine(line('event_msg', { type: 'token_count' }))).toBeNull();
    expect(parseCodexTranscriptLine(line('response_item', { type: 'function_call' }))).toBeNull();
    expect(
      parseCodexTranscriptLine(
        line('response_item', { type: 'function_call', name: 'shell command', call_id: 'a-call' }),
      ),
    ).toBeNull();
  });
});
