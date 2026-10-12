import { test, expect } from './evidence.ts';

test('No1 キーワードで試験用商品を検索できる', async ({ page, step }) => {
  await step('手順1 商品一覧を開く', async () => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: '商品一覧', exact: true })).toBeVisible();
  });
  await step('手順2 キーワードに「PW_サンプル商品」を入力する', async () => {
    await page.getByRole('textbox', { name: 'キーワード', exact: true }).fill('PW_サンプル商品');
  });
  await step('手順3 検索ボタンを押し検索結果を確認する', async () => {
    await page.getByRole('button', { name: '検索', exact: true }).click();
    await expect(page.getByText('1件の商品が見つかりました', { exact: true })).toBeVisible();
    const card = page.getByRole('listitem').filter({ hasText: 'PW_サンプル商品 検索確認用' });
    await expect(card.getByRole('link', { name: 'PW_サンプル商品 検索確認用', exact: true })).toBeVisible();
    await expect(card.getByText('¥1,234', { exact: true })).toBeVisible();
  });
});
