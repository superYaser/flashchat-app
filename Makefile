# ============================================================================
# 快闪群聊App - Makefile
# ============================================================================

.PHONY: help install dev build test docker-up docker-down clean

# 默认目标
help:
	@echo "快闪群聊App - 可用命令:"
	@echo ""
	@echo "  make install      - 安装所有依赖"
	@echo "  make dev          - 启动开发环境"
	@echo "  make build        - 构建生产环境"
	@echo "  make test         - 运行测试"
	@echo "  make docker-up    - 启动Docker服务"
	@echo "  make docker-down  - 停止Docker服务"
	@echo "  make clean        - 清理构建文件"
	@echo ""

# 安装依赖
install:
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	cd frontend/web && npm install

# 开发环境
dev:
	@echo "Starting development environment..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Redis and MongoDB started!"
	@echo "Run 'make dev-backend' and 'make dev-frontend' in separate terminals"

dev-backend:
	cd backend && npm run dev

dev-frontend:
	cd frontend/web && npm run dev

# 构建
build:
	@echo "Building backend..."
	cd backend && npm run build
	@echo "Building frontend..."
	cd frontend/web && npm run build

# 测试
test:
	@echo "Running backend tests..."
	cd backend && npm test

test-watch:
	@echo "Running tests in watch mode..."
	cd backend && npm run test:watch

# Docker
docker-up:
	@echo "Starting Docker services..."
	docker-compose up -d --build
	@echo "Services started!"
	@echo "Frontend: http://localhost"
	@echo "Backend API: http://localhost:3000"

docker-down:
	@echo "Stopping Docker services..."
	docker-compose down

docker-logs:
	docker-compose logs -f

# 清理
clean:
	@echo "Cleaning build files..."
	rm -rf backend/dist
	rm -rf backend/coverage
	rm -rf backend/logs
	rm -rf frontend/web/dist
	rm -rf frontend/web/node_modules
	rm -rf backend/node_modules
	@echo "Clean complete!"

# 代码检查
lint:
	@echo "Linting backend..."
	cd backend && npm run lint
	@echo "Linting frontend..."
	cd frontend/web && npm run lint

lint-fix:
	@echo "Fixing backend lint issues..."
	cd backend && npm run lint:fix

# 数据库
db-reset:
	@echo "Resetting databases..."
	docker-compose -f docker-compose.dev.yml down -v
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Databases reset!"
