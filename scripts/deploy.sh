#!/bin/bash

echo "🚀 MyNest 一键部署脚本"
echo "========================="

# 检查 Docker 和 Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 创建必要的目录
echo "📁 创建必要目录..."
mkdir -p downloads logs

# 设置环境变量（如果不存在 .env 文件）
if [ ! -f .env ]; then
    echo "⚙️  创建默认配置文件..."
    cat > .env <<EOF
# 数据库密码
POSTGRES_PASSWORD=mynest123

# Aria2 密钥
ARIA2_SECRET=mynest123

# 服务端口
PORT=3001

# 下载目录
DOWNLOAD_DIR=./downloads

# 日志目录
LOG_DIR=./logs

# Docker 镜像配置
DOCKER_USERNAME=sunxiao0721
VERSION=latest

# 代理配置（可选）
# HTTP_PROXY=http://proxy.example.com:8080
# HTTPS_PROXY=http://proxy.example.com:8080
# NO_PROXY=localhost,127.0.0.1
EOF
    echo "✅ 已创建默认 .env 配置文件"
    echo "   您可以编辑此文件来自定义配置"
fi

# 停止现有服务（如果存在）
echo "🛑 停止现有服务..."
docker-compose down 2>/dev/null || true

# 拉取最新镜像
echo "📦 拉取最新镜像..."
docker-compose pull

# 启动服务
echo "🚀 启动 MyNest 服务..."
echo "   这可能需要几分钟时间，请耐心等待..."
docker-compose up -d

# 显示启动状态
echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "📊 服务状态："
docker-compose ps

echo ""
echo "🎉 部署完成！"
echo ""
echo "📍 访问地址："
echo "   • MyNest Web界面: http://localhost:$(grep PORT= .env | cut -d'=' -f2 | head -1)"
echo "   • Aria2 WebUI: http://localhost:6801 (密钥: $(grep ARIA2_SECRET= .env | cut -d'=' -f2))"
echo ""
echo "📂 重要目录："
echo "   • 下载目录: $(realpath $(grep DOWNLOAD_DIR= .env | cut -d'=' -f2 | head -1))"
echo "   • 日志目录: $(realpath $(grep LOG_DIR= .env | cut -d'=' -f2 | head -1))"
echo ""
echo "🔧 管理命令："
echo "   • 查看日志: docker-compose logs -f"
echo "   • 重启服务: docker-compose restart"
echo "   • 停止服务: docker-compose down"
echo "   • 更新服务: $0"
echo ""

# 检查服务健康状态
echo "🏥 正在进行健康检查..."
sleep 30
healthy_services=$(docker-compose ps --filter "status=running" --format "table {{.Service}}\t{{.Status}}" | grep -c "healthy" || echo "0")
if [ "$healthy_services" -gt 0 ]; then
    echo "✅ 服务运行正常"
else
    echo "⚠️  服务可能还在启动中，请稍等并查看日志："
    echo "   docker-compose logs -f"
fi