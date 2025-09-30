import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 确保 icons 目录存在
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 自定义图片路径
const CUSTOM_EMOJI_PATH = path.join(__dirname, 'nest-emoji.png');

// 🪹 emoji 的 Unicode 码点是 U+1FAB9
// 使用 Twemoji CDN（更接近系统 emoji 显示效果）
const EMOJI_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1fab9.png';

// 下载 emoji 图片
function downloadEmoji() {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(__dirname, 'temp-emoji.png');
    const file = fs.createWriteStream(tempPath);

    https.get(EMOJI_URL, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(tempPath);
      });
    }).on('error', (err) => {
      fs.unlinkSync(tempPath);
      reject(err);
    });
  });
}

async function generateIcons() {
  try {
    let emojiPath;
    let needsCleanup = false;

    // 检查是否有自定义图片
    if (fs.existsSync(CUSTOM_EMOJI_PATH)) {
      console.log('🎨 Using custom emoji image: nest-emoji.png');
      emojiPath = CUSTOM_EMOJI_PATH;
    } else {
      console.log('📥 Downloading emoji from Twemoji...');
      emojiPath = await downloadEmoji();
      needsCleanup = true;
    }

    const emojiImage = await loadImage(emojiPath);

    console.log('🖼️  Generating icons...');

    // 生成各种尺寸的图标
    const sizes = [16, 32, 48, 128];

    for (const size of sizes) {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // 清空画布（透明背景）
      ctx.clearRect(0, 0, size, size);

      // 居中绘制 emoji
      ctx.drawImage(emojiImage, 0, 0, size, size);

      const buffer = canvas.toBuffer('image/png');
      const filename = path.join(iconsDir, `icon${size}.png`);

      fs.writeFileSync(filename, buffer);
      console.log(`✅ Generated ${filename}`);
    }

    // 清理临时文件
    if (needsCleanup) {
      fs.unlinkSync(emojiPath);
    }

    console.log('\n🪹 All MyNest icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();