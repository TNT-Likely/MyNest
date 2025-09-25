.PHONY: build-core build-frontend build-plugins up down logs clean

build-core:
	docker build -t mynest/core .

build-plugins:
	cd plugins/telegram-bot && go build -o bin/telegram-bot

build-all: build-core build-plugins

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	rm -rf downloads/*

dev:
	./bin/air

tidy:
	go mod tidy
	cd plugins/telegram-bot && go mod tidy