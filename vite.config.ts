import { defineConfig, type Plugin, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import type { ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";

/**
 * The photographer's source material (photos) and the purchased fonts live
 * outside the Vite root (mock-data/ and assets/). They must never be moved or
 * modified, so we serve them in place during dev and copy them read-only into
 * dist/ at build time. Nothing in the app ever writes to those directories.
 */
const localAssets: Plugin = {
  name: "local-readonly-assets-serve",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
      const url = decodeURIComponent((req.url ?? "").split("?")[0]);
      const root = process.cwd();
      const mounts: Array<[string, string]> = [
        ["/photos/", path.join(root, "mock-data/photos/")],
        ["/fonts/", path.join(root, "assets/fonts/")],
      ];
      for (const [prefix, dir] of mounts) {
        if (url.startsWith(prefix)) {
          const filePath = path.join(dir, url.slice(prefix.length));
          if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            return next();
          }
          res.setHeader("Cache-Control", "no-cache");
          const stream = fs.createReadStream(filePath);
          stream.on("error", next);
          stream.pipe(res);
          return;
        }
      }
      next();
    });
  },
};

/** Copy read-only source material into dist/ at build time (never in place). */
const copyLocalAssets: Plugin = {
  name: "local-readonly-assets-build",
  apply: "build",
  closeBundle() {
    const root = process.cwd();
    const copies: Array<[string, string]> = [
      ["mock-data/photos", "dist/photos"],
      ["assets/fonts", "dist/fonts"],
    ];
    for (const [from, to] of copies) {
      fs.cpSync(path.join(root, from), path.join(root, to), { recursive: true });
    }
  },
};

export default defineConfig({
  plugins: [react(), localAssets, copyLocalAssets],
  server: { port: 5173 },
});
