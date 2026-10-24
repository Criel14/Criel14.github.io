import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const iconSpritePath = entry('./src/shared/icons/sprite.svg');
const iconSpritePlaceholder = '<!-- icon-sprite -->';

/**
 * 把共享 SVG sprite 内联到 HTML 的占位符位置。
 *
 * 图标集中维护在 src/shared/icons/sprite.svg，页面通过
 * <use href="#icon-..."> 引用。开发与构建都直接内联，生产环境
 * 不产生额外请求，也不依赖运行时 JS 或第三方 CDN。
 */
function iconSpritePlugin(): Plugin {
  let sprite = '';

  function reloadSprite(): void {
    sprite = readFileSync(iconSpritePath, 'utf8').trim();
  }

  return {
    name: 'criel-icon-sprite',
    configResolved() {
      reloadSprite();
    },
    transformIndexHtml(html) {
      if (!html.includes(iconSpritePlaceholder)) {
        return html;
      }
      return html.replace(iconSpritePlaceholder, () => sprite);
    },
    configureServer(server) {
      server.watcher.add(iconSpritePath);
      server.watcher.on('change', (file) => {
        if (resolve(file) !== resolve(iconSpritePath)) {
          return;
        }
        reloadSprite();
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  plugins: [iconSpritePlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        home: entry('./index.html'),
        puzzle: entry('./puzzle-game/puzzle.html'),
        puzzleScores: entry('./puzzle-game/score-list.html'),
        puzzleReplay: entry('./puzzle-game/replay.html'),
        snake: entry('./snake-game/snake.html'),
      },
    },
  },
});
