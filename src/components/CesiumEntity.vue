<template>
  <div class="entity-app">
    <!-- 关卡 1：Cesium 三维地球容器 -->
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 关卡 4：右侧信息栏（显示拾取到的要素名称、经纬度、description） -->
    <aside class="info-panel">
      <h2>要素信息</h2>
      <template v-if="selected">
        <p class="info-title">{{ selected.name }}</p>
        <p class="info-coord">
          经度：{{ formatDegree(selected.lon) }}<br />
          纬度：{{ formatDegree(selected.lat) }}
        </p>
        <div class="info-desc" v-html="selected.description"></div>
      </template>
      <p v-else class="info-empty">
        点击地图上的地标查看信息<br />
        点击空白处清空
      </p>
    </aside>

    <!-- 挑战加分（2）：按类型过滤地标的两个切换按钮（内部用 entity.show 控制显隐） -->
    <div class="filter-panel">
      <span class="filter-label">按类型过滤</span>
      <button
        class="filter-btn"
        :class="{ active: filterType === '教学' }"
        @click="applyFilter('教学')"
      >
        只看教学类
      </button>
      <button
        class="filter-btn"
        :class="{ active: filterType === '全部' }"
        @click="applyFilter('全部')"
      >
        显示全部
      </button>
    </div>
  </div>
</template>

<script>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as Cesium from 'cesium'

// ===========================================================================
// 底图：天地图（任务单注明“底图用天地图需自行申请浏览器端 Key”）
// 只替换底图，其余绘制逻辑与底图无关
// ===========================================================================
const TIANDITU_KEY = '80c4a6021e3706a118950bbe2dff3c21'

/** layer = 'img' 影像底图；layer = 'cia' 中文注记层 */
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

// ===========================================================================
// 关卡 2 数据：任务单“坐标记录表”的 5 个校园地标
// 注意 Cartesian3.fromDegrees 的参数顺序是“经度、纬度、高度”，与“经纬度”读法相反
// ===========================================================================
const LANDMARKS = [
  { name: '校门口', type: '生活', level: '重要', lon: 103.987436, lat: 30.582000, note: '学校主入口，位于校区南侧，人流集散地。' },
  { name: '食堂', type: '生活', level: '一般', lon: 103.982400, lat: 30.584357, note: '学生食堂，提供早、中、晚餐。' },
  { name: '第二田径场', type: '运动', level: '一般', lon: 103.985082, lat: 30.585919, note: '标准 400 米塑胶跑道，体育课与运动会场地。' },
  { name: '第六教学楼', type: '教学', level: '重要', lon: 103.987664, lat: 30.583419, note: '主教学楼，含多媒体教室与实验室。' },
  { name: '宿舍', type: '生活', level: '一般', lon: 103.982248, lat: 30.585405, note: '学生宿舍区，紧邻食堂与田径场。' }
]

// 类型 -> 颜色（教学：蓝；生活：橙；运动：绿）
const TYPE_COLORS = {
  教学: '#1f5d8c',
  生活: '#e08a2e',
  运动: '#2e8b57'
}

// 等级 -> 点大小（重要 14、一般 10）
const LEVEL_PIXEL_SIZE = {
  重要: 14,
  一般: 10
}

// 挑战加分（1）：billboard 图标。
// 用内联 SVG（data URI）画一个“地图图钉”，底部尖角对准坐标点，按类型换颜色。
// 选 SVG 而不是外链图片，是为了同时满足：透明背景、不跨域（Cesium 明确支持 data URI 贴图）。
function createMarkerIcon(fillColor) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="54" viewBox="0 0 40 54">' +
    `<path d="M20 2 a18 18 0 0 1 18 18 c0 13 -18 33 -18 33 c0 0 -18 -20 -18 -33 a18 18 0 0 1 18 -18 z" ` +
    `fill="${fillColor}" stroke="#ffffff" stroke-width="3"/>` +
    '<circle cx="20" cy="20" r="6.5" fill="#ffffff"/>' +
    '</svg>'
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// 类型 -> 图标（每个类型一张，避免逐个实体重复解析 SVG）
const MARKER_ICONS = {}
Object.keys(TYPE_COLORS).forEach((type) => {
  MARKER_ICONS[type] = createMarkerIcon(TYPE_COLORS[type])
})

// 校区中心点：5 个地标经纬度的平均值
const CAMPUS_CENTER = { lon: 103.984966, lat: 30.584220 }

// 相机站位：架在“校区中心点”正南约 1.3 km、离地 900 m 处（经度略偏东约 0.001°，
// 让校区落在画面左侧，避开右侧信息栏）。
// camera.setView 的 destination 是相机自身的位置，而 pitch=-35° 时视线向下前方看，
// 若把 destination 直接取成校区中心点，视线会越过校区（校区落到画面下方甚至出框），
// 因此相机要向南退一段水平距离 d = 高度 / tan(|pitch|)。
const CAMERA_POSITION = { lon: 103.985966, lat: 30.572630, height: 900 }

// 关卡 3 功能区：教学区，5 个顶点（围绕第六教学楼的正五边形，顶点按角度顺序排列，不会自相交）
const FUNCTION_AREA = [
  103.987664, 30.583839,
  103.988121, 30.583549,
  103.987946, 30.583079,
  103.987382, 30.583079,
  103.987208, 30.583549
]

export default {
  name: 'CesiumEntity',
  setup() {
    let viewer = null
    let handler = null

    // 地标实体清单（挑战加分用：按类型过滤、点击后飞行都要由实体反查地标数据）
    const landmarkEntities = []

    // 关卡 4：当前选中的要素信息（null 表示未选中，即点击空白处）
    const selected = ref(null)

    // 挑战加分（2）：按类型过滤，'全部' 表示不过滤
    const filterType = ref('全部')

    /** 经纬度格式化：统一保留 6 位小数，与坐标记录表精度一致 */
    function formatDegree(value) {
      return value === null || value === undefined ? '—' : `${value.toFixed(6)}°`
    }

    // -----------------------------------------------------------------------
    // 关卡 1：场景初始化
    // -----------------------------------------------------------------------
    function initViewer() {
      viewer = new Cesium.Viewer('cesiumContainer', {
        // 底图：天地图影像（替换 Cesium 默认影像）
        imageryProvider: createTiandituProvider('img'),
        // （1）关闭 6 个默认控件
        geocoder: false,
        baseLayerPicker: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        timeline: false,
        // 动画播放控件（Animation）任务单未列，但它没有时间轴配套、只显示一个走动的时钟，
        // 会让“干净三维地球”显得杂乱，故一并关闭
        animation: false,
        // 首页按钮（HomeButton）会和右上角自定义信息栏重叠，且它的默认“首页”是世界视图、
        // 对本工程没用，按任务单“无多余控件”的验收要求一并关闭
        homeButton: false,
        // 右侧信息栏用自定义面板，关闭 Cesium 自带的 InfoBox，避免出现标题占位提示
        infoBox: false,
        selectionIndicator: false
      })

      // 叠加天地图中文注记层，保证地标名称与注记不冲突
      viewer.imageryLayers.addImageryProvider(createTiandituProvider('cia'))
    }

    // （2）相机站位 + camera.setView（heading 0°、pitch ≈ −35°，能看到建筑侧面）
    function setCampusView() {
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          CAMERA_POSITION.lon,
          CAMERA_POSITION.lat,
          CAMERA_POSITION.height
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),        // 正北
          pitch: Cesium.Math.toRadians(-35),        // 斜俯角，pitch 必须用 toRadians 转换
          roll: 0
        }
      })
    }

    // -----------------------------------------------------------------------
    // 关卡 2：地标点绘制（point + label + name / description）
    // 挑战加分（1）在此基础上给同一实体加了 billboard 图标（贴地）
    // -----------------------------------------------------------------------
    function createLandmarkEntities() {
      LANDMARKS.forEach((item) => {
        const entity = viewer.entities.add({
          name: item.name,
          // description 供关卡 4 的点击拾取读取
          description: buildDescription(item),
          // position：经度、纬度、高度
          position: Cesium.Cartesian3.fromDegrees(item.lon, item.lat, 0),
          point: {
            pixelSize: LEVEL_PIXEL_SIZE[item.level],          // 字号分档：重要 14、一般 10
            color: Cesium.Color.fromCssColorString(TYPE_COLORS[item.type]), // 按类型着色
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2
          },
          // 挑战加分（1）：billboard 图标，heightReference 设为 CLAMP_TO_GROUND 使图标贴地
          billboard: {
            image: MARKER_ICONS[item.type],
            width: 34,
            height: 46,
            // 底端尖角对准坐标点
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            // 轻微上移 4px，让图标白色描边与地面点分开，避免糊成一团
            pixelOffset: new Cesium.Cartesian2(0, -4),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          label: {
            text: item.name,
            font: '14pt 微软雅黑',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.fromCssColorString('#12202f'),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('#12202f').withAlpha(0.75),
            backgroundPadding: new Cesium.Cartesian2(8, 6),
            // 标签上移，避免压住点：加了 billboard 图标（高 46px）后抬到 -56，让文字浮在图钉上方
            pixelOffset: new Cesium.Cartesian2(0, -56),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            // 相机贴近地面时文字不消失
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            // 缩放时文字始终可见、不闪烁
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        })

        // 记下来：过滤（挑战 2）与点击飞行（挑战 3）都要按实体反查地标数据
        landmarkEntities.push({ item, entity })
      })
    }

    /** 生成 description（HTML 字符串，关卡 4 在右侧信息栏中展示） */
    function buildDescription(item) {
      return (
        '<div style="line-height:1.7">' +
        `<p><b>类型：</b>${item.type}</p>` +
        `<p><b>等级：</b>${item.level}</p>` +
        `<p><b>简介：</b>${item.note}</p>` +
        '</div>'
      )
    }

    // -----------------------------------------------------------------------
    // 关卡 3（1）：参观路线 —— 串联前 3 个地标的虚线
    // -----------------------------------------------------------------------
    function createRouteLine() {
      // 前 3 个地标：校门口 → 食堂 → 第二田径场
      const route = LANDMARKS.slice(0, 3)
      // 每个点带高度（米），使折线略高于地表，虚线样式才能清晰显示
      const positions = []
      route.forEach((item) => positions.push(item.lon, item.lat, 50))

      viewer.entities.add({
        name: '参观路线',
        description: '串联前 3 个地标（校门口 → 食堂 → 第二田径场）的参观路线。',
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
          width: 5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#ffd166'),
            dashLength: 24
          }),
          clampToGround: false
        }
      })
    }

    // -----------------------------------------------------------------------
    // 关卡 3（2）：功能区 —— 半透明填充 + 描边的多边形
    // -----------------------------------------------------------------------
    function createFunctionArea() {
      // hierarchy 必须包一层 PolygonHierarchy，不能直接传裸坐标数组
      const positions = Cesium.Cartesian3.fromDegreesArray(FUNCTION_AREA)

      viewer.entities.add({
        name: '教学功能区',
        description: '第六教学楼所在的教学功能区范围。',
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: Cesium.Color.fromCssColorString(TYPE_COLORS['教学']).withAlpha(0.35), // 半透明填充，可见底图
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#ffd166'),
          outlineWidth: 2,
          // 显式设 height: 0 贴地。若完全不写 height，Cesium 会改用贴地图元（GroundPrimitive），
          // 而贴地图元不支持描边，控制台会报警 "outlines are unsupported on terrain"，
          // 导致 outline 不显示；设 height: 0 后既贴地又能正常绘制 outline。
          height: 0
        }
      })
    }

    // -----------------------------------------------------------------------
    // 挑战加分（2）：用 entity.show 按类型过滤地标
    // -----------------------------------------------------------------------
    function applyFilter(type) {
      filterType.value = type
      landmarkEntities.forEach(({ item, entity }) => {
        // '全部' 时所有地标都显示；否则只显示该类型
        entity.show = type === '全部' || item.type === type
      })
    }

    // -----------------------------------------------------------------------
    // 挑战加分（3）：点击地标后飞到该地标，飞行结束后自动恢复俯视角
    // -----------------------------------------------------------------------
    let flyToken = 0 // 用来忽略“上一次飞行还没结束又被新点击打断”的情况

    async function flyToLandmark(entity) {
      flyToken += 1
      const token = flyToken

      // 第一段：调用 viewer.flyTo(entity) 飞到该地标。
      // 注意 range 必须显式给：地标是屏幕像素大小的点/图标，点要素的包围球半径是 0，
      // 若走 Cesium 默认 offset，range 会被钳到最小缩放距离（约 1 m），相机等于钻进地里。
      const arrived = await viewer.flyTo(entity, {
        duration: 1.6,
        // 垂直俯视近景：相机停在该地标正上方 300 m
        offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90), 300)
      })
      // 飞行被打断（例如中途又点了别的点）时 arrived 为 false，直接放弃第二段
      if (!arrived || token !== flyToken || viewer.isDestroyed()) return

      // 第二段：飞行结束后自动恢复俯视角——保持目标仍是该地标，
      // 用 HeadingPitchRange 把 pitch 从 -90° 拉回关卡 1 的 -35°、距离退到 700 m，
      // 回到能看清校区整体的斜俯视视角
      await viewer.flyTo(entity, {
        duration: 1.2,
        offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 700)
      })
    }

    // -----------------------------------------------------------------------
    // 关卡 4：点击拾取与信息显示
    // -----------------------------------------------------------------------
    function onLeftClick(movement) {
      const picked = viewer.scene.pick(movement.position)

      // 点到空白处：picked 为 undefined，先判空再取 .id，否则报 Cannot read properties of undefined
      if (!Cesium.defined(picked) || !Cesium.defined(picked.id)) {
        selected.value = null // 清空右侧信息栏
        return
      }

      const entity = picked.id
      // 地标实体自带 position；线与面没有 position，则用点击射线与地球的交点
      const cartesian = Cesium.defined(entity.position)
        ? entity.position.getValue(viewer.clock.currentTime)
        : pickGlobeCartesian(movement.position)

      const cartographic = Cesium.defined(cartesian)
        ? Cesium.Cartographic.fromCartesian(cartesian) // 圆弧度
        : undefined

      selected.value = {
        name: entity.name || '未命名要素',
        description: Cesium.Property.getValueOrDefault(
          entity.description,
          viewer.clock.currentTime,
          ''
        ),
        lon: Cesium.defined(cartographic) ? Cesium.Math.toDegrees(cartographic.longitude) : null,
        lat: Cesium.defined(cartographic) ? Cesium.Math.toDegrees(cartographic.latitude) : null
      }

      // 挑战加分（3）：点到地标时，让相机飞到该地标（线/面不飞）
      const record = landmarkEntities.find((r) => r.entity === entity)
      if (record) flyToLandmark(record.entity)
    }

    /** 相机射线与地球求交，用于线/面要素的经纬度取值 */
    function pickGlobeCartesian(position) {
      const ray = viewer.camera.getPickRay(position)
      return Cesium.defined(ray) ? viewer.scene.globe.pick(ray, viewer.scene) : undefined
    }

    onMounted(() => {
      initViewer()        // 关卡 1（1）
      setCampusView()     // 关卡 1（2）
      createLandmarkEntities() // 关卡 2
      createRouteLine()        // 关卡 3（1）
      createFunctionArea()     // 关卡 3（2）

      // 关卡 4：监听左键单击
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
      handler.setInputAction(onLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    })

    onBeforeUnmount(() => {
      if (handler) {
        handler.destroy()
        handler = null
      }
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy()
      }
      viewer = null
    })

    return { selected, formatDegree, filterType, applyFilter }
  }
}
</script>

<style scoped>
.entity-app {
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

/* 关卡 4 的右侧信息栏 */
.info-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 250px;
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

.info-panel h2 {
  margin: 0 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.info-title {
  margin: 0 0 6px;
  color: #7fd1ff;
  font-size: 16px;
  font-weight: 600;
}

.info-coord {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.07);
  color: #cfe2f5;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.info-desc {
  color: #b9cde2;
  line-height: 1.7;
}

.info-desc p {
  margin: 0 0 4px;
}

.info-empty {
  margin: 0;
  color: #8fa6bf;
  line-height: 1.8;
  text-align: center;
}

/* 挑战加分（2）：左下角的类型过滤按钮组 */
.filter-panel {
  position: absolute;
  left: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
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

.filter-label {
  color: #9fb4cc;
}

.filter-btn {
  padding: 6px 12px;
  border: 1px solid rgba(127, 209, 255, 0.45);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #cfe2f5;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.filter-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.filter-btn.active {
  border-color: #4da3ff;
  background: #2f6fd0;
  color: #fff;
}
</style>
