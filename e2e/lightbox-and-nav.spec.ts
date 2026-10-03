import { test, expect, type Page } from "@playwright/test";

async function gotoWait(page: Page) {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
}

test.describe("站点基础与离线字体", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("五页全部可打开且使用真实数据", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /凝视|无人之境|高原牧歌/ }).first()).toBeVisible();
    // 首页三张系列卡片
    await expect(page.locator(".feature-card")).toHaveCount(3);
    await expect(page.getByRole("link", { name: /凝视/ })).toBeVisible();

    await page.goto("/work");
    await expect(page.locator(".photo-card")).toHaveCount(14);

    await page.goto("/work/gaze");
    await expect(page.getByRole("heading", { name: "《凝视》" })).toBeVisible();
    await expect(page.locator(".narrative-row")).toHaveCount(5);

    await page.goto("/about");
    await expect(page.locator(".timeline li")).toHaveCount(4);

    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: "联系我" })).toBeVisible();
  });

  test("不发起任何 Google 字体 CDN 请求，本地 woff2 加载成功", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (req) => {
      const u = req.url();
      if (u.includes("fonts.googleapis.com") || u.includes("fonts.gstatic.com")) {
        external.push(u);
      }
    });
    const fontRequests: Array<{ url: string; status: number }> = [];
    page.on("response", (res) => {
      if (res.url().endsWith(".woff2")) {
        fontRequests.push({ url: res.url(), status: res.status() });
      }
    });

    await page.goto("/");
    await page.waitForTimeout(1500);
    await page.goto("/work");
    await page.waitForTimeout(1500);

    expect(external, `发现外部字体请求: ${external.join(", ")}`).toEqual([]);
    expect(fontRequests.length).toBeGreaterThanOrEqual(1);
    for (const f of fontRequests) {
      expect(f.status, `${f.url} 状态异常`).toBe(200);
      expect(f.url).toMatch(/^http:\/\/localhost:5173\/fonts\//);
    }
  });
});

test.describe("筛选保持与灯箱范围", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("筛选条件在进入系列页再返回后保持", async ({ page }) => {
    await page.goto("/work");
    await page.click('[data-filter="pastoral"]');
    await expect(page.locator('[data-testid="result-count"]')).toContainText("4 张");

    // 从详情返回
    await page.goto("/work/highland-pastoral");
    await page.getByText("返回作品页（筛选保持）").click();
    await expect(page).toHaveURL(/\/work$/);
    await expect(page.locator('[data-filter="pastoral"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="result-count"]')).toContainText("4 张");
  });

  test("灯箱导航限定在当前筛选范围内（牧野 4 张循环）", async ({ page }) => {
    await page.goto("/work");
    await page.click('[data-filter="pastoral"]');
    await page.locator(".photo-card").first().click();

    const dialog = page.locator(".lightbox");
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-testid="lb-counter"]')).toHaveText("1 / 4");

    const titles: string[] = [];
    for (let i = 0; i < 4; i++) {
      titles.push((await dialog.locator(".lb-info h3").textContent()) ?? "");
      await page.keyboard.press("ArrowRight");
      await expect(page.locator('[data-testid="lb-counter"]')).toHaveText(
        `${(i + 1) % 4 + 1} / 4`,
      );
    }
    // 第四下回到第一张：循环且只包含 4 张牧野照片
    await expect(page.locator('[data-testid="lb-counter"]')).toHaveText("1 / 4");
    expect(titles).toEqual(["独牛与木屋", "坡地牛群", "雪山下的歇息", "新疆牧场"]);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("灯箱打开期间切换筛选，按新数据重算范围且旧索引不平移到别的照片", async ({ page }) => {
    await page.goto("/work");
    // 全部 14 张，打开第 2 张（portrait-02 遮蔽）
    await page.locator(".photo-card").nth(1).click();
    await expect(page.locator('[data-testid="lb-counter"]')).toHaveText("2 / 14");

    // 关闭灯箱，改筛选为风光，重新打开第一张
    await page.keyboard.press("Escape");
    await page.click('[data-filter="landscape"]');
    await expect(page.locator('[data-testid="result-count"]')).toContainText("5 张");
    await page.locator(".photo-card").first().click();
    await expect(page.locator('[data-testid="lb-counter"]')).toHaveText("1 / 5");
    await expect(page.locator(".lb-info h3")).toHaveText("野花坡");
  });

  test("灯箱打开时另一端数据变化：按 id 重新定位，不沿用到错误照片", async ({ page, context }) => {
    await page.goto("/work");
    await page.click('[data-filter="portrait"]');
    await page.locator(".photo-card").first().click();
    const firstTitle = await page.locator(".lb-info h3").textContent();
    expect(firstTitle).toBe("低垂");

    // 用另一个标签页把凝视系列的“低垂”移到序列末尾（模拟另一端数据更新）
    const tab2 = await context.newPage();
    await tab2.goto("/work/gaze");
    await tab2.click('[data-testid="open-editor"]');
    const moveDown = tab2
      .locator(".order-item", { hasText: "低垂" })
      .locator("button[aria-label^='下移']");
    while (await moveDown.isEnabled()) await moveDown.click();
    await tab2.getByRole("button", { name: "保存到本地" }).click();

    // 原标签页灯箱仍停在“低垂”（按 id 定位，没有因重排跳到别的照片）
    await expect(page.locator(".lb-info h3")).toHaveText("低垂");
    // 低垂现在在新顺序末尾：下一张在 5 张范围内循环到新首张“遮蔽”
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".lb-info h3")).toHaveText("遮蔽");
    await expect(page.locator('[data-testid="lb-counter"]')).toHaveText("1 / 5");
    await tab2.close();
  });
});
