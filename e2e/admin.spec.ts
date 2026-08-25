import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_OWNER_EMAIL ?? 'owner@example.com';
const password = process.env.E2E_OWNER_PASSWORD ?? 'demo-owner-password-123';

async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
}

test.describe('admin product delivery', () => {
  test('logs in and exposes Stage 8 operational surfaces', async ({ page }) => {
    await signIn(page);

    for (const item of [
      ['系统设置', '系统设置'],
      ['后台任务', '任务与 Outbox'],
      ['媒体存储', '媒体与对象存储'],
      ['支付管理', '支付与退款'],
      ['审计日志', '审计日志'],
    ]) {
      await page.getByRole('link', { name: item[0] }).click();
      await expect(page.getByRole('heading', { name: item[1] })).toBeVisible();
    }
  });

  test('creates and completes a Mock payment through the UI', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: '支付管理' }).click();
    await expect(page.getByRole('heading', { name: '支付与退款' })).toBeVisible();

    const orderId = `e2e-${Date.now()}`;
    await page.getByLabel('商户订单号').fill(orderId);
    await page.getByLabel('支付标题').fill('浏览器验收支付');
    await page.getByLabel('描述').fill('Stage 8 Playwright payment flow');
    await page.getByLabel('金额（分）').fill('19900');
    await page.getByRole('button', { name: '创建支付意图' }).click();

    await expect(page.getByText(new RegExp(`当前选择：${orderId}.*pending`))).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: orderId });
    await row.getByRole('button', { name: '模拟成功' }).click();
    await expect(page.getByText(new RegExp(`当前选择：${orderId}.*succeeded`))).toBeVisible();
    await expect(row).toContainText('succeeded');
  });
});
