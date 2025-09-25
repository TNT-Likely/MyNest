#!/bin/bash
set -e

echo "🚀 MyNest Container Starting..."

# 等待数据库服务可用
echo "⏳ 等待数据库服务..."
for i in {1..30}; do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
        echo "✅ 数据库连接成功"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ 数据库连接超时，但继续启动"
    fi
    echo "   尝试 $i/30 - 等待数据库..."
    sleep 2
done

# 等待 Aria2 服务可用
echo "⏳ 等待 Aria2 服务..."
for i in {1..20}; do
    if wget --quiet --tries=1 --spider "$ARIA2_RPC_URL" >/dev/null 2>&1; then
        echo "✅ Aria2 连接成功"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "❌ Aria2 连接超时，但继续启动"
    fi
    echo "   尝试 $i/20 - 等待 Aria2..."
    sleep 2
done

# 创建必要的目录
mkdir -p /app/logs
mkdir -p /downloads

# 设置适当的权限
chmod -R 755 /app/logs
chmod -R 755 /downloads

echo "🎯 启动 MyNest 服务..."

# 启动 supervisord
exec /usr/bin/supervisord -c /etc/supervisord.conf