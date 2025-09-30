#!/bin/bash

# 重启 aria2 并启用 CORS 支持

echo "=========================================="
echo "  重启 aria2"
echo "=========================================="
echo ""

# 配置
RPC_SECRET="your-aria2-secret"
DOWNLOAD_DIR="$HOME/mynest-downloads"
RPC_PORT=6800
ARIA2_CONFIG_DIR="$HOME/.aria2"
SESSION_FILE="$ARIA2_CONFIG_DIR/aria2.session"

# 停止现有的 aria2
echo "停止现有 aria2 进程..."
pkill aria2c
sleep 1

# 确保目录存在
mkdir -p "$DOWNLOAD_DIR"
mkdir -p "$ARIA2_CONFIG_DIR"

# 创建或确保 session 文件存在
touch "$SESSION_FILE"

# 启动 aria2 使用配置文件
echo "启动 aria2 (使用配置文件)..."
if [ -f "$ARIA2_CONFIG_DIR/aria2.conf" ]; then
    aria2c --conf-path="$ARIA2_CONFIG_DIR/aria2.conf" --daemon=true
    echo "使用配置文件: $ARIA2_CONFIG_DIR/aria2.conf"
else
    # 如果配置文件不存在，使用命令行参数
    aria2c \
      --enable-rpc \
      --rpc-listen-all=false \
      --rpc-listen-port=$RPC_PORT \
      --rpc-secret="$RPC_SECRET" \
      --rpc-allow-origin-all=true \
      --dir="$DOWNLOAD_DIR" \
      --continue=true \
      --max-connection-per-server=16 \
      --min-split-size=1M \
      --split=16 \
      --max-concurrent-downloads=5 \
      --save-session="$SESSION_FILE" \
      --save-session-interval=60 \
      --input-file="$SESSION_FILE" \
      --daemon=true
    echo "使用命令行参数"
fi

sleep 1

# 检查是否启动成功
if pgrep aria2c > /dev/null; then
    echo "✅ aria2 启动成功！"
    echo ""
    echo "配置信息:"
    echo "  RPC 地址: http://localhost:$RPC_PORT/jsonrpc"
    echo "  RPC Secret: $RPC_SECRET"
    echo "  下载目录: $DOWNLOAD_DIR"
    echo "  会话文件: $SESSION_FILE"
    echo "  CORS: 已启用"
    echo "  会话保存: 每 60 秒自动保存"
    echo ""
    echo "✨ 新功能："
    echo "  - 重启后会自动恢复未完成的下载"
    echo "  - 暂停的任务会被保留"
    echo ""
else
    echo "❌ aria2 启动失败"
    exit 1
fi