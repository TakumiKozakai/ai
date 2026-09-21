import { test, expect } from './evidence.js';

test('No1 タイトル未入力時は登録されない', async ({ page, step }) => {
  await step('Todo一覧を開く', async () => {
    await page.goto('/todos');
    await expect(page.getByRole('heading', { name: 'Todoアプリ', exact: true })).toBeVisible();
  });
  await step('タイトルを空欄にする', async () => {
    await page.getByPlaceholder('タイトルを入力', { exact: true }).fill('');
  });
  await step('追加ボタンを押し必須エラーを確認する', async () => {
    await page.getByRole('button', { name: '追加', exact: true }).click();
    await expect(page.getByText('タイトルは必須です', { exact: true })).toBeVisible();
  });
});
