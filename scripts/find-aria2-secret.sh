#!/bin/bash

# 查找 aria2 RPC secret

echo "=========================================="
echo "  查找 aria2 RPC secret"
echo "=========================================="
echo ""

# 常见的 secret 值
secrets=("mynest123" "your-aria2-secret" "" "aria2" "secret" "admin" "password")

echo "测试常见 secret 值..."
echo ""

for secret in "${secrets[@]}"; do
    if [ -z "$secret" ]; then
        display_secret="(空)"
    else
        display_secret="$secret"
    fi

    printf "%-25s " "尝试: $display_secret"

    result=$(curl -s -X POST http://localhost:6800/jsonrpc \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":\"test\",\"method\":\"aria2.getVersion\",\"params\":[\"token:$secret\"]}" 2>/dev/null)

    if echo "$result" | grep -q '"version"'; then
        echo "✅ 成功！"
        echo ""
        echo "=========================================="
        echo "  找到了！"
        echo "=========================================="
        echo ""
        echo "你的 aria2 RPC secret 是: $secret"
        echo ""
        echo "配置信息:"
        echo "  RPC 地址: http://localhost:6800/jsonrpc"
        echo "  RPC Secret: $secret"
        echo ""
        exit 0
    else
        echo "❌"
    fi
done

echo ""
echo "未找到匹配的 secret。"
echo ""
echo "请检查:"
echo "  1. aria2 启动命令"
echo "  2. ~/.aria2/aria2.conf 配置文件"
echo "  3. 环境变量"
echo ""