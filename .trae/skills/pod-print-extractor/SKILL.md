---
name: "pod-print-extractor"
description: "Extracts clean 2D print patterns from product photos using Volcengine Agent Plan Seedream image-to-image model, with per-category prompt and size presets. Invoke when user wants to extract print/pattern designs from product photos for POD printing (umbrella, drawstring bag, storage box, etc.) or improve the extraction prompt."
---

# POD Print Pattern Extractor

Extracts clean, flat, print-ready digital patterns from product photos by stripping lighting, fabric texture, wrinkles, and 3D distortion, then reconstructing a complete 2D design via the Volcengine Agent Plan Seedream model.

**提示词采用分层结构**：通用基础规则（`base.md`）+ 品类特定规则（如 `umbrella.md`），脚本按品类自动拼接。

## When to Invoke

- User provides product photos and wants the print/pattern design extracted
- User mentions "印花提取", "图案提取", "POD", "print pattern", or similar
- User asks to process images in `~/Desktop/待提取文件夹`
- User specifies a target product category (umbrella / drawstring bag / storage box)
- User wants to **improve or iterate on the extraction prompt** (提示词改进)

## How It Works

1. 解析 `--category` 参数，确定品类、尺寸、品类提示词文件
2. 加载 `base.md`（通用规则）+ 品类 `.md`（品类规则），拼接为完整提示词
3. 将每张图片（base64 编码）+ 完整提示词发送到 `POST https://ark.cn-beijing.volces.com/api/plan/v3/images/generations`
4. 下载结果到 `~/Desktop/可用图案/` 为 PNG

## Supported Categories

| 品类 | 参数值 | 别名 | 比例 | 尺寸 | 提示词文件 |
|---|---|---|---|---|---|
| 伞 | `umbrella` | `伞` | 1:1 | 1920×1920 | [umbrella.md](./umbrella.md) |
| 束口袋 | `drawstring-bag` | `束口袋` | 3:4 | 1440×1920 | [drawstring-bag.md](./drawstring-bag.md) |
| 收纳箱 | `storage-box` | `收纳箱` | 3:2 | 1920×1280 | [storage-box.md](./storage-box.md) |

未指定品类时使用 `base.md` 通用规则，尺寸默认 2K。

## Execution

```bash
# 不指定品类（通用规则，默认 2K）
node process.js

# 伞：1:1，1920×1920，含中心校正规则
node process.js --category umbrella

# 束口袋：3:4，1440×1920
node process.js --category drawstring-bag
# 或中文别名
node process.js --category 束口袋

# 收纳箱：3:2，1920×1280，含左右留白规则
node process.js --category storage-box
```

其他选项：

```bash
node process.js --input <dir> --output <dir>   # 自定义目录
node process.js --size 3K                      # 覆盖品类默认尺寸
node process.js --model doubao-seedream-5-0-pro-260628  # 切换模型
node process.js --prompt ./my-prompt.md         # 自定义提示词（覆盖品类拼接）
```

## Prompt Architecture

```
.trae/skills/pod-print-extractor/
├── base.md              # 通用基础规则（13 节，所有品类共用）
├── umbrella.md          # 伞的特定规则：中心校正、放射性图案
├── drawstring-bag.md    # 束口袋的特定规则：竖向构图、束口/底部避让
├── storage-box.md       # 收纳箱的特定规则：左右留白、拼接衔接
└── SKILL.md             # 本文件
```

脚本拼接顺序：`base.md` + 品类 `.md`（在 base 末尾追加品类特定指令）。

### Base Prompt Structure (13 sections)

通用基础规则覆盖以下优先级（高 → 低）：

| # | 章节 | 用途 |
|---|---------|---------|
| 一 | 图案 vs 商品 | 区分设计信息与摄影干扰 |
| 二 | 去除材质 | 剥离光影、阴影、布料纹理、褶皱 |
| 三 | 保留风格 | 保持原艺术风格（水彩、复古等） |
| 四 | 元素还原 | 准确还原主要元素 |
| 五 | 适度二次设计 | 允许排版/间距调整 |
| 六 | 构图方式 | 按图案类型自动选择构图 |
| 七 | 禁止边缘截断 | 补全被截断的主体 |
| 八 | 画面完整性 | 完整画布、均衡设计 |
| 九 | 色彩要求 | 保持真实色彩，忽略色偏 |
| 十 | 平面输出 | 二维、正面、干净背景 |
| 十一 | 文字处理 | 保留可识别文字，避免乱码 |
| 十二 | 目标尺寸 | 由品类自动注入 |
| 十三 | 质量标准 | 9 项质量标准清单 |

## Improving the Prompt

### 改通用规则

编辑 [base.md](./base.md)——影响所有品类。适用于：
- 颜色不准 → 改第九节（色彩要求）
- 风格漂移 → 收紧第三节（保留原图视觉语言）
- 元素不完整 → 强化第七节（禁止边缘截断元素）
- 创作自由度过大 → 收窄第五节（允许适度二次设计）
- 输出不够平面 → 强化第十节（输出必须是"平面印花图"）

### 改品类规则

编辑对应品类的 `.md` 文件——只影响该品类：

| 问题 | 改哪个文件 |
|---|---|
| 伞的中心偏移 | [umbrella.md](./umbrella.md) → 中心校正章节 |
| 收纳箱拼接处难看 | [storage-box.md](./storage-box.md) → 左右边缘处理章节 |
| 束口袋顶部被遮挡 | [drawstring-bag.md](./drawstring-bag.md) → 竖向构图章节 |

### 新增品类

1. 在 skill 目录新建 `<category-key>.md`（如 `tote-bag.md`）
2. 在 `process.js` 的 `CATEGORIES` 对象中添加配置：
   ```js
   'tote-bag': { label: '帆布袋', size: '1440x1920', ratio: '3:4', promptFile: 'tote-bag.md' },
   ```
3. 测试：`node process.js --category tote-bag`
4. 提交 git

### 迭代流程

1. 直接编辑对应 `.md` 文件——增删规则、调整措辞、修改优先级
2. 用一张样图测试：`node process.js --category <key>`
3. 满意后 `git commit` 提示词变更，便于版本回溯

## Configuration

脚本从 `.env` 读取 API Key：

```env
API_KEY=ark-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

获取 Agent Plan API Key: https://console.volcengine.com/ark/region:cn-beijing/openManagement?advancedActiveKey=agentPlan

## File Layout

```
项目根/
├── .env                          # API key (gitignored)
├── .env.example                  # 配置模板
├── .gitignore
├── package.json
├── process.js                    # 核心脚本
├── README.md
└── .trae/skills/pod-print-extractor/
    ├── SKILL.md                  # 本文件
    ├── base.md                   # 通用基础规则
    ├── umbrella.md               # 伞的特定规则
    ├── drawstring-bag.md         # 束口袋的特定规则
    └── storage-box.md            # 收纳箱的特定规则
```
