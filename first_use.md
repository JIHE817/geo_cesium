# 首次使用（从 GitHub 拉取后如何跑起来）

本说明面向：把本项目从 GitHub 克隆到自己电脑、用 VS Code 打开后，第一次运行前需要做的事。

## 一、需要下载的依赖（按顺序）

### 1. Node.js（含 npm）—— 必须先装
项目基于 Vite 5 构建，需要 Node.js 18.18 及以上版本（推荐 20 LTS）。

- 官网下载：<https://nodejs.org/zh-cn>
- 安装后，打开 VS Code 内置终端，验证：

```bash
node -v
npm -v
```

能打印出 `v20.x.x` 和 `10.x.x`（或更高）即成功。

> 可选：Git。若还没装 Git，可从 <https://git-scm.com> 下载，用于执行 `git clone` 拉取代码。

### 2. 项目依赖包 —— 拉取代码后由 npm 自动安装
无需手动逐个下载，项目已在 `package.json` 里声明好全部依赖，一条命令装完。依赖清单如下（仅供参考，实际以 package.json 为准）：

- 运行依赖：`cesium 1.99.0`、`vue ^3.5.13`
- 开发依赖：`vite ^5.4.11`、`@vitejs/plugin-vue ^5.2.1`、`vite-plugin-cesium ^1.2.23`

## 二、完整启动步骤（按顺序执行）

1. 拉取代码到本地：

```bash
git clone <你的仓库地址>
```

2. 用 VS Code 打开项目根目录，打开终端（`Ctrl + ~`）。

3. 安装依赖（首次必做，之后无需重复）：

```bash
npm install
```

> 国内网络慢时，可先切换 npm 源再安装：
>
> ```bash
> npm config set registry https://registry.npmmirror.com
> npm install
> ```

4. 启动开发服务器：

```bash
npm run dev
```

5. 看到类似 `Local: http://localhost:8080/` 的提示后，用浏览器打开：

```text
http://localhost:8080
```

即可看到天地图底图上的三个关卡 + 挑战加分功能。

## 三、其他命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（日常调试用） |
| `npm run build` | 生产构建，产物生成在 `dist/` 目录 |
| `npm run preview` | 本地预览 `dist/` 构建结果 |

## 四、常见问题

- **端口被占用**：`vite.config.js` 里固定了 `port: 8080`，若被占用可在该文件里改端口号。
- **`.npmrc` 的缓存路径**：仓库根目录的 `.npmrc` 里写死了本机缓存路径 `D:/temporarydeskpro/geo_course_cesium/.npm-cache`。若你的电脑没有 D 盘或克隆到了别处，可删掉该文件后再执行 `npm install`，对运行无任何影响。