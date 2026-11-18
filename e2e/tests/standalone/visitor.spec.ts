import path from 'node:path';

import { TILE_SIZE } from '../../../webview-ui/src/constants';
import { expect, test } from '../../fixtures/standalone';
import { clickTile } from '../../helpers/editor';
import { buildSeedLayout } from '../../helpers/layout-seed';
import { expectOverlayCount, expectOverlayVisible } from '../../helpers/office';
import { openLaunchDrawer } from '../../helpers/webview';

const CAST_INDEX = 3;
const VISITOR_NAME = 'Sable';
const DESK_SEAT = 'codex-chair';
const FREE_SEAT = 'visitor-chair';
const CAT_ID = 'office-gitcat';

const layout = {
  ...buildSeedLayout(),
  furniture: [
    { uid: 'codex-desk', type: 'DESK_FRONT', col: 5, row: 2 },
    { uid: 'codex-pc', type: 'PC_FRONT_OFF', col: 6, row: 2 },
    { uid: DESK_SEAT, type: 'CUSHIONED_CHAIR_BACK', col: 6, row: 4 },
    { uid: FREE_SEAT, type: 'CUSHIONED_CHAIR_FRONT', col: 3, row: 6 },
  ],
  pets: [{ id: CAT_ID, petType: 1 }],
};

test.describe('Standalone / Visit the office', () => {
  test.skip(process.platform === 'win32', 'The mock Codex executable uses a POSIX shebang');
  test.use({
    standaloneOptions: {
      mockCodex: true,
      seedLayout: layout,
      seedConfig: {
        standalone: { showHostDirectories: true, alwaysShowLabels: true },
        hooksEnabled: { claude: false },
      },
    },
  });
  test.beforeEach(async ({ page }) => {
    // Keep the cat's spawn on the open front floor so another sprite or label
    // cannot cover the intended click. The engine still owns all movement.
    await page.addInitScript(() => {
      Math.random = () => 0.95;
    });
  });

  test('a saved character can walk, sit, pet a cat and reach the running Codex terminal @area:standalone', async ({
    page,
    standalone,
  }) => {
    const frame = page.mainFrame();
    const visitor = () => page.evaluate(() => window.__pixelAgentsTestHooks?.getVisitor?.());
    const seats = () => page.evaluate(() => window.__pixelAgentsTestHooks?.getSeats?.());
    const pet = () =>
      page.evaluate(
        (id) => window.__pixelAgentsTestHooks?.getPets?.().find((p) => p.id === id),
        CAT_ID,
      );
    const sameRowYDistance = () =>
      page.evaluate(() => {
        const project = window.__pixelAgentsTestHooks?.getTileCenter;
        const left = project?.(4, 5);
        const right = project?.(5, 5);
        return left && right ? Math.abs(left.y - right.y) : null;
      });
    const terminal = page.locator('.xterm').first();
    const hideTerminal = page.getByTitle('Hide terminal');

    // Customize a profile from the existing cast through the real Characters editor.
    await page.getByRole('button', { name: 'Roster', exact: true }).click();
    const roster = page.getByTestId('character-picker');
    await roster
      .getByRole('button', { name: /^Launch as / })
      .nth(CAST_INDEX)
      .hover();
    await roster
      .getByRole('button', { name: /^Edit / })
      .nth(CAST_INDEX)
      .click();
    const characters = page.locator('.chv-panel');
    await characters.getByLabel(`Name for char_${CAST_INDEX}`).fill(VISITOR_NAME);
    await characters.getByRole('tab', { name: /Hat/ }).click();
    await characters.getByRole('button', { name: 'Plain cap', exact: true }).click();
    await characters.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(characters.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
    await characters.getByRole('button', { name: 'Close characters' }).click();

    const drawer = await openLaunchDrawer(page);
    await drawer.getByRole('button', { name: 'Codex', exact: true }).click();
    await drawer
      .getByRole('button', { name: path.basename(standalone.workspaceDir), exact: true })
      .click();
    await expect(terminal).toContainText('mock codex ready', { timeout: 15_000 });
    await terminal.click();
    await page.keyboard.type('hello from my desk');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('mock codex received: hello from my desk');
    await expectOverlayVisible(page, 'Reading file');
    await expect
      .poll(seats)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ uid: DESK_SEAT, assigned: true }),
          expect.objectContaining({ uid: FREE_SEAT, assigned: false }),
        ]),
      );
    await hideTerminal.click();
    await expect(terminal).toBeHidden();
    await expect.poll(sameRowYDistance).toBe(0);

    await page.getByRole('button', { name: 'Walk around', exact: true }).click();
    await page
      .getByRole('region', { name: 'Choose your character' })
      .getByRole('button', { name: VISITOR_NAME, exact: true })
      .click();
    await expect.poll(visitor).toMatchObject({ palette: CAST_INDEX, seatId: null });
    await expect.poll(sameRowYDistance).toBeGreaterThan(0);
    await expectOverlayCount(page, 1);

    await expect.poll(pet).toMatchObject({ name: 'Gitcat' });
    const [walkCol, walkRow] = [3, 8];
    await clickTile(frame, walkCol, walkRow);
    await expect.poll(visitor, { timeout: 8_000 }).toMatchObject({
      x: (walkCol + 0.5) * TILE_SIZE,
      y: (walkRow + 0.5) * TILE_SIZE,
      seatId: null,
    });

    await clickTile(frame, 3, 6);
    await expect.poll(visitor, { timeout: 8_000 }).toMatchObject({ seatId: FREE_SEAT });
    await expect
      .poll(seats)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ uid: DESK_SEAT, assigned: true }),
          expect.objectContaining({ uid: FREE_SEAT, assigned: false }),
        ]),
      );

    // A pet's world position anchors its feet. Project it first, then aim a few
    // screen pixels higher without changing the clicked ground position.
    const catPoint = await page.evaluate(
      ({ id, tileSize }) => {
        const hooks = window.__pixelAgentsTestHooks;
        const cat = hooks?.getPets?.().find((p) => p.id === id);
        const canvas = document.querySelector('[data-testid="office-canvas"]');
        if (!cat || !canvas) return null;
        const feet = hooks?.getTileCenter?.(cat.x / tileSize - 0.5, cat.y / tileSize - 0.5);
        if (!feet) return null;
        const box = canvas.getBoundingClientRect();
        return { x: box.left + feet.x, y: box.top + feet.y - 6 };
      },
      { id: CAT_ID, tileSize: TILE_SIZE },
    );
    if (!catPoint) throw new Error('The seeded cat has no canvas position');
    await page.mouse.click(catPoint.x, catPoint.y);
    await expect.poll(async () => (await pet())?.bubbleType, { timeout: 8_000 }).toBe('heart');

    // Click the PC on the Codex desk and use the existing terminal, with scrollback.
    await clickTile(frame, 6, 2);
    await expect(terminal).toBeVisible({ timeout: 8_000 });
    await expect(terminal).toContainText('mock codex received: hello from my desk');
    await terminal.click();
    await page.keyboard.type('visitor-terminal-input');
    await expect(terminal).toContainText('visitor-terminal-input');

    await page.getByRole('button', { name: 'Leave office', exact: true }).click();
    await expect.poll(visitor).toBeNull();
    await expect.poll(sameRowYDistance).toBe(0);
    await hideTerminal.click();
    await expect(terminal).toBeHidden();
    await page.getByTitle('Agent 1', { exact: true }).click();
    await expect(terminal).toBeVisible();
    await expect(terminal).toContainText('visitor-terminal-input');
    await hideTerminal.click();
    await expect(terminal).toBeHidden();
    await page.getByRole('button', { name: 'Layout', exact: true }).click();
    await page.getByRole('button', { name: 'Walls', exact: true }).click();
    await clickTile(frame, 1, 1);
    await expect(page.getByTitle('Save layout', { exact: true })).toBeEnabled();
  });
});
