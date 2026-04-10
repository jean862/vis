import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 🌟 核心 1：配置基础路径。如果你的 GitHub 仓库名叫 "ai-vis-project"
  // 这里必须写成 '/ai-vis-project/' (前后都要有斜杠)
  base: '/vis/', 
  
  // 🌟 核心 2：将打包文件夹从 dist 改为 docs，为了迎合 GitHub Pages
  build: {
    outDir: 'docs'
  },
  
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})