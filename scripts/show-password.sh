#!/bin/bash

# MyNest 查看密码脚本（从日志中查看）

set -e

echo "=========================================="
echo "  MyNest 密码查看工具"
echo "=========================================="
echo ""

# 数据库配置
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-matrix}"
DB_NAME="${DB_NAME:-mynest}"

# 从系统日志查询密码
echo "从系统日志中查找密码记录..."
echo ""

PASSWORD_LOG=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT message, details, created_at FROM system_logs WHERE category = 'security' AND message LIKE '%管理员账号%' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null)

if [ -z "$PASSWORD_LOG" ]; then
    echo "❌ 未找到密码记录"
    echo ""
    echo "可能原因："
    echo "  1. 系统已经创建过用户（只在首次启动时生成密码）"
    echo "  2. 配置了自定义密码（在 config.yaml 或环境变量中）"
    echo ""
    echo "解决方案："
    echo "  1. 重置密码: ./scripts/reset-password.sh"
    echo "  2. 查看配置文件: cat backend/config.yaml"
    exit 1
fi

echo "✓ 找到密码记录:"
echo ""
echo "$PASSWORD_LOG" | awk -F '|' '{
    gsub(/^[ \t]+|[ \t]+$/, "", $1);
    gsub(/^[ \t]+|[ \t]+$/, "", $2);
    gsub(/^[ \t]+|[ \t]+$/, "", $3);

    # 从 details 中提取密码
    if (match($2, /Password: ([a-zA-Z0-9]+)/, arr)) {
        password = arr[1];
        print "  🔐 用户名: admin";
        print "  🔑 密码: " password;
        print "  📅 创建时间: " $3;
    }
}'
echo ""
echo "=========================================="
echo ""