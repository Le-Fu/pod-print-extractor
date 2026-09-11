---
name: "pod-print-extractor"
description: "Extracts clean 2D print patterns from product photos using Volcengine Agent Plan Seedream image-to-image model. Invoke when user wants to extract print/pattern designs from product photos, process images for POD printing, or improve the extraction prompt."
---

# POD Print Pattern Extractor

Extracts clean, flat, print-ready digital patterns from product photos by stripping lighting, fabric texture, wrinkles, and 3D distortion, then reconstructing a complete 2D design via the Volcengine Agent Plan Seedream model.

## When to Invoke

- User provides product photos and wants the print/pattern design extracted
- User mentions "印花提取", "图案提取", "POD", "print pattern", or similar
- User asks to process images in `~/Desktop/待提取文件夹`
- User wants to **improve or iterate on the extraction prompt** (提示词改进)

## How It Works

1. Reads the prompt from [prompt.md](./prompt.md) in this skill directory
2. Encodes each image from `~/Desktop/待提取文件夹/` as base64
3. Sends image + prompt to `POST https://ark.cn-beijing.volces.com/api/plan/v3/images/generations`
4. Downloads results to `~/Desktop/可用图案/` as PNG

## Execution

Run the script from the project root:

```bash
node process.js
```

Options:

```bash
node process.js --input <dir> --output <dir>   # custom directories
node process.js --size 3K                      # output size (default 2K)
node process.js --model doubao-seedream-5-0-pro-260628  # use Pro model
node process.js --prompt ./my-prompt.md         # custom prompt
```

## Improving the Prompt

The extraction quality is entirely driven by [prompt.md](./prompt.md) in this skill directory. To iterate:

1. **Read** the current prompt: [.trae/skills/pod-print-extractor/prompt.md](./prompt.md)
2. **Edit** it directly — add rules, refine wording, adjust priorities
3. **Test** by re-running `node process.js` on a sample image
4. **Commit** changes to track prompt versions in git

### Prompt Structure (13 sections)

The prompt covers these priorities (highest → lowest):

| # | Section | Purpose |
|---|---------|---------|
| 一 | Pattern vs Product | Distinguish design info from photo artifacts |
| 二 | Remove Material | Strip lighting, shadows, fabric texture, wrinkles |
| 三 | Preserve Style | Keep original art style (watercolor, retro, etc.) |
| 四 | Element Restoration | Faithfully restore main elements |
| 五 | Moderate Redesign | Allow layout/spacing adjustments |
| 六 | Composition | Auto-select best composition per pattern type |
| 七 | No Cutoff Edges | Complete truncated subjects at borders |
| 八 | Completeness | Full canvas, balanced design |
| 九 | Color Accuracy | Preserve true colors, ignore photo color casts |
| 十 | Flat Output | 2D, front-facing, clean background |
| 十一 | Text Handling | Preserve readable text, avoid garbled text |
| 十二 | Target Size | Respect specified dimensions |
| 十三 | Quality Standards | 9 quality criteria checklist |

### Iteration Tips

- **Colors off?** Edit section 九 (色彩要求) to add specific color correction guidance
- **Style drifting?** Tighten section 三 (保留原图视觉语言)
- **Elements incomplete?** Reinforce section 七 (禁止边缘截断元素)
- **Too much creative freedom?** Reduce scope in section 五 (允许适度二次设计)
- **Output not flat enough?** Strengthen section 十 (输出必须是"平面印花图")

## Configuration

The script reads API key from `.env`:

```env
API_KEY=ark-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Get your Agent Plan API key: https://console.volcengine.com/ark/region:cn-beijing/openManagement?advancedActiveKey=agentPlan

## File Layout

```
项目根/
├── .env                          # API key (gitignored)
├── .env.example                  # template
├── process.js                    # core script
├── package.json
├── README.md
└── .trae/skills/pod-print-extractor/
    ├── SKILL.md                  # this file
    └── prompt.md                 # extraction prompt (iterable)
```
