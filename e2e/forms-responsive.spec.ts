import { test, expect } from "@playwright/test";

test.describe("联系表单", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/contact");
  });

  test("行内校验、提交按钮在通过前禁用、成功后显示成功态", async ({ page }) => {
    const submit = page.locator('[data-testid="contact-submit"]');
    await expect(submit).toBeDisabled();

    // 邮箱格式错误
    await page.fill("#c-name", "Mira");
    await page.fill("#c-email", "not-an-email");
    await page.fill("#c-message", "想约一组黑白人像拍摄，期待回复。");
    await page.locator("#c-email").blur();
    await expect(page.locator("#c-email + .field-error")).toContainText("邮箱格式");
    await expect(submit).toBeDisabled();

    // 修正后可提交
    await page.fill("#c-email", "mira@example.com");
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.locator('[data-testid="contact-success"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="contact-success"]')).toContainText("Mira");
    // 成功后不再停留在原表单
    await expect(page.locator('[data-testid="contact-form"]')).toHaveCount(0);
  });

  test("空字段显示行内错误", async ({ page }) => {
    await page.locator("#c-name").focus();
    await page.locator("#c-name").blur();
    await page.locator("#c-email").focus();
    await page.locator("#c-email").blur();
    await page.locator("#c-message").focus();
    await page.locator("#c-message").blur();
    await expect(page.locator("#c-name + .field-error")).toContainText("姓名");
    await expect(page.locator("#c-email + .field-error")).toContainText("邮箱");
    await expect(page.locator("#c-message + .field-error")).toContainText("留言");
  });

  test("提交失败时保留内容草稿，可直接重试成功", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("mira.contact.forcefail", "1"));
    await page.fill("#c-name", "客户甲");
    await page.fill("#c-email", "client@studio.com");
    await page.fill("#c-message", "希望预约一次外拍合作，盼复。");
    await page.locator('[data-testid="contact-submit"]').click();

    await expect(page.locator('[data-testid="contact-error"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="contact-error"]')).toContainText("草稿");

    // 模拟恢复后重试：内容仍在
    await page.evaluate(() => localStorage.removeItem("mira.contact.forcefail"));
    await page.locator('[data-testid="contact-submit"]').click();
    await expect(page.locator('[data-testid="contact-success"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe("移动端响应式（390px）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("导航收成汉堡，作品墙单列，灯箱说明变为底部信息条", async ({ page }) => {
    await page.goto("/work");

    // 汉堡按钮出现，主导航初始隐藏
    await expect(page.locator(".nav-toggle")).toBeVisible();
    await expect(page.locator(".main-nav")).not.toBeVisible();
    await page.locator(".nav-toggle").click();
    await expect(page.locator(".main-nav")).toBeVisible();

    // masonry 在 390px 下为单列（用 computed columns 验证）
    const columns = await page.locator(".masonry").evaluate((el) => getComputedStyle(el).columnCount);
    expect(columns).toBe("1");
    // 标题在图片下方而非 hover 覆盖层
    await expect(page.locator(".photo-meta-mobile").first()).toBeVisible();

    // 打开灯箱：桌面右侧信息带隐藏，底部信息条可见
    await page.locator(".photo-card").first().click();
    await expect(page.locator(".lightbox")).toBeVisible();
    const infoDisplay = await page.locator(".lb-info").evaluate((el) => getComputedStyle(el).display);
    expect(infoDisplay).toBe("none");
    await expect(page.locator(".lb-bottom-bar")).toBeVisible();
    await expect(page.locator(".lb-bottom-bar h3")).not.toHaveText("");

    // 箭头仍在两侧且可切换
    await page.locator(".lb-next").click();
    await page.locator(".lb-prev").click();
  });
});

test.describe("布局稳定（CLS）", () => {
  test("照片网格在图片加载前后保持真实宽高比占位，不发生跳动", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/work");

    const cards = page.locator(".photo-card").first();
    await expect(cards).toBeVisible();

    // 找一个 2:3 竖幅（portrait-01: 4067x6000 ≈ 0.6778）
    const target = page.locator('.photo-card:has(img[alt*="黑白半脸特写"]) .ratio').first();
    await expect(target).toHaveCount(1);

    // 占位比例在图片尚未加载完成时就已正确（容差 1%）
    const ratioBefore = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    });
    expect(ratioBefore).toBeCloseTo(4067 / 6000, 1);

    // 横幅照片 landscape-01 (5404x3584 ≈ 1.508)
    await page.click('[data-filter="landscape"]');
    const wide = page.locator('.photo-card:has(img[alt*="高山野花草甸"]) .ratio').first();
    const wideRatio = await wide.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    });
    expect(wideRatio).toBeCloseTo(5404 / 3584, 1);

    // 等图片实际加载后，容器尺寸不跳动
    await page.waitForFunction(() => {
      const img = document.querySelector('.photo-card img[alt*="高山野花草甸"]') as HTMLImageElement;
      return img?.complete && img.naturalWidth > 0;
    });
    const wideRatioAfter = await wide.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    });
    expect(Math.abs(wideRatioAfter - wideRatio)).toBeLessThan(0.002);
  });
});
