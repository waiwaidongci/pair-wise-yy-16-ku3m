import { test, expect, type Page } from '@playwright/test';

/** 每个测试前清空本地覆盖层（仅首次导航执行，reload 时保留） */
async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('storage-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('storage-cleared', '1');
    }
  });
}

async function openSyncPanel(page: Page) {
  await page.locator('.sync-badge').click();
  await expect(page.locator('.sync-panel')).toBeVisible();
}

async function waitBadgeClear(page: Page) {
  await expect(page.locator('.sync-badge .dot')).toHaveCount(0, { timeout: 15000 });
}

// ---------- 1. 五页渲染与导航 ----------
test('五页正常渲染：首页英雄区、作品墙、系列页、关于、联系', async ({ page }) => {
  await clearStorage(page);
  await page.goto('/');
  await expect(page.locator('.hero-name')).toContainText('林屿');
  await expect(page.locator('.featured-card')).toHaveCount(3);

  await page.click('nav >> text=Work');
  await expect(page.locator('.masonry .photo-card')).toHaveCount(14);

  await page.goto('/work/gaze');
  await expect(page.locator('.series-hero h1')).toContainText('凝视');
  await expect(page.locator('.series-block')).toHaveCount(5);

  await page.click('nav >> text=About');
  await expect(page.locator('.timeline li')).toHaveCount(4);

  await page.click('nav >> text=Contact');
  await expect(page.locator('#name')).toBeVisible();
});

// ---------- 2. 筛选状态跨导航保持 ----------
test('作品筛选状态在导航后保持', async ({ page }) => {
  await clearStorage(page);
  await page.goto('/work');
  await page.click('.filter-pill:has-text("牧野")');
  await expect(page.locator('.filter-pill.active')).toContainText('牧野');
  await expect(page.locator('.masonry .photo-card')).toHaveCount(4);

  await page.click('nav >> text=Home');
  await page.click('nav >> text=Work');
  await expect(page.locator('.filter-pill.active')).toContainText('牧野');
  await expect(page.locator('.masonry .photo-card')).toHaveCount(4);
});

// ---------- 3. 灯箱导航限定在当前筛选范围 ----------
test('灯箱左右切换只在当前筛选（牧野）范围内循环', async ({ page }) => {
  await clearStorage(page);
  await page.goto('/work');
  await page.click('.filter-pill:has-text("牧野")');
  await page.locator('.masonry .photo-card').first().click();

  await expect(page.locator('.lightbox-backdrop')).toBeVisible();
  const info = page.locator('.lightbox-info');
  await expect(info.locator('.cat')).toContainText('牧野');
  await expect(info.locator('.count')).toHaveText('1 / 4');
  await expect(info.locator('h3')).toContainText('独牛与木屋');

  await page.locator('.lb-arrow.next').click();
  await expect(info.locator('.count')).toHaveText('2 / 4');
  await expect(info.locator('h3')).toContainText('坡地牛群');

  await page.locator('.lb-arrow.next').click();
  await expect(info.locator('.count')).toHaveText('3 / 4');
  await page.locator('.lb-arrow.next').click();
  await expect(info.locator('.count')).toHaveText('4 / 4');
  await page.locator('.lb-arrow.next').click();
  await expect(info.locator('.count')).toHaveText('1 / 4'); // 循环回到第一张

  await page.locator('.lb-arrow.prev').click();
  await expect(info.locator('.count')).toHaveText('4 / 4'); // 反向循环到最后一张

  await page.locator('.lb-close').click();
  await expect(page.locator('.lightbox-backdrop')).toBeHidden();
});

// ---------- 4. 比例占位：图片加载前布局不抖动 ----------
test('图片按真实宽高比预留占位，无 CLS', async ({ page }) => {
  await clearStorage(page);
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { hadRecentInput: boolean; value: number }[]) {
        if (!entry.hadRecentInput) {
          (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  // 延迟图片请求，强制占位阶段出现
  await page.route('**/photos/**', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });

  await page.goto('/work');
  // 图片尚未加载时，占位已有高度
  const firstFrame = page.locator('.photo-frame').first();
  await expect(firstFrame).toBeVisible();
  const ar = await firstFrame.evaluate((el) => getComputedStyle(el).aspectRatio);
  expect(ar).not.toBe('auto');
  const h1 = await firstFrame.evaluate((el) => el.getBoundingClientRect().height);
  expect(h1).toBeGreaterThan(50);

  // 图片加载完成后检查 CLS
  await expect(page.locator('.photo-frame img').first()).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(500);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThan(0.05);

  // img 带真实 width/height 属性
  const wh = await page.locator('.photo-frame img').first().evaluate((el) => ({
    w: el.getAttribute('width'),
    h: el.getAttribute('height'),
  }));
  expect(Number(wh.w)).toBeGreaterThan(0);
  expect(Number(wh.h)).toBeGreaterThan(0);
});

// ---------- 5. 移动端响应式切换 ----------
test('移动端：单列照片墙、汉堡菜单、灯箱底部信息条', async ({ page }) => {
  await clearStorage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/work');

  const columns = await page.locator('.masonry').evaluate((el) => getComputedStyle(el).columnCount);
  expect(columns).toBe('1');

  await expect(page.locator('.nav-toggle')).toBeVisible();
  await page.locator('.nav-toggle').click();
  await expect(page.locator('.nav-links.open')).toBeVisible();

  await page.locator('.masonry .photo-card').first().click();
  await expect(page.locator('.lightbox-backdrop')).toBeVisible();
  await expect(page.locator('.lb-mobile-info')).toBeVisible();
  await expect(page.locator('.lightbox-info')).toBeHidden();
});

// ---------- 6. 离线字体：无外部字体请求 ----------
test('无任何外部字体请求，字体本地加载', async ({ page }) => {
  await clearStorage(page);
  const external: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('fonts.googleapis') || url.includes('fonts.gstatic')) {
      external.push(url);
    }
  });

  for (const route of ['/', '/work', '/work/gaze', '/about', '/contact']) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
  }
  expect(external).toEqual([]);

  await page.goto('/work');
  const fontsReady = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      playfair: document.fonts.check('600 16px "Playfair Display"'),
      inter: document.fonts.check('16px Inter'),
    };
  });
  expect(fontsReady.playfair).toBe(true);
  expect(fontsReady.inter).toBe(true);
});

// ---------- 7. 表单校验与成功反馈 ----------
test('联系表单：行内校验、未通过禁用提交、成功反馈', async ({ page }) => {
  await clearStorage(page);
  await page.goto('/contact');

  await page.locator('#name').fill('a');
  await page.locator('#email').fill('bad-email');
  await page.locator('#message').fill('short');
  await page.locator('#name').blur();
  await page.locator('#email').blur();
  await page.locator('#message').blur();

  await expect(page.locator('.field .field-error')).toHaveCount(3);
  await expect(page.locator('button[type="submit"]')).toBeDisabled();

  await page.locator('#name').fill('林屿');
  await page.locator('#email').fill('linyu@example.com');
  await page.locator('#message').fill('您好，想约一组人像拍摄。');
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.locator('button[type="submit"]').click();

  await expect(page.locator('.form-success')).toBeVisible();
  await expect(page.locator('.form-success')).toContainText('消息已发送');
});

// ---------- 8. 离线修改留本地，恢复后逐条合并 ----------
test('断网修改先留草稿，恢复联网后自动合并', async ({ page }) => {
  await clearStorage(page);
  await page.goto('/work/gaze');
  await page.locator('button:has-text("编辑系列")').click();

  // 在线时先改一次
  await page.locator('.summary-editor').fill('在线修改的说明内容');
  await page.locator('button:has-text("保存说明")').click();
  await waitBadgeClear(page);
  await expect(page.locator('.series-summary')).toContainText('在线修改的说明内容');

  // 切换到模拟离线
  await openSyncPanel(page);
  await page.locator('.offline-toggle').first().locator('.slider').click();
  await page.locator('.sync-panel-backdrop').click();

  // 断网再改（编辑模式仍开着）
  await page.locator('.summary-editor').fill('断网时写下的说明');
  await page.locator('button:has-text("保存说明")').click();
  await expect(page.locator('.sync-badge .dot')).toHaveText('1');
  await page.waitForTimeout(1200);
  await expect(page.locator('.sync-badge .dot')).toHaveText('1'); // 仍然挂着

  // 恢复联网 → 自动合并
  await openSyncPanel(page);
  await page.locator('.offline-toggle').first().locator('.slider').click();
  await page.locator('.sync-panel-backdrop').click();
  await waitBadgeClear(page);
  await expect(page.locator('.series-summary')).toContainText('断网时写下的说明');

  // 刷新后仍然有效（持久化在本地覆盖层）
  await page.reload();
  await expect(page.locator('.series-summary')).toContainText('断网时写下的说明');
});

// ---------- 9. 提交失败保留草稿可重试 ----------
test('提交失败保留草稿，重试后成功', async ({ page }) => {
  await clearStorage(page);
  await page.goto('/work/gaze');

  await openSyncPanel(page);
  await page.locator('.offline-toggle').nth(1).locator('.slider').click(); // 模拟提交失败
  await page.locator('.sync-panel-backdrop').click();

  await page.locator('button:has-text("编辑系列")').click();
  await page.locator('.summary-editor').fill('会失败的修改');
  await page.locator('button:has-text("保存说明")').click();

  await openSyncPanel(page);
  await expect(page.locator('.sync-section:has(h4:has-text("提交失败")) .sync-item')).toHaveCount(1, {
    timeout: 10000,
  });
  await expect(page.locator('.sync-badge .dot.fail')).toBeVisible();

  // 关闭失败开关并重试
  await page.locator('.offline-toggle').nth(1).locator('.slider').click();
  await page.locator('.sync-section:has(h4:has-text("提交失败")) button:has-text("重试")').click();
  await waitBadgeClear(page);
  await expect(page.locator('.series-summary')).toContainText('会失败的修改');
});

// ---------- 10. 多标签页：未冲突字段合并，同字段冲突留两份 ----------
test('两个标签页同时编辑：不同字段自动合并，同字段冲突等待选择', async ({
  browser,
}: {
  browser: import('@playwright/test').Browser;
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  await pageA.goto('/work/gaze');
  await pageB.goto('/work/gaze');

  // 两个标签页都进入编辑
  await pageA.locator('button:has-text("编辑系列")').click();
  await pageB.locator('button:has-text("编辑系列")').click();

  // 断网，让两份草稿都挂起
  await context.setOffline(true);
  await pageA.waitForTimeout(300);

  // A 改说明，B 改封面（不同字段）
  await pageA.locator('.summary-editor').fill('A 标签页写的说明');
  await pageA.locator('button:has-text("保存说明")').click();

  await pageB.locator('.order-row').nth(1).locator('.cover-btn').click();

  await pageA.waitForTimeout(300);
  await context.setOffline(false);

  // 等待两边都合并完成
  await expect(pageA.locator('.sync-badge .dot')).toHaveCount(0, { timeout: 15000 });
  await expect(pageB.locator('.sync-badge .dot')).toHaveCount(0, { timeout: 15000 });

  // 未冲突字段：说明与封面都生效
  await expect(pageA.locator('.series-summary')).toContainText('A 标签页写的说明');
  const heroSrc = await pageA.locator('.series-hero img').first().getAttribute('src');
  expect(heroSrc).toContain('portrait-02');
});

test('两个标签页改同一字段：冲突留两份，选择后合并', async ({
  browser,
}: {
  browser: import('@playwright/test').Browser;
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  await pageA.goto('/work/gaze');
  await pageB.goto('/work/gaze');
  await pageA.locator('button:has-text("编辑系列")').click();
  await pageB.locator('button:has-text("编辑系列")').click();

  await context.setOffline(true);
  await pageA.waitForTimeout(300);

  await pageA.locator('.summary-editor').fill('A 的版本');
  await pageA.locator('button:has-text("保存说明")').click();
  await pageB.locator('.summary-editor').fill('B 的版本');
  await pageB.locator('button:has-text("保存说明")').click();

  await pageA.waitForTimeout(300);
  await context.setOffline(false);

  // 冲突出现
  await expect(pageB.locator('.sync-badge .dot.conflict')).toBeVisible({ timeout: 15000 });
  await openSyncPanel(pageB);
  const conflictItem = pageB.locator('.sync-section:has(h4:has-text("字段冲突")) .sync-item');
  await expect(conflictItem).toHaveCount(1);
  await expect(conflictItem.locator('.conflict-option.local')).toContainText(/A 的版本|B 的版本/);
  await expect(conflictItem.locator('.conflict-option.remote')).toContainText(/A 的版本|B 的版本/);

  // 选择"采用对方"
  await conflictItem.locator('.conflict-option.remote').click();
  await expect(pageB.locator('.series-summary')).toContainText(/A 的版本|B 的版本/);
  // 另一个标签页同步更新
  await expect(pageA.locator('.series-summary')).toContainText(/A 的版本|B 的版本/, { timeout: 10000 });
});

// ---------- 11. 旧草稿升级后继续处理 ----------
test('旧版本草稿升级后继续提交', async ({ page }) => {
  await page.addInitScript(() => {
    const legacy = [
      {
        id: 'legacy-001',
        seriesId: 'gaze',
        summary: '旧草稿里的说明文字',
        ts: Date.now(),
        status: 'pending',
      },
    ];
    localStorage.setItem('portfolio-drafts-v0', JSON.stringify(legacy));
  });
  await page.goto('/work/gaze');
  await expect(page.locator('.sync-badge .dot')).toHaveText('1');
  await waitBadgeClear(page);
  await expect(page.locator('.series-summary')).toContainText('旧草稿里的说明文字');
});

// ---------- 12. 灯箱范围按新数据重算：旧索引不带偏 ----------
test('系列顺序变化后，已打开灯箱仍按照片 id 定位', async ({
  browser,
}: {
  browser: import('@playwright/test').Browser;
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  const pageA = await context.newPage();
  const pageB = await context.newPage();

  await pageA.goto('/work/gaze');
  await pageB.goto('/work/gaze');

  // A 打开灯箱，停在第 3 张（屏息）
  await pageA.locator('.series-block').nth(2).locator('.shot').click();
  await expect(pageA.locator('.lightbox-info h3')).toContainText('屏息');

  // B 把第 3 张两次前移到第 1 位
  await pageB.locator('button:has-text("编辑系列")').click();
  const row3 = pageB.locator('.order-row', { hasText: '屏息' });
  await row3.locator('.move-btn').first().click(); // ↑
  await pageB.waitForTimeout(900);
  await row3.locator('.move-btn').first().click();
  await pageB.waitForTimeout(900);

  // A 的灯箱仍显示同一张照片（id 定位，而非位置索引）
  await pageA.waitForTimeout(500);
  await expect(pageA.locator('.lightbox-backdrop')).toBeVisible();
  await expect(pageA.locator('.lightbox-info h3')).toContainText('屏息');
});
