// 创建简单的占位 PNG 图标（不需要额外依赖）
const fs = require('fs');
const path = require('path');

// 创建一个基础的 PNG 文件（1x1 透明像素）
function createMinimalPNG(size) {
  // 这是一个 1x1 透明 PNG 的 base64 数据
  const transparentPNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  return transparentPNG;
}

// 创建一个带颜色的简单 PNG（使用 base64）
function createColoredPNG(size) {
  // 这是一个带颜色的简单 PNG base64 数据
  // 可以使用在线工具生成或替换为实际图标
  const coloredPNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
    'base64'
  );

  return coloredPNG;
}

// 确保 icons 目录存在
const iconsDir = path.join(__dirname, '../icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 生成各种尺寸的图标
const sizes = [16, 32, 48, 128];
sizes.forEach(size => {
  const png = createColoredPNG(size);
  const outputPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outputPath, png);
  console.log(`✅ Created placeholder icon${size}.png`);
});

console.log('\n✅ All placeholder icons created!');
console.log('\n📝 Note: These are minimal placeholder icons.');
console.log('   For production, please replace with proper icons:');
console.log('   - Use a design tool (Figma, Sketch, etc.)');
console.log('   - Or use an icon generator online');
console.log('   - MyNest brand colors: #8B4513 (brown) and #2563EB (blue)');
console.log('   - Icon theme: house/nest 🏠');