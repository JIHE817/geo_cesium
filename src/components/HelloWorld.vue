<template>
  <div class="cesium-app">
    <!-- Cesium 地球视图容器（对应 PPT 8.3.1 第 6 步的第一个 Cesium 程序） -->
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 默认控件演示面板（对应 PPT 8.4 默认控件介绍） -->
    <aside class="control-panel">
      <h2>Cesium 默认控件</h2>
      <p class="hint">
        底图：天地图影像（img_w）＋中文注记（cia_w）。<br />
        取消勾选等价于在初始化 Viewer 时把该配置项设为 <code>false</code>，即隐藏该控件。
      </p>

      <ul class="control-list">
        <li v-for="item in controls" :key="item.key">
          <label>
            <input type="checkbox" v-model="item.visible" @change="applyVisibility" />
            <span class="control-name">{{ item.label }}</span>
            <span class="control-key">{{ item.key }}</span>
          </label>
          <p class="control-desc">{{ item.desc }}</p>
        </li>
      </ul>

      <pre class="code-block">{{ viewerOptionsCode }}</pre>

      <div class="actions">
        <button @click="toggleAll(true)">全部显示</button>
        <button @click="toggleAll(false)">全部隐藏</button>
        <button @click="resetCamera">回到默认视角</button>
      </div>
    </aside>
  </div>
</template>

<script>
import { onMounted, onBeforeUnmount, reactive, computed } from 'vue'
import * as Cesium from 'cesium'

// Cesium ion 默认令牌（PPT 8.3.1 第 5 步在官网申请）
const CESIUM_ION_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjNMRkVqMk1RY29DRTRKOXAiLCJqdGkiOiIxZGQyM2E3MC0wYzRiLTRhN2MtYTdmOC05MGMwOWM1YWYzM2MiLCJpZCI6NTI1NDIxLCJzdWIiOiJKSUhFODE3IiwiaXNzIjoiaHR0cHM6Ly9hcGkuY2VzaXVtLmNvbSIsImF1ZCI6Imdlb19jb3Vyc2UiLCJpYXQiOjE3OTIwMzE4ODZ9.KeaGGVMjTxhKErtsA9cn_V442EJ6NlE9vZdlzvdU5Rs'

// 天地图浏览器端 Key（用于替换默认底图）
const TIANDITU_KEY = '80c4a6021e3706a118950bbe2dff3c21'

/**
 * 创建天地图 WMTS 影像服务
 * layer = 'img'：影像底图；layer = 'cia'：中文注记层
 */
function createTiandituProvider(layer) {
  return new Cesium.WebMapTileServiceImageryProvider({
    url:
      `https://t{s}.tianditu.gov.cn/${layer}_w/wmts` +
      '?service=wmts&request=GetTile&version=1.0.0' +
      `&LAYER=${layer}&tileMatrixSet=w` +
      '&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}' +
      `&style=default&format=tiles&tk=${TIANDITU_KEY}`,
    layer: layer,
    style: 'default',
    format: 'tiles',
    tileMatrixSetID: 'w',
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
    maximumLevel: 18
  })
}

export default {
  name: 'CesiumViewer',
  setup() {
    let viewer = null

    // PPT 8.4 介绍的 8 个默认控件，key 与 Viewer 的配置项 / 实例属性同名
    const controls = reactive([
      { key: 'geocoder', label: 'Geocoder', visible: true, desc: '8.4.1 位置查找控件' },
      { key: 'homeButton', label: 'HomeButton', visible: true, desc: '8.4.2 首页位置工具' },
      { key: 'baseLayerPicker', label: 'BaseLayerPicker', visible: true, desc: '8.4.3 基础图层选择工具' },
      { key: 'animation', label: 'Animation', visible: true, desc: '8.4.4 动画播放速度控件' },
      { key: 'sceneModePicker', label: 'SceneModePicker', visible: true, desc: '8.4.5 二维 / 三维 / 哥伦布视图切换' },
      { key: 'navigationHelpButton', label: 'NavigationHelpButton', visible: true, desc: '8.4.6 地图操作帮助' },
      { key: 'fullscreenButton', label: 'FullscreenButton', visible: true, desc: '8.4.7 全屏按钮' },
      { key: 'timeline', label: 'TimeLine', visible: true, desc: '8.4.8 时间轴控件' }
    ])

    // 面板中展示与当前勾选状态等价的 Viewer 初始化代码
    const viewerOptionsCode = computed(() => {
      const lines = controls.map((item) => `  ${item.key}: ${item.visible},`)
      return `const viewer = new Cesium.Viewer('cesiumContainer', {\n  imageryProvider: createTiandituProvider('img'), // 天地图底图\n${lines.join('\n')}\n});`
    })

    function applyVisibility() {
      if (!viewer) return
      controls.forEach((item) => {
        const widget = viewer[item.key]
        if (widget && widget.container) {
          widget.container.style.display = item.visible ? '' : 'none'
        }
      })
    }

    function toggleAll(visible) {
      controls.forEach((item) => {
        item.visible = visible
      })
      applyVisibility()
    }

    function resetCamera() {
      if (!viewer) return
      viewer.camera.flyHome(0)
    }

    onMounted(() => {
      // 设置 ion 令牌后才能正常访问 Cesium 默认影像 / 地形服务
      Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN
      console.log('cesium loaded')

      viewer = new Cesium.Viewer('cesiumContainer', {
        // 用天地图影像替换 Cesium 默认底图（Bing 影像）
        imageryProvider: createTiandituProvider('img')
      })
      // 叠加天地图中文注记层（cia）
      viewer.imageryLayers.addImageryProvider(createTiandituProvider('cia'))
      console.log(viewer)

      applyVisibility()
    })

    onBeforeUnmount(() => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy()
      }
      viewer = null
    })

    return { controls, viewerOptionsCode, applyVisibility, toggleAll, resetCamera }
  }
}
</script>

<style scoped>
.cesium-app {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.cesium-container {
  width: 100% !important;
  height: 100% !important;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.control-panel {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 300px;
  max-height: calc(100% - 32px);
  overflow-y: auto;
  padding: 14px 16px;
  box-sizing: border-box;
  border-radius: 10px;
  background: rgba(18, 28, 42, 0.82);
  color: #e8f0fa;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  z-index: 10;
}

.control-panel h2 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.hint {
  margin: 0 0 10px;
  line-height: 1.5;
  color: #9fb4cc;
}

.hint code {
  color: #7fd1ff;
}

.control-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.control-list li {
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
}

.control-list label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.control-list input {
  margin-right: 8px;
  accent-color: #4da3ff;
}

.control-name {
  flex: 1;
  font-weight: 500;
}

.control-key {
  color: #7bb0e0;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11px;
}

.control-desc {
  margin: 4px 0 0 24px;
  color: #8fa6bf;
  font-size: 11px;
}

.code-block {
  margin: 12px 0 0;
  padding: 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.45);
  color: #9ef0c0;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.55;
  white-space: pre;
  overflow-x: auto;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.actions button {
  flex: 1;
  min-width: 80px;
  padding: 7px 8px;
  border: none;
  border-radius: 6px;
  background: #2f6fd0;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.actions button:hover {
  background: #3f83e8;
}
</style>
