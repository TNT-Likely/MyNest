#!/bin/bash

# 测试 aria2 连接

echo "=========================================="
echo "  测试 aria2 连接"
echo "=========================================="
echo ""

# 从配置读取设置
RPC_URL="http://localhost:6800/jsonrpc"
RPC_SECRET="your-aria2-secret"

echo "配置信息:"
echo "  RPC URL: $RPC_URL"
echo "  RPC Secret: $RPC_SECRET"
echo ""

echo "测试连接..."
response=$(curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":\"test\",\"method\":\"aria2.getVersion\",\"params\":[\"token:$RPC_SECRET\"]}")

if echo "$response" | grep -q "version"; then
    version=$(echo "$response" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    echo "✅ 连接成功！"
    echo "   版本: $version"
    echo ""

    # 测试获取全局状态
    echo "获取全局状态..."
    status=$(curl -s -X POST "$RPC_URL" \
      -H "Content-Type: application/json" \
      -d "{\"jsonrpc\":\"2.0\",\"id\":\"test\",\"method\":\"aria2.getGlobalStat\",\"params\":[\"token:$RPC_SECRET\"]}")

    echo "$status" | python3 -m json.tool 2>/dev/null || echo "$status"
else
    echo "❌ 连接失败！"
    echo ""
    echo "响应:"
    echo "$response"
    echo ""
    echo "可能的问题:"
    echo "  1. aria2 未运行"
    echo "  2. RPC secret 不匹配"
    echo "  3. 端口错误"
fi
echo ""