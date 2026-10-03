import { test, expect, type Page } from "@playwright/test";

async function resetStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function toggleDockCheckbox(page: Page, labelText: string) {
  const id = labelText.includes("弱网") ? "toggle-flaky" : "toggle-offline";
  const checkbox = page.locator(`[data-testid="${id}"]`);
  if (!(await checkbox.isVisible().catch(() => false))) {
    await page.locator('[data-testid="sync-dock"] .sync-pill').click();
    await checkbox.waitFor({ state: "visible", timeout: 5000 });
  }
  await checkbox.click({ force: true });
  // 等面板收起/状态切换生效，避免连点把面板重新合上
  await page.waitForTimeout(150);
}

async function openEditor(page: Page, seriesId: string) {
  await page.goto(`/work/${seriesId}`);
  await page.click('[data-testid="open-editor"]');
  await expect(page.locator("#edit-title")).toBeVisible();
}

async function saveBatch(page: Page, values: { title?: string; summary?: string }) {
  if (values.title !== undefined) await page.fill("#edit-title", values.title);
  if (values.summary !== undefined) await page.fill("#edit-summary", values.summary);
  await page.getByRole("button", { name: "保存到本地" }).click();
}

test.describe.configure({ mode: "serial" });

test.describe("离线编辑、逐条合并与冲突", () => {
  test.beforeEach(async ({ page }) => {
    await resetStorage(page);
  });

  test("离线修改先保留在本地，恢复后逐条自动合并；已提交值跨刷新保留", async ({ page }) => {
    await openEditor(page, "gaze");
    await toggleDockCheckbox(page, "模拟外拍断网");

    await saveBatch(page, { title: "凝视·外拍修订", summary: "断网期间写下的新说明文字。" });

    // 页面立即显示本地覆盖版本
    await expect(page.locator("h1").first()).toContainText("凝视·外拍修订");
    await expect(page.locator('[data-testid="sync-label"]')).toContainText("离线");
    const sessionAfterOffline = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("mira.overlay.v2") ?? "{}"),
    );
    expect(sessionAfterOffline.pending).toHaveLength(2);

    // 恢复网络 → 自动逐条同步
    await toggleDockCheckbox(page, "模拟外拍断网");
    await expect(page.locator('[data-testid="sync-label"]')).toHaveText("已同步", {
      timeout: 8000,
    });

    const sessionAfterSync = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("mira.overlay.v2") ?? "{}"),
    );
    expect(sessionAfterSync.pending).toHaveLength(0);

    // 刷新后仍生效（已提交覆盖值在共享存储中，原始照片文件从未改动）
    await page.reload();
    await expect(page.locator("h1").first()).toContainText("凝视·外拍修订");
    const server = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mira.server.v2") ?? "{}"),
    );
    expect(server.series.gaze.title).toBe("凝视·外拍修订");
    expect(server.series.gaze.summary).toBe("断网期间写下的新说明文字。");
  });

  test("两标签页改不同字段：未冲突字段自动合并，两边修改都保留", async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    await resetStorage(a);

    // A 改标题（在线，立即成功）
    await openEditor(a, "wilderness");
    await saveBatch(a, { title: "无人之境·A版标题" });
    await expect(a.locator('[data-testid="sync-label"]')).toHaveText("已同步", {
      timeout: 8000,
    });

    // B 只改说明，不动标题
    await openEditor(b, "wilderness");
    await saveBatch(b, { summary: "B 标签页补充的系列说明，不与标题冲突。" });
    await expect(b.locator('[data-testid="sync-label"]')).toHaveText("已同步", {
      timeout: 8000,
    });

    // A 刷新后同时看到两边的修改
    await a.goto("/work/wilderness");
    await expect(a.locator("h1").first()).toContainText("无人之境·A版标题");
    await expect(a.locator(".pull-quote")).toHaveText(
      "B 标签页补充的系列说明，不与标题冲突。",
    );
  });

  test("两标签页同改一个字段：留两份等待选择，选择后收敛", async ({ context }) => {
    const a = await context.newPage();
    await resetStorage(a);
    const b = await context.newPage();

    // 两个标签页先都打开同一系列（此刻远端基础值相同）
    await a.goto("/work/highland-pastoral");
    await b.goto("/work/highland-pastoral");

    // B 先进入外拍断网状态（冻结此刻的远端视图）
    await toggleDockCheckbox(b, "模拟外拍断网");

    // A 在线改标题并同步
    await a.click('[data-testid="open-editor"]');
    await saveBatch(a, { title: "高原牧歌（甲方版）" });
    await expect(a.locator('[data-testid="sync-label"]')).toHaveText("已同步", {
      timeout: 8000,
    });

    // B 在断网下改同一字段（它看不到 A 的提交）
    await b.click('[data-testid="open-editor"]');
    await expect(b.locator("#edit-title")).toBeVisible();
    await saveBatch(b, { title: "高原牧歌（摄影师版）" });
    await expect(b.locator("h1").first()).toContainText("高原牧歌（摄影师版）");

    // 恢复网络：逐条合并到该字段时发现两边都改过
    await toggleDockCheckbox(b, "模拟外拍断网");
    const conflict = b.locator('[data-testid="conflict-title"]');
    await expect(conflict).toBeVisible({ timeout: 8000 });
    await expect(conflict).toContainText("高原牧歌（甲方版）");
    await expect(conflict).toContainText("高原牧歌（摄影师版）");

    // B 选择保留自己的版本 → 以远端现值为新共同祖先重新提交，成功收敛
    await b.getByRole("button", { name: "保留我的版本" }).click();
    await expect(b.locator("h1").first()).toContainText("高原牧歌（摄影师版）");
    await expect(b.locator('[data-testid="sync-label"]')).toHaveText("已同步", {
      timeout: 8000,
    });
    await expect(conflict).toBeHidden();

    // A 侧随后看到最终值
    await a.goto("/work/highland-pastoral");
    await expect(a.locator("h1").first()).toContainText("高原牧歌（摄影师版）");
  });

  test("提交失败保留草稿可重试（模拟弱网）", async ({ page }) => {
    await openEditor(page, "gaze");
    await toggleDockCheckbox(page, "弱网");
    await saveBatch(page, { summary: "弱网下尝试提交的说明。" });

    await expect(page.locator('[data-testid="sync-label"]')).toContainText("提交失败", {
      timeout: 8000,
    });
    const persisted1 = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("mira.overlay.v2") ?? "{}"),
    );
    expect(persisted1.pending).toHaveLength(1);
    expect(persisted1.pending[0].attempts).toBeGreaterThan(0);
    expect(persisted1.pending[0].lastError).toBeTruthy();

    // 关掉弱网并重试 → 成功出队
    await toggleDockCheckbox(page, "弱网");
    await page.getByRole("button", { name: "重试失败草稿" }).click();
    await expect(page.locator('[data-testid="sync-label"]')).toHaveText("已同步", {
      timeout: 8000,
    });
    const persisted2 = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("mira.overlay.v2") ?? "{}"),
    );
    expect(persisted2.pending).toHaveLength(0);
  });

  test("v1 旧草稿升级后继续处理", async ({ page, context }) => {
    // 在应用首次加载前就放入 v1 草稿（模拟用户带着旧版本数据升级）
    await context.addInitScript(() => {
      const v1 = {
        version: 1,
        clientId: "legacy-client",
        committed: {},
        pending: [
          {
            id: "old-draft-1",
            series: "gaze",
            client: "legacy-client",
            created: Date.now() - 60000,
            title: "凝视（旧版草稿标题）",
            note: "旧便签里写的系列说明。",
          },
        ],
        conflicts: {},
      };
      localStorage.setItem("mira.overlay.v1", JSON.stringify(v1));
    });

    await page.goto("/work/gaze");
    // 升级后两个字段各成一条，自动同步，页面显示旧草稿内容
    await expect(page.locator("h1").first()).toContainText("凝视（旧版草稿标题）");
    await expect(page.locator(".pull-quote")).toHaveText("旧便签里写的系列说明。");
    await expect(page.locator('[data-testid="sync-label"]')).toHaveText("已同步", {
      timeout: 8000,
    });

    const legacyKey = await page.evaluate(() => localStorage.getItem("mira.overlay.v1"));
    expect(legacyKey).toBeNull();
  });

  test("改封面与照片顺序后，网格、系列页与已打开灯箱都按新数据展示", async ({ page }) => {
    await openEditor(page, "highland-pastoral");
    // 封面改为第二张
    await page.selectOption("#edit-cover", "pastoral-02");
    // 把最后一张移动到第一位
    const moveUp = page
      .locator(".order-item", { hasText: "新疆牧场" })
      .locator("button[aria-label^='上移']");
    while (await moveUp.isEnabled()) await moveUp.click();
    await page.getByRole("button", { name: "保存到本地" }).click();
    await expect(page.locator('[data-testid="sync-label"]')).toHaveText("已同步", {
      timeout: 8000,
    });

    // 系列页首屏封面变为坡地牛群
    await expect(page.locator(".series-hero img")).toHaveAttribute(
      "alt",
      /白棕色牛群在山坡/,
    );
    // 叙事第一幅变为新疆牧场
    await expect(page.locator(".narrative-row").first().locator("h3")).toHaveText(
      "新疆牧场",
    );

    // /work 牧野筛选下第一张也是新疆牧场，灯箱范围同步
    await page.goto("/work");
    await page.click('[data-filter="pastoral"]');
    await expect(page.locator(".photo-card").first().locator("img")).toHaveAttribute(
      "alt",
      /辽阔新疆草原/,
    );
    await page.locator(".photo-card").first().click();
    await expect(page.locator(".lb-info h3")).toHaveText("新疆牧场");
    await expect(page.locator('[data-testid="lb-counter"]')).toHaveText("1 / 4");
  });
});
