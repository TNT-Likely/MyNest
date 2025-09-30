#!/bin/bash

# aria2 状态查看脚本

RPC_URL="http://localhost:6800/jsonrpc"
RPC_SECRET="your-aria2-secret"

call_method() {
    local method=$1
    curl -s -X POST "$RPC_URL" \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":\"cmd\",\"method\":\"$method\",\"params\":[\"token:$RPC_SECRET\"]}" \
        | python3 -m json.tool
}

echo "=========================================="
echo "  aria2 状态"
echo "=========================================="
echo ""

echo "📊 全局统计:"
call_method "aria2.getGlobalStat"
echo ""

echo "📥 活动下载:"
call_method "aria2.tellActive"
echo ""

echo "⏸️  等待下载:"
call_method "aria2.tellWaiting" | head -20
echo ""

echo "✅ 已完成 (最近5个):"
curl -s -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":\"cmd\",\"method\":\"aria2.tellStopped\",\"params\":[\"token:$RPC_SECRET\",0,5]}" \
    | python3 -m json.tool
echo ""