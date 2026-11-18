/**
 * The cast's server messages, handled here so the message hook only hands them over
 * (like usage/usageStore.ts handleUsageMessage): the character profiles and items, the
 * looks they move agents to, the roster's recency, and the external char_N.png sprites.
 */

import { parseCharacterProfiles } from '../../../core/src/characterProfiles.js';
import type {
  CharacterProfilesLoaded,
  CharacterSpritesLoaded,
  RecentCharactersLoaded,
} from '../../../core/src/messages.js';
import { parseWardrobeItems } from '../../../core/src/wardrobeItems.js';
import { castStore } from './castStore.js';
import { setExternalCharacterSprites } from './officeSprites.js';

/** What the cast's messages change in the office besides the cast. */
export interface CastOffice {
  setAgentLook(id: number, palette: number, repeat: number): void;
}

/** Handle a cast message; false when `msg` isn't one. */
export function handleCastMessage(msg: { type?: unknown }, office: CastOffice): boolean {
  if (msg.type === 'characterProfilesLoaded') {
    const loaded = msg as CharacterProfilesLoaded;
    // Characters inserted or deleted before an agent's move it to another index: its
    // new look comes with the list, applied first so no frame mixes the two.
    for (const look of loaded.agentLooks ?? [])
      office.setAgentLook(look.id, look.palette, look.repeat);
    castStore.receiveProfiles(
      parseCharacterProfiles(loaded.profiles),
      loaded.saveId,
      loaded.items ? (parseWardrobeItems(loaded.items) ?? undefined) : undefined,
    );
    return true;
  }
  if (msg.type === 'recentCharactersLoaded') {
    castStore.receiveRecent((msg as RecentCharactersLoaded).recent);
    return true;
  }
  if (msg.type === 'characterSpritesLoaded') {
    const loaded = msg as CharacterSpritesLoaded;
    setExternalCharacterSprites(loaded.characters, loaded.presets);
    return true;
  }
  return false;
}
