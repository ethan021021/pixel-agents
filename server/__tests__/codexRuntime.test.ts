import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { AgentRuntime } from '../src/agentRuntime.js';
import { AgentStateStore } from '../src/agentStateStore.js';
import { EXTERNAL_SCAN_INTERVAL_MS, FILE_WATCHER_POLL_INTERVAL_MS } from '../src/constants.js';
import { claudeProvider } from '../src/providers/index.js';

let temporaryHome: string | undefined;
let runtime: AgentRuntime | undefined;

afterEach(() => {
  runtime?.dispose();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  if (temporaryHome) rmSync(temporaryHome, { recursive: true, force: true });
});

function record(type: string, payload: Record<string, unknown>): string {
  return `${JSON.stringify({ timestamp: new Date().toISOString(), type, payload })}\n`;
}

function writeRollout(rolloutDirectory: string, cwd: string, sessionId = randomUUID()) {
  const filename = `rollout-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}-${sessionId}.jsonl`;
  const file = join(rolloutDirectory, filename);
  appendFileSync(
    file,
    record('session_meta', {
      id: sessionId,
      session_id: sessionId,
      cwd,
      originator: 'codex_work_desktop',
      source: 'vscode',
      thread_source: 'user',
    }) + record('event_msg', { type: 'task_started', turn_id: 'turn-1' }),
  );
  return { file, sessionId };
}

function startOffice() {
  vi.useFakeTimers();
  const temp = mkdtempSync(join(tmpdir(), 'pxl-test-codex-'));
  temporaryHome = temp;
  vi.stubEnv('CODEX_HOME', temp);
  const [year, month, day] = new Date().toISOString().slice(0, 10).split('-');
  const rolloutDirectory = join(temp, 'sessions', year, month, day);
  const project = join(temp, 'project');
  mkdirSync(rolloutDirectory, { recursive: true });
  mkdirSync(project);

  const store = new AgentStateStore();
  const broadcasts: Record<string, unknown>[] = [];
  store.on('broadcast', (message) => broadcasts.push(message));
  runtime = new AgentRuntime(store, claudeProvider);
  const directories = [{ name: 'Known Directory', path: project }];
  runtime.startExternalScanning(join(temp, 'host-workspace'), () => directories);
  return { temp, rolloutDirectory, project, directories, runtime, store, broadcasts };
}

it('adopts a Codex session in a known Directory and follows its appended activity', () => {
  const { temp, rolloutDirectory, project, directories, runtime, store, broadcasts } =
    startOffice();
  const cwd = join(project, 'packages');
  const unrelated = join(temp, 'project-other');
  mkdirSync(cwd);
  mkdirSync(unrelated);
  const rollout = writeRollout(rolloutDirectory, cwd);
  const foreignRollout = writeRollout(rolloutDirectory, unrelated);
  vi.advanceTimersByTime(EXTERNAL_SCAN_INTERVAL_MS);
  const adopted = [...store.values()];
  expect(adopted).toEqual([
    expect.objectContaining({
      sessionId: rollout.sessionId,
      directoryName: 'Known Directory',
      isExternal: true,
    }),
  ]);
  const [{ id }] = adopted;

  runtime.setWatchAllSessions(true, directories);
  vi.advanceTimersByTime(EXTERNAL_SCAN_INTERVAL_MS);
  expect([...store.values()].map(({ sessionId }) => sessionId)).toEqual([
    rollout.sessionId,
    foreignRollout.sessionId,
  ]);

  runtime.setWatchAllSessions(false, directories);
  vi.advanceTimersByTime(EXTERNAL_SCAN_INTERVAL_MS);
  expect([...store.keys()]).toEqual([id]);

  const callId = 'call-1';
  appendFileSync(
    rollout.file,
    record('response_item', {
      type: 'function_call',
      name: 'exec_command',
      arguments: JSON.stringify({ cmd: 'pwd' }),
      call_id: callId,
    }),
  );
  vi.advanceTimersByTime(FILE_WATCHER_POLL_INTERVAL_MS);
  expect(broadcasts).toContainEqual(
    expect.objectContaining({ type: 'agentToolStart', id, toolId: callId }),
  );
  expect(broadcasts).toContainEqual({ type: 'agentStatus', id, status: 'active' });

  appendFileSync(
    rollout.file,
    record('response_item', { type: 'function_call_output', call_id: callId, output: 'ok' }) +
      record('event_msg', { type: 'task_complete', turn_id: 'turn-1' }),
  );
  vi.advanceTimersByTime(FILE_WATCHER_POLL_INTERVAL_MS);
  expect(broadcasts).toContainEqual({ type: 'agentToolDone', id, toolId: callId });
  expect(broadcasts).toContainEqual(
    expect.objectContaining({ type: 'agentStatus', id, status: 'waiting' }),
  );

  vi.advanceTimersByTime(EXTERNAL_SCAN_INTERVAL_MS);
  expect([...store.keys()]).toEqual([id]);

  runtime.closeAgent(id);
  appendFileSync(rollout.file, record('event_msg', { type: 'task_started', turn_id: 'turn-2' }));
  vi.advanceTimersByTime(EXTERNAL_SCAN_INTERVAL_MS);
  expect(store.size).toBe(0);
});

it('keeps the agent when its Codex session moves to a newer rollout', () => {
  const { rolloutDirectory, project, store, broadcasts } = startOffice();
  const original = writeRollout(rolloutDirectory, project);
  vi.advanceTimersByTime(EXTERNAL_SCAN_INTERVAL_MS);
  expect(store.size).toBe(1);
  const [id] = store.keys();

  const replacement = writeRollout(rolloutDirectory, project, original.sessionId);
  const now = new Date();
  utimesSync(replacement.file, now, now);
  vi.advanceTimersByTime(EXTERNAL_SCAN_INTERVAL_MS);
  expect([...store.keys()]).toEqual([id]);
  expect(store.get(id)?.jsonlFile).toBe(replacement.file);

  broadcasts.length = 0;
  appendFileSync(
    replacement.file,
    record('event_msg', { type: 'task_complete', turn_id: 'turn-1' }),
  );
  vi.advanceTimersByTime(FILE_WATCHER_POLL_INTERVAL_MS);
  expect(broadcasts).toContainEqual(
    expect.objectContaining({ type: 'agentStatus', id, status: 'waiting' }),
  );
});
