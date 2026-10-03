// 把 mock-data 中的只读素材同步到 public 目录供 Vite 静态服务。
// 原始照片资料永远存放在 mock-data/，覆盖层编辑只写 localStorage，不回写这里。
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');

const copies = [
  [resolve(root, 'mock-data/photos'), resolve(publicDir, 'photos')],
  [resolve(root, 'assets/fonts'), resolve(publicDir, 'fonts')],
];

for (const [from, to] of copies) {
  if (!existsSync(from)) continue;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`[sync-assets] ${from} -> ${to}`);
}
