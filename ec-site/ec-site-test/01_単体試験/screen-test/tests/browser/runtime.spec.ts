import { readFile } from 'node:fs/promises';
import { test, expect } from '../../specs/evidence.ts';

test('環境確認: 入力・クリック・操作ごとのPNG保存', async ({ page, step }, testInfo) => {
  await step('検証用HTMLを表示', async () => {
    await page.setContent(`<!doctype html><html lang="ja"><meta charset="utf-8">
      <title>試験ツール環境確認</title>
      <h1>試験ツール環境確認</h1><label>タイトル<input id="title"></label>
      <button onclick="document.querySelector('#result').textContent=document.querySelector('#title').value">確認</button>
      <p id="result" role="status"></p></html>`);
    await expect(page.getByRole('heading')).toHaveText('試験ツール環境確認');
  });
  await step('タイトルを入力', async () => {
    await page.getByRole('textbox', { name: 'タイトル' }).fill('スクリーンショット動作確認');
  });
  await step('確認ボタンをクリック', async () => {
    await page.getByRole('button', { name: '確認', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('スクリーンショット動作確認');
  });
  expect(testInfo.attachments.filter(a => a.contentType === 'image/png')).toHaveLength(3);
  for (const name of ['step-01.png', 'step-02.png', 'step-03.png']) {
    const bytes = await readFile(testInfo.outputPath(name));
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }
});

test('環境確認: 操作失敗時にもPNGを保存', async ({ page, step }, testInfo) => {
  await page.setContent('<h1>失敗時の証跡確認</h1>');
  await expect(step('意図した操作エラー', async () => {
    throw new Error('intentional smoke error');
  })).rejects.toThrow('intentional smoke error');
  const bytes = await readFile(testInfo.outputPath('step-01.png'));
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(testInfo.attachments.filter(a => a.contentType === 'image/png')).toHaveLength(1);
});
