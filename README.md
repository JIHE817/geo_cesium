# vue-cesium-project 启动运行方法

## 环境要求
- Node.js（本机已验证 v24.15.0）、npm（v11.12.1），已配置在系统 PATH 中

## 运行步骤
1. 用 VS Code 打开本文件夹 `d:\temporarydeskpro\geo_course_cesium`
2. 打开终端，安装依赖（依赖已装好，此步可跳过）
   ```
   npm install
   ```
3. 启动开发服务器
   ```
   npm run dev
   ```
4. 浏览器访问 http://localhost:8080

## 生产构建（可选）
```
npm run build
```
构建产物输出到 `dist/`，可用 `npm run preview` 本地预览。

## 说明
- 默认页面：`src/components/CesiumEntity.vue`（课堂作业「校园地标三维标绘」，含关卡 1-4 与挑战加分：billboard 贴地图标、按类型过滤按钮、点击地标飞行并自动恢复俯视角）
- 底图：天地图影像（img_w）＋中文注记（cia_w），浏览器端 Key 写在 `CesiumEntity.vue` 顶部
- 如需回到 PPT 8.4 的“8 个默认控件”演示：把 `src/App.vue` 引入的 `CesiumEntity` 换成 `HelloWorld`
- 作业运行截图放在 `screenshots/` 目录：`entity-panorama.png`（全景）、`filter-type.png`（只看教学类）、`click-info.png`（点击拾取信息栏）
- npm 缓存已通过 `.npmrc` 指向项目内的 `.npm-cache`，不写入 C 盘
