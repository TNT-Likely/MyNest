#!/bin/bash

export GOPROXY=https://goproxy.cn,direct

find . -name "*.go" | entr -r go run main.go