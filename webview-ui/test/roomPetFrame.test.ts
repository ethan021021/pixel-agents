import { readFileSync } from 'node:fs';

import { afterEach, expect, it } from 'vitest';

import { decodePetPng } from '../../core/src/assets/pngDecoder.js';
import { roomActorAt } from '../src/office/components/roomHitTesting.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import { createPet } from '../src/office/engine/petEntity.js';
import { roomPetFrame } from '../src/office/engine/roomPetFrame.js';
import { roomProjection } from '../src/office/roomProjection.js';
import { setPetTemplates } from '../src/office/sprites/petSpriteData.js';
import { Direction, PetState, TileType } from '../src/office/types.js';

afterEach(() => setPetTemplates([]));

it('grounds the actual Gitcat soles and picks every facing during an interpolated walk', () => {
  const raw = decodePetPng(
    readFileSync(new URL('../public/assets/pets/gitcat/pet.png', import.meta.url)),
  );
  setPetTemplates([raw], ['Gitcat']);
  const office = new OfficeState({
    version: 1,
    rows: 5,
    cols: 5,
    tiles: Array(25).fill(TileType.FLOOR_1),
    furniture: [],
  });
  const cat = createPet('cat', 0, 2, 2);
  office.pets.push(cat);
  cat.x += 2.4;
  cat.y += 1.2;
  const zoom = 5;
  const room = roomProjection(640, 480, 5, 5, zoom, 0, 0);
  for (const state of [PetState.WALK, PetState.FOLLOW, PetState.IDLE])
    for (const direction of [Direction.DOWN, Direction.UP, Direction.LEFT, Direction.RIGHT]) {
      cat.dir = direction;
      cat.state = state;
      let pivot: number | undefined;
      for (let beat = 0; beat < 4; beat++) {
        cat.frame = beat;
        const painted = roomPetFrame(cat, room, zoom)!;
        const bottom = painted.pixels.reduce((last, row, y) => (row.some(Boolean) ? y : last), -1);
        expect(painted.y + (bottom + 1) * zoom).toBe(Math.round(painted.foot.y));
        if (pivot !== undefined) expect(painted.x).toBe(pivot);
        pivot = painted.x;
        const sole = painted.pixels[bottom].findIndex(Boolean);
        const soleX = painted.x + (sole + 0.5) * zoom;
        const soleY = painted.y + (bottom + 0.5) * zoom;
        expect(Math.abs(soleX - painted.foot.x)).toBeLessThanOrEqual(
          painted.shadowHalfWidth * zoom + 0.5,
        );
        expect(roomActorAt(office, room, zoom, soleX, soleY).petId).toBe(cat.id);
        const head = painted.pixels.findIndex((row) => row.some(Boolean));
        const headX = painted.x + (painted.pixels[head].findIndex(Boolean) + 0.5) * zoom;
        expect(roomActorAt(office, room, zoom, headX, painted.y + (head + 0.5) * zoom).petId).toBe(
          cat.id,
        );
        expect(roomActorAt(office, room, zoom, soleX, soleY + zoom).petId).toBeNull();
      }
    }
});

it('preserves a deliberately lifted animation phase and skips unpainted pet sheets', () => {
  const ink = 'paint';
  const planted = [[''], [''], [ink], ['']];
  const raised = [[''], [ink], [''], ['']];
  const animation = [planted, raised, planted];
  const sheet = {
    walkDown: animation,
    walkUp: animation,
    walkRight: animation,
    idleUp: animation,
    idleDown: animation,
  };
  setPetTemplates([sheet]);
  const cat = createPet('hop', 0, 0, 0);
  cat.state = PetState.WALK;
  const room = roomProjection(80, 80, 2, 2, 1, 0, 0);
  const first = roomPetFrame(cat, room, 1)!;
  cat.frame = 1;
  const hop = roomPetFrame(cat, room, 1)!;
  expect(hop.y).toBe(first.y);
  expect(hop.pixels).toBe(raised);
  const blank = [[['']], [['']], [['']]];
  setPetTemplates([{ ...sheet, walkDown: blank }]);
  expect(roomPetFrame(cat, room, 1)).toBeNull();
});
