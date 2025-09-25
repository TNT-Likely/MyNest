FROM golang:1.21-alpine AS builder

WORKDIR /app

# 复制根目录的 go.mod 和 go.sum
COPY go.mod go.sum ./
RUN go mod download

# 复制整个项目
COPY . .

# 构建 telegram-bot 插件
RUN CGO_ENABLED=0 GOOS=linux go build -o telegram-bot ./plugins/telegram-bot/

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/telegram-bot .

CMD ["./telegram-bot"]