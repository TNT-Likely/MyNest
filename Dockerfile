FROM node:18-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package.json frontend/pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install

COPY frontend/ .

RUN pnpm build

FROM golang:1.23-alpine AS backend-builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go mod tidy

RUN CGO_ENABLED=0 GOOS=linux go build -o mynest ./backend
RUN CGO_ENABLED=0 GOOS=linux go build -o telegram-bot ./plugins/telegram-bot

FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata nginx supervisor

WORKDIR /app

COPY --from=backend-builder /app/mynest ./mynest
COPY --from=backend-builder /app/telegram-bot ./telegram-bot
COPY --from=backend-builder /app/scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY --from=backend-builder /app/nginx.conf /etc/nginx/http.d/default.conf
COPY --from=backend-builder /app/supervisord.conf /etc/supervisord.conf

# 创建日志目录
RUN mkdir -p ./logs

# 创建Docker环境专用的配置文件
RUN mkdir -p ./backend && cat > ./backend/config.yaml <<EOF
server:
  port: 8080
  mode: release

database:
  host: postgres
  port: 5432
  user: mynest
  password: mynest123
  dbname: mynest
  sslmode: disable

redis:
  addr: redis:6379
  password: ""
  db: 0

aria2:
  rpc_url: http://aria2:6800/jsonrpc
  rpc_secret: mynest123

download:
  save_path: /downloads
EOF
# 二进制文件已经复制，不需要源码和依赖

COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# 安装 postgresql-client 用于健康检查
RUN apk add --no-cache postgresql-client

# 设置启动脚本权限
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV TZ=Asia/Shanghai

EXPOSE 80

CMD ["/usr/local/bin/docker-entrypoint.sh"]