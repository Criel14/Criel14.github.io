import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
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
