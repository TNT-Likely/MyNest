#!/bin/bash

# MyNest 密码重置脚本

set -e

echo "=========================================="
echo "  MyNest 密码重置工具"
echo "=========================================="
echo ""

# 检查 psql 是否存在
if ! command -v psql &> /dev/null; then
    echo "❌ 错误: 未找到 psql 命令"
    echo "请确保已安装 PostgreSQL 客户端"
    exit 1
fi

# 数据库配置
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-matrix}"
DB_NAME="${DB_NAME:-mynest}"

echo "数据库配置:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo ""

# 检查用户是否存在
USER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE username = 'admin';" 2>/dev/null | tr -d ' ')

if [ "$USER_COUNT" = "0" ]; then
    echo "ℹ️  用户 'admin' 不存在"
    echo "请重新启动 MyNest 服务，系统会自动创建默认用户并显示密码"
    exit 0
fi

echo "✓ 找到用户 'admin'"
echo ""

# 询问是否要重置
read -p "确定要删除并重新创建用户 'admin' 吗? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 0
fi

# 删除用户
echo "正在删除用户..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM users WHERE username = 'admin';" > /dev/null

echo "✓ 用户已删除"
echo ""
echo "=========================================="
echo "  ✓ 重置完成"
echo "=========================================="
echo ""
echo "请重新启动 MyNest 服务:"
echo "  开发环境: make dev"
echo "  生产环境: make up"
echo ""
echo "启动后，在控制台中查找生成的密码。"
echo ""