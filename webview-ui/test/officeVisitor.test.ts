import assert from 'node:assert/strict';

import { beforeAll, test } from 'vitest';

import { roomActorAt, roomSeatAt } from '../src/office/components/roomHitTesting.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import { createPet } from '../src/office/engine/petEntity.js';
import {
  roomFurnitureArt,
  roomFurnitureSpriteBounds,
} from '../src/office/engine/roomFurnitureArt.js';
import { roomSeatingModel } from '../src/office/engine/roomSeatingModels.js';
import type { LoadedAssetData } from '../src/office/layout/furnitureCatalog.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import { roomProjection } from '../src/office/roomProjection.js';
import { setPetTemplates } from '../src/office/sprites/petSpriteData.js';
import type { OfficeLayout } from '../src/office/types.js';
import { CharacterState, PetState, TILE_SIZE, TileType } from '../src/office/types.js';

beforeAll(() => {
  const furniture = { label: 'Fixture', width: 16, height: 16, footprintW: 1, footprintH: 1 };
  const catalog: LoadedAssetData['catalog'] = [
    { ...furniture, id: 'VISITOR_CHAIR', category: 'chairs', isDesk: false },
    {
      ...furniture,
      id: 'VISITOR_SOFA',
      category: 'chairs',
      isDesk: false,
      footprintW: 2,
      footprintH: 2,
      backgroundTiles: 1,
    },
    { ...furniture, id: 'VISITOR_DESK', category: 'desks', isDesk: true },
    { ...furniture, id: 'VISITOR_SHARED_DESK', category: 'desks', isDesk: true, footprintW: 3 },
    { ...furniture, id: 'VISITOR_PC', category: 'electronics', isDesk: false },
    {
      ...furniture,
      id: 'DESK_FRONT',
      category: 'desks',
      isDesk: true,
      footprintW: 3,
      footprintH: 2,
      backgroundTiles: 1,
    },
  ];
  assert.ok(
    buildDynamicCatalog({
      catalog,
      sprites: {
        VISITOR_CHAIR: [['c']],
        VISITOR_SOFA: [['s']],
        VISITOR_DESK: [['d']],
        VISITOR_SHARED_DESK: [['d']],
        VISITOR_PC: [['p']],
        DESK_FRONT: [['d']],
      },
    }),
  );
});

function layout(): OfficeLayout {
  return {
    version: 1,
    cols: 8,
    rows: 8,
    tiles: Array<TileType>(64).fill(TileType.FLOOR_1),
    furniture: [
      { uid: 'desk', type: 'VISITOR_DESK', col: 3, row: 1 },
      { uid: 'pc', type: 'VISITOR_PC', col: 3, row: 1 },
      { uid: 'desk-chair', type: 'VISITOR_CHAIR', col: 3, row: 2 },
      { uid: 'spare-chair', type: 'VISITOR_CHAIR', col: 6, row: 5 },
    ],
  };
}

function run(office: OfficeState): void {
  for (let i = 0; i < 250; i++) office.update(1 / 30);
}

test('redirects the visitor mid-step without snapping and keeps the visitor local', () => {
  const office = new OfficeState(layout());
  assert.equal(office.enterOffice(1), true);
  const visitor = office.visitor!;
  assert.equal(visitor.palette, 1);
  assert.equal(office.getCharacters().includes(visitor), true);
  assert.equal(office.characters.size, 0);
  assert.deepEqual(office.getPersistableSeats(), {});
  assert.equal(office.moveVisitor(1, 1), true);
  office.update(0.1);
  const { x, y, moveProgress } = visitor;
  assert.ok(moveProgress > 0);
  assert.equal(office.moveVisitor(7, 7), true);
  assert.deepEqual([visitor.x, visitor.y, visitor.moveProgress], [x, y, moveProgress]);
  run(office);
  assert.deepEqual([visitor.tileCol, visitor.tileRow, visitor.state], [7, 7, CharacterState.IDLE]);
  assert.equal(office.moveVisitor(3, 1), false, 'the desk blocks floor movement');
  office.leaveOffice();
  assert.deepEqual(office.getCharacters(), []);
});

test('notifies visitor subscribers only when presence changes', () => {
  const office = new OfficeState(layout());
  const observed: boolean[] = [];
  const unsubscribe = office.subscribeVisitor(() => observed.push(office.visitor !== null));
  office.leaveOffice();
  office.enterOffice(0);
  office.enterOffice(1);
  office.moveVisitor(7, 7);
  run(office);
  office.rebuildFromLayout({ ...layout(), furniture: [], tiles: Array(64).fill(TileType.VOID) });
  assert.equal(office.enterOffice(0), false);
  assert.deepEqual(observed, [true, false]);
  unsubscribe();
  office.rebuildFromLayout(layout());
  assert.equal(office.enterOffice(0), true);
  assert.deepEqual(observed, [true, false]);
});

test('sits without reserving a chair and yields to a restored agent assignment', () => {
  const office = new OfficeState(layout());
  assert.equal(office.enterOffice(0), true);
  assert.equal(office.sitVisitor('spare-chair'), true);
  run(office);
  const visitor = office.visitor!;
  assert.equal(visitor.state, CharacterState.TYPE);
  assert.equal(visitor.seatId, 'spare-chair');
  assert.equal(office.seats.get('spare-chair')!.assigned, false);
  office.addAgent(8, 0, 0, 'spare-chair', true);
  office.update(1 / 30);
  assert.equal(office.getPersistableSeats()[8].seatId, 'spare-chair');
  assert.equal(visitor.seatId, null);
  assert.notDeepEqual([visitor.tileCol, visitor.tileRow], [6, 5]);
  assert.equal(office.sitVisitor('spare-chair'), false);
});

test('room furniture hits choose the clear seat nearest the click on a two-seat sofa', () => {
  const saved = layout();
  saved.furniture.push({ uid: 'sofa', type: 'VISITOR_SOFA', col: 2, row: 4 });
  const office = new OfficeState(saved);
  const furniture = office.furniture.find(({ uid }) => uid === 'sofa')!;
  const room = roomProjection(640, 480, saved.cols, saved.rows, 2, 0, 0);
  const { x, y } = room.toScreen(3.5 * TILE_SIZE, 5.5 * TILE_SIZE);
  assert.equal(roomSeatAt(office, furniture, room, x, y)?.uid, 'sofa:1');
  office.addAgent(8, 0, 0, 'sofa:1', true);
  assert.equal(roomSeatAt(office, furniture, room, x, y)?.uid, 'sofa');
});

test('picks the original desk from its modeled pixels and preserves custom furniture art', () => {
  const saved = layout();
  saved.furniture.push({ uid: 'modeled-desk', type: 'DESK_FRONT', col: 0, row: 5 });
  const office = new OfficeState(saved);
  const art = roomFurnitureArt(office.furniture, office.getLayout());
  const desk = art.find(({ furniture }) => furniture.uid === 'modeled-desk');
  const custom = art.find(({ furniture }) => furniture.uid === 'spare-chair');
  assert.ok(desk?.model);
  assert.ok(custom);
  assert.equal(custom.model, undefined);
  assert.equal(custom.pixels, custom.furniture.sprite);

  const model = roomSeatingModel({
    type: 'DESK_FRONT',
    width: 3 * TILE_SIZE,
    depth: 2 * TILE_SIZE,
    backgroundRows: 1,
    orientation: 'front',
    surfaceHeight: 0,
    wallAlongX: true,
  });
  const tabletop = model?.boxes.find(({ z, height }) => z + height === model.surfaceHeight);
  assert.ok(tabletop);
  const colors = new Set(desk.pixels.flat());
  for (const color of tabletop.colors) assert.ok(colors.has(color), 'all three faces rasterize');

  const zoom = 2;
  const room = roomProjection(640, 480, saved.cols, saved.rows, zoom, 0, 0);
  const bounds = roomFurnitureSpriteBounds(desk, room, zoom);
  const pickPixel = (color: string) => {
    const row = desk.pixels.findIndex((line) => line.includes(color));
    assert.ok(row >= 0);
    const col = desk.pixels[row].indexOf(color);
    return roomActorAt(
      office,
      room,
      zoom,
      bounds.x + (col + 0.5) * zoom,
      bounds.y + (row + 0.5) * zoom,
    );
  };
  assert.equal(pickPixel(tabletop.colors[0]).furniture?.uid, 'modeled-desk');
  assert.equal(pickPixel('').furniture, null);
});

test('opens only a reachable desk and rechecks its terminal on arrival', () => {
  const office = new OfficeState(layout());
  office.addAgent(27, 0, 0, 'desk-chair', true);
  assert.equal(office.seatWorkstations.get('desk-chair'), 'pc');
  assert.equal(office.enterOffice(0), true);
  let terminal = 27;
  const focused: number[] = [];
  const openDesk = () =>
    office.walkVisitorToDesk(
      3,
      1,
      (id) => id === terminal,
      (id) => focused.push(id),
    );
  assert.equal(openDesk(), true);
  assert.deepEqual(focused, [], 'opening waits for arrival');
  terminal = 0;
  run(office);
  assert.deepEqual(focused, []);
  terminal = 27;
  assert.equal(openDesk(), true);
  assert.deepEqual(focused, [27]);
  const visitor = office.visitor!;
  assert.equal(Math.abs(visitor.tileCol - 3) + Math.abs(visitor.tileRow - 1), 1);
});

test('chooses a terminal-backed seat for a shared desk and preserves exact PC ownership', () => {
  const setup = layout();
  setup.furniture = [
    { uid: 'shared-desk', type: 'VISITOR_SHARED_DESK', col: 2, row: 1 },
    { uid: 'external-pc', type: 'VISITOR_PC', col: 2, row: 1 },
    { uid: 'terminal-pc', type: 'VISITOR_PC', col: 4, row: 1 },
    { uid: 'external-chair', type: 'VISITOR_CHAIR', col: 2, row: 2 },
    { uid: 'terminal-chair', type: 'VISITOR_CHAIR', col: 4, row: 2 },
  ];
  const office = new OfficeState(setup);
  office.addAgent(10, 0, 0, 'external-chair', true);
  office.addAgent(20, 0, 0, 'terminal-chair', true);
  office.enterOffice(0);
  const canFocus = (id: number) => id === 20;
  assert.equal(
    office.getVisitorDeskAgent(2, 1, canFocus),
    null,
    'an unavailable PC never opens its neighbor',
  );
  assert.equal(
    office.getVisitorDeskAgent(3, 1, canFocus),
    20,
    'the desk surface can choose its terminal-backed seat',
  );
  assert.equal(office.getVisitorDeskAgent(4, 1, canFocus), 20);
  const opened: number[] = [];
  assert.equal(
    office.walkVisitorToDesk(3, 1, canFocus, (id) => opened.push(id)),
    true,
  );
  run(office);
  assert.deepEqual(opened, [20]);
});

test('layout replacement cancels a pending desk focus while retaining the visitor', () => {
  const office = new OfficeState(layout());
  office.addAgent(27, 0, 0, 'desk-chair', true);
  office.enterOffice(0);
  const visitor = office.visitor;
  let focused = false;
  assert.equal(
    office.walkVisitorToDesk(
      3,
      1,
      () => true,
      () => {
        focused = true;
      },
    ),
    true,
  );
  office.rebuildFromLayout(layout());
  run(office);
  assert.equal(office.visitor, visitor);
  assert.equal(focused, false);
});

test('walks into petting range before showing a heart', () => {
  const office = new OfficeState(layout());
  office.enterOffice(0);
  const pet = createPet('cat', 0, 4, 4);
  pet.wanderTimer = Infinity;
  office.pets.push(pet);
  assert.equal(office.petWithVisitor(pet.id), true);
  assert.equal(pet.bubbleType, null);
  for (let i = 0; i < 250 && !pet.bubbleType; i++) office.update(1 / 30);
  assert.equal(pet.bubbleType, 'heart');
  const { tileCol, tileRow } = office.visitor!;
  assert.equal(Math.abs(tileCol - pet.tileCol) + Math.abs(tileRow - pet.tileRow), 1);
});

test('catches up to a pet that passes more than one approach point', () => {
  const office = new OfficeState(layout());
  office.enterOffice(0);
  const pet = createPet('moving-cat', 0, 0, 4);
  pet.state = PetState.WALK;
  pet.path = [
    ...[3, 2, 1, 0].map((row) => ({ col: 0, row })),
    ...[1, 2, 3, 4, 5, 6, 7].map((col) => ({ col, row: 0 })),
    ...[1, 2, 3, 4, 5, 6, 7].map((row) => ({ col: 7, row })),
  ];
  office.pets.push(pet);
  assert.equal(office.petWithVisitor(pet.id), true);
  for (let i = 0; i < 500 && !pet.bubbleType; i++) office.update(1 / 30);
  assert.equal(pet.bubbleType, 'heart');
  assert.equal(pet.state, PetState.WALK, 'the pet keeps moving during the approach');
  const visitor = office.visitor!;
  assert.ok(Math.abs(visitor.tileCol - pet.tileCol) + Math.abs(visitor.tileRow - pet.tileRow) <= 1);
});

test('offers Gitcat while visiting a room with no placed pets, including late-loaded art', () => {
  const office = new OfficeState(layout());
  assert.deepEqual(office.getPets(), []);
  assert.equal(office.enterOffice(0), true);
  assert.deepEqual(office.getPets(), []);
  const frames = [[['c']], [['c']], [['c']]];
  setPetTemplates(
    [{ walkDown: frames, idleDown: frames, walkUp: frames, idleUp: frames, walkRight: frames }],
    ['Gitcat'],
  );
  office.update(1 / 30);
  const [cat] = office.getPets();
  assert.equal(cat.name, 'Gitcat');
  assert.equal(office.getPetAt(cat.x, cat.y - 1), cat.id);
  assert.equal(office.petWithVisitor(cat.id), true);
  assert.equal(cat.bubbleType, 'heart');
  assert.deepEqual(office.pets, []);
  assert.deepEqual(office.getLayout().pets, []);

  office.addPet({ id: 'placed', petType: 0 });
  assert.deepEqual(
    office.getPets().map((pet) => pet.id),
    ['placed'],
  );
  office.removePet('placed');
  assert.deepEqual(
    office.getPets().map((pet) => pet.name),
    ['Gitcat'],
  );
  office.leaveOffice();
  assert.deepEqual(office.getPets(), []);
  assert.deepEqual(office.getLayout().pets, []);
});
