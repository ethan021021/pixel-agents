/**
 * Provider registry: re-exports all bundled providers.
 *
 * Register each integration as a HookProvider or a TranscriptProvider.
 *
 * The adapter (VS Code extension, standalone CLI, etc.) imports from here rather
 * than reaching into each provider directory directly.
 */

import type { HookProvider, TranscriptProvider } from '../../../core/src/provider.js';
import { claudeProvider } from './hook/claude/claude.js';
import { codexProvider } from './hook/codex/codex.js';

export { claudeProvider };
export { copyHookScript } from './hook/claude/claudeHookInstaller.js';

/** Every bundled hook provider, in registration order. The consent gate loops
 *  over this at the webviewReady handshake (one ask per provider that needs
 *  one) and `hooksConsentResponse` resolves its provider id against it. */
export const hookProviders: readonly HookProvider[] = [claudeProvider];
export const transcriptProviders: readonly TranscriptProvider[] = [codexProvider];

export function transcriptProviderById(id: string | undefined): TranscriptProvider | undefined {
  return transcriptProviders.find((provider) => provider.id === id);
}

export const providerCapabilities = {
  type: 'providerCapabilities' as const,
  readingTools: [
    ...new Set([...hookProviders, ...transcriptProviders].flatMap((p) => [...p.readingTools])),
  ],
  subagentToolNames: [...claudeProvider.subagentToolNames],
};

/** Resolve a wire-supplied provider id, or undefined for an unknown one —
 *  the caller writes nothing on undefined (fail-closed, like a junk choice). */
export function hookProviderById(id: unknown): HookProvider | undefined {
  return typeof id === 'string' ? hookProviders.find((p) => p.id === id) : undefined;
}
