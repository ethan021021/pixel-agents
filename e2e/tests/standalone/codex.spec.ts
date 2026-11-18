import path from 'node:path';

import { expect, test } from '../../fixtures/standalone';
import { expectOverlayCount, expectOverlayVisible } from '../../helpers/office';
import { openLaunchDrawer } from '../../helpers/webview';

test.describe('Standalone / Codex', () => {
  test.skip(process.platform === 'win32', 'The mock Codex executable uses a POSIX shebang');
  test.use({
    standaloneOptions: {
      mockCodex: true,
      seedConfig: {
        standalone: { showHostDirectories: true, alwaysShowLabels: true, bypassPermissions: true },
        hooksEnabled: { claude: false },
      },
    },
  });

  test('choosing Codex opens its terminal and tracks activity on the same character @area:standalone', async ({
    page,
    standalone,
  }) => {
    const drawer = await openLaunchDrawer(page);
    await expect(drawer.getByRole('button', { name: 'Claude Code', pressed: true })).toBeVisible();
    await drawer.getByRole('button', { name: 'Codex' }).click();
    await expect(drawer.getByRole('button', { name: 'Codex', pressed: true })).toBeVisible();
    await drawer
      .getByRole('button', { name: path.basename(standalone.workspaceDir), exact: true })
      .click();

    const terminal = page.locator('.xterm').first();
    await expect(terminal).toContainText('mock codex ready', { timeout: 15_000 });
    await terminal.click();
    await page.keyboard.type('hello codex');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('mock codex received: hello codex');
    await expectOverlayVisible(page, 'Reading file');
    await expectOverlayCount(page, 1);
  });
});
