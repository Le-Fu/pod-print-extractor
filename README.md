# POD 印花图案提取工具

基于 [火山引擎 Agent Plan](https://www.volcengine.com/product/agent-plan) 的 **Seedream 图生图模型**，按品类自动组装提示词，将商品实拍图转换为干净、完整、可直接用于 POD 印刷的二维印花图案。

## 工作原理

脚本根据 `--category` 参数，从 skill 目录读取 `base.md`（通用规则）+ 对应品类的 `.md`（品类规则）拼接成完整提示词，连同每张商品实拍图（base64 编码）一并发送到 Agent Plan 的 Seedream 模型，模型识别并提取真正属于"印花设计"的视觉信息，彻底剥离商品摄影造成的光影、材质、褶皱、立体变形，按品类要求补全、构图，生成一张独立的、平面的、干净的印花图。

**提示词分层迭代**——通用规则改 `base.md`，品类规则改品类 `.md`，互不影响。

## 支持品类

| 品类 | 参数 | 比例 | 尺寸 | 关键规则 |
|---|---|---|---|---|
| 伞 | `--category umbrella` | 1:1 | 1920×1920 | 中心校正，放射性图案补全 |
| 束口袋 | `--category drawstring-bag` | 3:4 | 1440×1920 | 竖向构图，束口/底部避让 |
| 收纳箱 | `--category storage-box` | 3:2 | 1920×1280 | 左右留白，拼接处不截断 |

也支持中文别名：`--category 伞` / `--category 束口袋` / `--category 收纳箱`。

## 默认目录

| 用途 | 路径 | 说明 |
|---|---|---|
| 输入 | `~/Desktop/待提取文件夹/` | 放入商品实拍图，首次运行自动创建 |
| 输出 | `~/Desktop/可用图案/` | 生成的印花图自动保存于此 |
| 通用提示词 | `.trae/skills/pod-print-extractor/base.md` | 13 节通用规则，所有品类共用 |
| 品类提示词 | `.trae/skills/pod-print-extractor/<品类>.md` | 品类特定规则，可独立迭代 |
| Skill | `.trae/skills/pod-print-extractor/SKILL.md` | Skill 描述与迭代指南 |
| 配置 | `.env` | API Key 等敏感配置 |

支持的输入格式：`.jpg` / `.jpeg` / `.png` / `.webp`，单张不超过 30MB。

## 快速开始

### 1. 安装 Node.js

需要 Node.js 18+（推荐 22）。若未安装：

```bash
# macOS (Homebrew)
brew install node

# 或使用 nvm
nvm install 22 && nvm use 22
```

### 2. 获取 Agent Plan API Key

1. 访问 [Agent Plan 开通页](https://console.volcengine.com/ark/region:cn-beijing/openManagement?advancedActiveKey=agentPlan)，购买 / 开通套餐（推荐 Large 及以上，Small / Medium 不支持生图模型）。
2. 在 **API Key 管理** 创建一个 **Agent Plan 专属 API Key**（注意：普通方舟 API Key 无法用于 Agent Plan）。

### 3. 配置 .env

将仓库中的 `.env.example` 复制为 `.env`，填入 API Key：

```bash
cp .env.example .env
```

```env
API_KEY=ark-你的专属APIKey
```

### 4. 运行

```bash
# 把商品实拍图放进 ~/Desktop/待提取文件夹/
# 不指定品类（通用规则，默认 2K 尺寸）
node process.js

# 指定品类（自动应用品类专属规则 + 默认尺寸）
node process.js --category umbrella        # 伞 1:1 1920×1920
node process.js --category drawstring-bag  # 束口袋 3:4 1440×1920
node process.js --category storage-box     # 收纳箱 3:2 1920×1280
# 也支持中文别名
node process.js --category 伞

# 结果会出现在 ~/Desktop/可用图案/
```

## 命令行参数

```bash
# 指定品类（自动设置尺寸 + 加载品类专属规则）
node process.js --category umbrella         # 伞 / drawstring-bag / storage-box

# 指定输入/输出目录
node process.js --input ./my-images --output ./results

# 覆盖品类默认尺寸（可选 2K / 3K / 具体分辨率如 1920x1920）
node process.js --category umbrella --size 3K

# 切换模型（默认 Seedream 5.0 Lite，如套餐支持 Pro 高精度编辑模型）
node process.js --model doubao-seedream-5-0-pro-260628

# 自定义提示词文件（覆盖品类拼接逻辑，使用你自己的完整提示词）
node process.js --prompt ./my-prompt.md
```

也可通过 `.env` 设置环境变量：`ARK_MODEL` / `IMAGE_SIZE` / `ARK_BASE_URL` / `PROMPT_PATH` / `CATEGORY`。

## 改进提示词

提取质量完全由提示词驱动。提示词采用分层结构：

```
.trae/skills/pod-print-extractor/
├── base.md              # 通用规则（13 节），所有品类共用
├── umbrella.md          # 伞的特定规则
├── drawstring-bag.md    # 束口袋的特定规则
└── storage-box.md       # 收纳箱的特定规则
```

**迭代流程：**

1. **改通用规则** → 编辑 `base.md`（影响所有品类）
2. **改品类规则** → 编辑对应品类的 `.md`（只影响该品类）
3. 用一张样图测试：`node process.js --category <品类>`
4. 满意后 `git commit` 提示词变更，便于版本回溯

**新增品类**：在 skill 目录新建 `<key>.md`，在 [process.js](process.js) 的 `CATEGORIES` 对象中添加配置即可。

详细的提示词结构与迭代建议见 [SKILL.md](.trae/skills/pod-print-extractor/SKILL.md)。

## 配置到「快捷指令」（macOS Shortcuts）

将本工具接入 macOS「快捷指令」App，即可在桌面右键、Finder 选中图片后一键触发印花提取。以下步骤从零配置：

### 准备：记录项目路径

本仓库克隆后的绝对路径，例如：

```
/Users/simon/development/projects/印花提取
```

下文以 `<项目路径>` 代指，请在操作时替换成你的真实路径。

### 步骤 1：打开「快捷指令」App

- macOS 自带，可在启动台搜索 "快捷指令" 或 "Shortcuts" 打开。
- 若未安装：[App Store 下载快捷指令](https://apps.apple.com/cn/app/shortcuts/id915243338)。

### 步骤 2：新建快捷指令

1. 点击顶部 **+**（或 ⌘N）新建快捷指令。
2. 命名，例如 **"提取印花图案"**。
3. 在右侧"快捷指令详细信息"中：
   - 勾选 **在主屏幕上显示**（可选）。
   - 勾选 **在共享表单中使用** → 选择 **图像** 和 **文件**，这样可在 Finder / 桌面右键图片时直接触发本快捷指令。

### 步骤 3：添加「通过 Shell 脚本运行」动作

在画布中央搜索框输入 `shell`，双击 **通过 Shell 脚本运行** 动作添加。配置：

- **Shell**：`/bin/zsh`（或 `/bin/bash`）
- **输入**：作为自变量（默认即可）
- **传递输入**：作为自变量

在脚本框中粘贴以下内容（请替换 `<项目路径>` 为真实路径）：

```bash
# ============================================================
# 快捷指令：提取印花图案
# 输入：从共享表单接收的图片文件，或自动处理整个待提取文件夹
# 输出：生成的印花图保存到 ~/Desktop/可用图案/
# ============================================================

# 1. 设置项目路径（★ 请改成你本机的真实路径 ★）
PROJECT_DIR="/Users/simon/development/projects/印花提取"

# 2. 定位 Node.js（nvm 用户可能需要手动指定）
#    如直接用系统 Node，可注释掉这行
export PATH="$HOME/.nvm/versions/node/v22.21.1/bin:$PATH"

# 3. 询问品类（可选，直接回车则不指定品类）
echo "请选择本次图案用途的品类："
echo "  1) 伞        (1:1, 1920×1920)"
echo "  2) 束口袋    (3:4, 1440×1920)"
echo "  3) 收纳箱    (3:2, 1920×1280)"
echo "  其他) 不指定品类，使用通用规则"
echo -n "输入编号或直接回车: "
read choice
case "$choice" in
  1) CATEGORY="--category umbrella" ;;
  2) CATEGORY="--category drawstring-bag" ;;
  3) CATEGORY="--category storage-box" ;;
  *) CATEGORY="" ;;
esac
echo "已选: ${CATEGORY:-无品类（通用规则）}"

# 4. 准备输入目录：如果有共享表单传入的图片，复制进去；否则处理已有内容
INPUT_DIR="$HOME/Desktop/待提取文件夹"
mkdir -p "$INPUT_DIR"

# 如果快捷指令从共享表单接收了文件（$@ 是文件路径列表）
if [ "$#" -gt 0 ]; then
  for f in "$@"; do
    cp "$f" "$INPUT_DIR/" 2>/dev/null
  done
fi

# 5. 切到项目目录运行脚本
cd "$PROJECT_DIR" || exit 1
/usr/bin/env node process.js $CATEGORY

# 6. 结束后打开输出文件夹
open "$HOME/Desktop/可用图案"
```

> 说明：
> - 第 2 行的 `PATH` 仅在使用 nvm 管理 Node 时需要；用 Homebrew 直接安装的 Node 无需此行，可删除。
> - 第 3 步会询问本次处理的品类，选 1/2/3 自动套用对应尺寸和规则。
> - 第 4 步会把你右键选中的图片自动拷进"待提取文件夹"，再统一处理。
> - 如果你只希望处理当前选中的图，不复制到默认目录，可在脚本里把 `INPUT_DIR` 改成一个临时目录，并用 `--input` 指定给 `process.js`。

### 步骤 4：保存并测试

1. 按 **⌘S** 保存。
2. 测试方式 A（共享表单）：在 Finder 或桌面右键一张商品实拍图 → **共享** → **提取印花图案**。
3. 测试方式 B（直接运行）：在快捷指令 App 中点击 ▶ 运行，会处理"待提取文件夹"内的全部图片。
4. 完成后会自动弹出"可用图案"文件夹。

### 常见问题

| 现象 | 解决 |
|---|---|
| `node: command not found` | 第 2 行 `PATH` 未正确指向 Node；在终端执行 `which node` 拿到路径替换 |
| `EPERM: mkdir` | 桌面无写入权限；系统设置 → 隐私与安全性 → 完全磁盘访问权限，勾选终端 / Node |
| `[ERROR] 未找到 API Key` | `.env` 文件未创建或 Key 未填写；参考上文"3. 配置 .env" |
| `API 401 / 403` | API Key 无效或不是 Agent Plan 专属 Key；到控制台重新生成 |
| `API 404` | Base URL 拼错，必须为 `https://ark.cn-beijing.volces.com/api/plan/v3` |
| 图片过大 | 单张超过 30MB；先用预览或 `sips` 压缩 |

## 推送到 GitHub

本项目已配置 `.gitignore`，自动排除 `.env`、`node_modules/`、`input/`、`output/` 等敏感与运行时文件。本地克隆后首次配置：

```bash
cp .env.example .env
# 编辑 .env 填入 API Key
```

## 技术栈

- **运行时**：Node.js 18+（零外部依赖，仅用内置 `fs` / `path` / `os` / `fetch`）
- **模型**：火山引擎方舟 Agent Plan 的 Seedream 系列图生图模型
- **API 端点**：`POST https://ark.cn-beijing.volces.com/api/plan/v3/images/generations`
- **Skill**：Trae SKILL 格式，分层提示词（base + 品类），支持独立迭代

## 项目结构

```
印花提取/
├── .env                          # API key (gitignored)
├── .env.example                  # 配置模板
├── .gitignore
├── package.json
├── process.js                    # 核心脚本（含品类路由、提示词拼接）
├── README.md
└── .trae/skills/pod-print-extractor/
    ├── SKILL.md                  # Skill 描述（触发条件、执行流程、迭代指南）
    ├── base.md                   # 通用基础规则（13 节，所有品类共用）
    ├── umbrella.md               # 伞的特定规则（中心校正、放射性图案）
    ├── drawstring-bag.md         # 束口袋的特定规则（竖向构图、束口避让）
    └── storage-box.md            # 收纳箱的特定规则（左右留白、拼接衔接）
```

## 许可

MIT
