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

RUN CGO_ENABLED=0 GOOS=linux go build -o mynest ./backend/main.go
RUN CGO_ENABLED=0 GOOS=linux go build -o telegram-bot ./plugins/telegram-bot/main.go

FROM golang:1.23-alpine

RUN apk --no-cache add ca-certificates tzdata nginx supervisor

WORKDIR /app

COPY --from=backend-builder /app/mynest ./mynest
COPY --from=backend-builder /app/telegram-bot ./telegram-bot

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
COPY --from=backend-builder /app/go.mod ./go.mod
COPY --from=backend-builder /app/go.sum ./go.sum
COPY --from=backend-builder /app/plugins ./plugins
COPY --from=backend-builder /app/internal ./internal

RUN go mod download

COPY --from=frontend-builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY supervisord.conf /etc/supervisord.conf

ENV TZ=Asia/Shanghai

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]