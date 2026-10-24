/**
 * 设置页入口（P8-4b）。
 *
 * 只负责启动和错误兜底；导航、表单与保存条在 ui/settings-page.ts。
 */

import { mountSettingsPage } from '../ui/settings-page';

function showInitError(): void {
  const banner = document.querySelector<HTMLElement>('[data-load-banner]');
  if (banner === null) {
    return;
  }
  banner.hidden = false;
  banner.textContent = '页面初始化失败，请刷新后重试。';
}

try {
  mountSettingsPage();
} catch (error) {
  console.error('设置页初始化失败', error);
  showInitError();
}
