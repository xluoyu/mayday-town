import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        town: 'index.html',
        scenes: 'design/scenes.html',
        character: 'design/character-preview.html',
      },
    },
  },
});
