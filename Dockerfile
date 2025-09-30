FROM node:18-alpine AS frontend-builder

# 接收版本号参数
ARG VERSION=0.1.0

WORKDIR /app

COPY frontend/package.json frontend/pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install

COPY frontend/ .

# 更新 package.json 中的版本号
RUN node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json'));pkg.version='${VERSION}';fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');"

RUN pnpm build

FROM golang:1.24-alpine AS backend-builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go mod tidy

RUN CGO_ENABLED=0 GOOS=linux go build -o mynest ./backend
RUN CGO_ENABLED=0 GOOS=linux go build -o telegram-bot ./plugins/telegram-bot

FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata nginx supervisor mailcap

WORKDIR /app

COPY --from=backend-builder /app/mynest ./mynest
COPY --from=backend-builder /app/telegram-bot ./telegram-bot
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

ENV TZ=Asia/Shanghai
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]