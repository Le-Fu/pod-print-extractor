#!/usr/bin/env node
'use strict';

/**
 * POD 印花图案提取工具
 *
 * 基于火山引擎 Agent Plan 的 Seedream 图生图模型，
 * 按照 .trae/skills/pod-print-extractor/prompt.md 中的指示，
 * 将商品实拍图提取为干净的二维印花图案。
 *
 * 提示词可在 skill 目录下持续迭代改进，无需改动脚本。
 *
 * 用法:
 *   node process.js                              # 默认 桌面/待提取文件夹 -> 桌面/可用图案
 *   node process.js --input ./myimgs --output ./result
 *   node process.js --size 3K --model doubao-seedream-5-0-pro-260628
 *   node process.js --prompt ./my-prompt.md      # 自定义提示词
 *
 * 也可通过 .env / 环境变量配置:
 *   API_KEY / ARK_API_KEY, ARK_BASE_URL, ARK_MODEL, IMAGE_SIZE, PROMPT_PATH
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 桌面路径（跨用户名兼容）
const DESKTOP_DIR = path.join(os.homedir(), 'Desktop');

// ======================== 配置加载 ========================

/** 读取 .env 文件到 process.env（不覆盖已有值） */
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

/** 简易 CLI 参数解析: --key value 或 --key=value */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        args[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args[arg.slice(2)] = argv[++i];
      } else {
        args[arg.slice(2)] = true;
      }
    }
  }
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ======================== 图片工具 ========================

const SUPPORTED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

/** 将本地图片文件转为 data URI (base64) */
function imageToDataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const format = ext === '.jpg' ? 'jpeg' : ext.slice(1); // jpg -> jpeg
  const buf = fs.readFileSync(filePath);
  return `data:image/${format};base64,${buf.toString('base64')}`;
}

// ======================== API 调用 ========================

/**
 * 调用火山引擎 Agent Plan 图生图 API
 * @param {string} prompt       提示词
 * @param {string} imageDataUri 输入图片的 data URI
 * @param {object} config      配置 (apiKey, baseUrl, model, size)
 * @returns {Promise<string>}  生成图片的下载 URL
 */
async function generateImage(prompt, imageDataUri, config) {
  const body = {
    model: config.model,
    prompt,
    image: [imageDataUri],
    size: config.size,
    response_format: 'url',
    watermark: false,
    sequential_image_generation: 'disabled',
  };
  // output_format 仅 Seedream 5.0 Lite 支持，Pro 模型不支持
  if (config.outputFormat && !config.model.includes('pro')) {
    body.output_format = config.outputFormat;
  }

  const url = `${config.baseUrl}/images/generations`;
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // 网络层错误，可重试
      if (attempt < maxRetries) {
        const wait = Math.pow(2, attempt) * 2000;
        console.log(`  [WARN] 网络错误，${wait / 1000}s 后重试 (${attempt + 1}/${maxRetries})...`);
        await sleep(wait);
        continue;
      }
      throw new Error(`网络请求失败: ${err.message}`);
    }

    // 限流 / 服务端错误 → 重试
    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxRetries) {
        const wait = Math.pow(2, attempt) * 2000;
        console.log(`  [WARN] HTTP ${res.status}，${wait / 1000}s 后重试 (${attempt + 1}/${maxRetries})...`);
        await sleep(wait);
        continue;
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API ${res.status}: ${errText}`);
    }

    const data = await res.json();
    if (!data.data || !data.data[0] || !data.data[0].url) {
      throw new Error(`API 返回数据异常: ${JSON.stringify(data)}`);
    }
    return data.data[0].url;
  }
}

/** 下载远程图片到本地 */
async function downloadImage(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buf);
}

// ======================== 主流程 ========================

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  // 组装配置
  const config = {
    apiKey: process.env.ARK_API_KEY || process.env.API_KEY,
    baseUrl: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/plan/v3',
    model: args.model || process.env.ARK_MODEL || 'doubao-seedream-5-0-260128',
    size: args.size || process.env.IMAGE_SIZE || '2K',
    outputFormat: 'png',
  };

  const inputDir = args.input || process.env.INPUT_DIR || path.join(DESKTOP_DIR, '待提取文件夹');
  const outputDir = args.output || process.env.OUTPUT_DIR || path.join(DESKTOP_DIR, '可用图案');

  // 校验 API Key
  if (!config.apiKey) {
    console.error('[ERROR] 未找到 API Key，请在 .env 中设置 API_KEY 或 ARK_API_KEY');
    process.exit(1);
  }

  // 读取提示词：优先 skill 目录（方便迭代改进），回退到项目根目录
  const skillPromptPath = path.join(__dirname, '.trae', 'skills', 'pod-print-extractor', 'prompt.md');
  const rootPromptPath = path.join(__dirname, 'prompt.md');
  const promptPath = args.prompt || process.env.PROMPT_PATH ||
    (fs.existsSync(skillPromptPath) ? skillPromptPath : rootPromptPath);
  if (!fs.existsSync(promptPath)) {
    console.error('[ERROR] 未找到 prompt.md');
    console.error(`        已尝试: ${skillPromptPath}`);
    console.error(`        已尝试: ${rootPromptPath}`);
    process.exit(1);
  }
  const prompt = fs.readFileSync(promptPath, 'utf-8');
  console.log(`已加载提示词 (${prompt.length} 字符) [${path.relative(__dirname, promptPath)}]`);

  // 创建输出目录
  fs.mkdirSync(outputDir, { recursive: true });

  // 扫描输入图片
  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
    console.error(`[ERROR] 输入目录 ${inputDir} 不存在，已自动创建。`);
    console.error(`        请将商品实拍图放入该目录后重新运行。`);
    console.error(`        支持的格式: ${SUPPORTED_EXTS.join(', ')}`);
    process.exit(1);
  }

  const images = fs.readdirSync(inputDir)
    .filter(f => SUPPORTED_EXTS.includes(path.extname(f).toLowerCase()))
    .sort()
    .map(f => path.join(inputDir, f));

  if (images.length === 0) {
    console.error(`[ERROR] 在 ${inputDir} 中未找到图片 (支持 ${SUPPORTED_EXTS.join(', ')})`);
    process.exit(1);
  }

  // 打印任务信息
  console.log('--------------------------------------------------');
  console.log(`图片数量: ${images.length}`);
  console.log(`模型:     ${config.model}`);
  console.log(`尺寸:     ${config.size}`);
  console.log(`输入目录: ${inputDir}`);
  console.log(`输出目录: ${outputDir}`);
  console.log('--------------------------------------------------');

  // 逐张处理
  let success = 0;
  let failed = 0;
  const failedList = [];

  for (let i = 0; i < images.length; i++) {
    const imgPath = images[i];
    const imgName = path.basename(imgPath);
    const nameNoExt = path.basename(imgPath, path.extname(imgPath));
    const outPath = path.join(outputDir, `${nameNoExt}_印花.png`);

    console.log(`\n[${i + 1}/${images.length}] ${imgName}`);

    try {
      // 检查文件大小 (API 限制 30MB)
      const stat = fs.statSync(imgPath);
      const sizeMB = stat.size / (1024 * 1024);
      if (sizeMB > 30) {
        throw new Error(`图片过大 (${sizeMB.toFixed(1)}MB)，API 限制 30MB`);
      }
      console.log(`  图片大小: ${sizeMB.toFixed(1)}MB`);

      // 转为 base64 并调用 API
      const dataUri = imageToDataUri(imgPath);
      console.log(`  调用 API 中...`);

      const imageUrl = await generateImage(prompt, dataUri, config);
      console.log(`  下载结果...`);

      await downloadImage(imageUrl, outPath);
      const outSize = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(1);
      console.log(`  [OK] 已保存: ${path.basename(outPath)} (${outSize}MB)`);
      success++;
    } catch (err) {
      console.error(`  [FAIL] ${err.message}`);
      failed++;
      failedList.push(imgName);
    }

    // 进度
    const pct = ((i + 1) / images.length * 100).toFixed(0);
    console.log(`  进度: ${pct}% (${success} 成功 / ${failed} 失败)`);
  }

  // 汇总
  console.log('\n' + '='.repeat(50));
  console.log(`处理完成: ${success} 张成功, ${failed} 张失败`);
  console.log(`输出目录: ${outputDir}`);
  if (failedList.length > 0) {
    console.log(`失败列表: ${failedList.join(', ')}`);
  }
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
