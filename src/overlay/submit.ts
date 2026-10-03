/** 模拟后端提交：真实环境替换为 fetch/API 调用 */

const FORCE_FAIL_KEY = 'portfolio-force-fail';

export function isForceFailEnabled(): boolean {
  try {
    return localStorage.getItem(FORCE_FAIL_KEY) === '1';
  } catch {
    return false;
  }
}

export function setForceFail(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(FORCE_FAIL_KEY, '1');
    else localStorage.removeItem(FORCE_FAIL_KEY);
  } catch {
    /* ignore */
  }
}

export function simulateSubmit(signal?: { cancelled: boolean }): Promise<void> {
  return new Promise((resolve, reject) => {
    const latency = 400 + Math.random() * 400;
    window.setTimeout(() => {
      if (signal?.cancelled) return;
      if (isForceFailEnabled()) {
        reject(new Error('提交失败：网络请求被中断（模拟）'));
        return;
      }
      resolve();
    }, latency);
  });
}
