import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cesium from 'vite-plugin-cesium'

// Cesium 使用 Webpack 风格的资源引用，Vite 默认用 esbuild 打包，
// 因此需要 vite-plugin-cesium 插件来拷贝静态资源并设置 CESIUM_BASE_URL。
export default defineConfig({
  plugins: [vue(), cesium()],
  server: {
    host: '0.0.0.0',
    port: 8080
  }
})
