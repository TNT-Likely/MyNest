#!/bin/bash

set -e

# MyNest 一键安装脚本

echo "🪹 MyNest 一键部署脚本"
echo "=========================="

# 检查 Docker 和 Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 创建工作目录
INSTALL_DIR="mynest"
if [ -d "$INSTALL_DIR" ]; then
    echo "⚠️  目录 $INSTALL_DIR 已存在"
    read -p "是否继续？这将覆盖现有配置 (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 下载配置文件
echo "📥 下载配置文件..."
curl -fsSL https://raw.githubusercontent.com/matrix/mynest/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/matrix/mynest/main/.env.example -o .env

# 生成随机密码
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-16)
ARIA2_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-16)

# 更新 .env 文件
sed -i.bak "s/POSTGRES_PASSWORD=mynest123/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
sed -i.bak "s/ARIA2_SECRET=mynest123/ARIA2_SECRET=$ARIA2_SECRET/" .env
rm -f .env.bak

echo "✅ 配置文件已生成："
echo "   - PostgreSQL 密码: $POSTGRES_PASSWORD"
echo "   - aria2 密钥: $ARIA2_SECRET"

# 创建下载目录
mkdir -p downloads

# 启动服务
echo "🚀 启动服务..."
docker-compose pull
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "🎉 MyNest 部署成功！"
    echo ""
    echo "📋 访问信息："
    echo "   - Web 界面: http://localhost:3000"
    echo "   - 健康检查: http://localhost:3000/health"
    echo ""
    echo "📊 管理命令："
    echo "   - 查看日志: docker-compose logs -f"
    echo "   - 重启服务: docker-compose restart"
    echo "   - 停止服务: docker-compose down"
    echo ""
    echo "📁 数据目录："
    echo "   - 下载目录: $(pwd)/downloads"
    echo "   - 配置文件: $(pwd)/.env"
    echo ""
    echo "🔧 配置 Telegram Bot："
    echo "   1. 访问 http://localhost:3000/plugins"
    echo "   2. 配置 Telegram Bot Token"
    echo "   3. 开始使用！"
else
    echo "❌ 服务启动失败，请检查日志："
    docker-compose logs
    exit 1
fi