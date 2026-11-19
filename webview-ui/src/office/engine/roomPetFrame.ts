import type { RoomProjection } from '../roomProjection.js';
import { getPetSprites } from '../sprites/petSpriteData.js';
import { type Pet, type SpriteData, TILE_SIZE } from '../types.js';
import { getPetPose } from './petEntity.js';

interface PetContact {
  baseline: number;
  center: number;
  halfWidth: number;
  top: number;
}

const contacts = new WeakMap<SpriteData[], PetContact | null>();

/** Shared by the whole animation so alternating planted paws never move the body pivot. */
function petContact(animation: SpriteData[]): PetContact | null {
  const cached = contacts.get(animation);
  if (cached !== undefined) return cached;
  let bottom = -1;
  let top = Infinity;
  for (const frame of animation) {
    const first = frame.findIndex((row) => row.some(Boolean));
    if (first < 0) continue;
    top = Math.min(top, first);
    for (let y = frame.length - 1; y > bottom; y--) {
      if (frame[y].some(Boolean)) {
        bottom = y;
        break;
      }
    }
  }
  if (bottom < 0) {
    contacts.set(animation, null);
    return null;
  }
  let left = Infinity;
  let right = -1;
  // Include the width of the paw just above the sole pixel, across all stride phases.
  for (const frame of animation) {
    for (let y = Math.max(0, bottom - 1); y <= bottom; y++) {
      frame[y]?.forEach((pixel, x) => {
        if (pixel) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      });
    }
  }
  const contact = {
    baseline: bottom + 1,
    center: (left + right + 1) / 2,
    halfWidth: (right - left + 1) / 2,
    top,
  };
  contacts.set(animation, contact);
  return contact;
}

/** The room painter and picker share the paw-to-ground anchor and furniture depth order. */
export function roomPetFrame(pet: Pet, projection: Pick<RoomProjection, 'toScreen'>, zoom: number) {
  const pose = getPetPose(pet, getPetSprites(pet.petType));
  if (!pose) return null;
  const contact = petContact(pose.animation);
  if (!contact) return null;
  const foot = projection.toScreen(pet.x, pet.y);
  const x = Math.round(foot.x - contact.center * zoom);
  const y = Math.round(foot.y - contact.baseline * zoom);
  const depth = projection.toScreen(pet.x, pet.y + TILE_SIZE / 2).y;
  return {
    pixels: pose.pixels,
    x,
    y,
    depth,
    foot,
    headY: y + contact.top * zoom,
    shadowHalfWidth: contact.halfWidth,
  };
}
