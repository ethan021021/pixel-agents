import * as fs from 'fs';

import type { AgentEvent, TranscriptProvider } from '../../core/src/provider.js';
import type { AgentStateStore } from './agentStateStore.js';
import { TRANSCRIPT_ACTIVITY_SEED_BYTES } from './constants.js';
import { clearAgentActivity } from './timerManager.js';
import type { AgentState } from './types.js';

export function applyTranscriptEvent(
  event: AgentEvent,
  agent: AgentState,
  store: AgentStateStore,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  provider: TranscriptProvider,
): void {
  const { id } = agent;
  switch (event.kind) {
    case 'turnStart':
      clearAgentActivity(agent, id, store, permissionTimers);
      break;
    case 'toolStart': {
      if (agent.activeToolIds.has(event.toolId)) break;
      if (!agent.turnActive) clearAgentActivity(agent, id, store, permissionTimers);
      const status = provider.formatToolStatus(event.toolName);
      agent.activeToolIds.add(event.toolId);
      agent.activeToolStatuses.set(event.toolId, status);
      agent.activeToolNames.set(event.toolId, event.toolName);
      store.broadcast({
        type: 'agentToolStart',
        id,
        toolId: event.toolId,
        toolName: event.toolName,
        status,
      });
      break;
    }
    case 'toolEnd':
      if (!agent.activeToolIds.delete(event.toolId)) break;
      agent.activeToolStatuses.delete(event.toolId);
      agent.activeToolNames.delete(event.toolId);
      store.broadcast({ type: 'agentToolDone', id, toolId: event.toolId });
      break;
    case 'turnEnd':
      agent.activeToolIds.clear();
      agent.activeToolStatuses.clear();
      agent.activeToolNames.clear();
      agent.turnActive = false;
      agent.isWaiting = true;
      store.broadcast({ type: 'agentToolsClear', id });
      store.broadcast({
        type: 'agentStatus',
        id,
        status: 'waiting',
        awaitingInput: event.awaitingInput,
      });
      break;
  }
}

/** Initialize from the latest turn, then follow appended records. Keep any
 * partial final line for the next poll, including when a write races adoption. */
export function seedTranscriptActivity(
  agent: AgentState,
  store: AgentStateStore,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  provider: TranscriptProvider,
): void {
  let lines: string[];
  try {
    const fd = fs.openSync(agent.jsonlFile, 'r');
    try {
      const { size } = fs.fstatSync(fd);
      const start = Math.max(0, size - TRANSCRIPT_ACTIVITY_SEED_BYTES);
      const buffer = Buffer.alloc(size - start);
      const read = fs.readSync(fd, buffer, 0, buffer.length, start);
      lines = buffer.toString('utf8', 0, read).split('\n');
      agent.fileOffset = start + read;
      agent.lineBuffer = lines.pop() ?? '';
      if (start > 0) {
        if (lines.length === 0) agent.lineBuffer = '';
        lines.shift();
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return;
  }

  const events: AgentEvent[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const event = provider.parseTranscriptLine(lines[i]);
    if (!event) continue;
    events.push(event);
    if (event.kind === 'turnStart' || event.kind === 'turnEnd') break;
  }
  // Earlier tool calls can be large and frequent. Seed only calls still open
  // at the end of the snapshot, so a recent finished tool doesn't flash.
  const ended = new Set(
    events.flatMap((event) => (event.kind === 'toolEnd' ? [event.toolId] : [])),
  );
  for (const event of events.reverse()) {
    if (event.kind === 'toolEnd' || (event.kind === 'toolStart' && ended.has(event.toolId)))
      continue;
    applyTranscriptEvent(event, agent, store, permissionTimers, provider);
  }
}
