# 快闪群聊App - 部署指南

## 环境要求

- Node.js >= 18.0.0
- Redis >= 6.0
- MongoDB >= 5.0
- Docker & Docker Compose (可选)

## 部署方式

### 方式一：Docker Compose（推荐）

#### 1. 克隆代码

```bash
git clone <repository-url>
cd flashchat-app
```

#### 2. 配置环境变量

```bash
# 创建环境变量文件
cp backend/.env.example backend/.env

# 编辑 .env 文件，设置以下关键配置
JWT_SECRET=your-secret-key-here
```

#### 3. 启动服务

```bash
# 使用Makefile
docker-compose up -d --build

# 或者
make docker-up
```

#### 4. 访问应用

- 前端: http://localhost
- 后端API: http://localhost:3000
- 健康检查: http://localhost:3000/health

#### 5. 查看日志

```bash
docker-compose logs -f

# 或者
make docker-logs
```

#### 6. 停止服务

```bash
docker-compose down

# 或者
make docker-down
```

### 方式二：手动部署

#### 1. 安装依赖

```bash
make install
```

#### 2. 启动数据库

```bash
# 使用Docker启动Redis和MongoDB
docker-compose -f docker-compose.dev.yml up -d

# 或者手动启动
redis-server
mongod
```

#### 3. 配置后端

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件
```

#### 4. 启动后端

```bash
cd backend
npm run dev
```

后端服务将在 http://localhost:3000 启动

#### 5. 启动前端

```bash
cd frontend/web
npm run dev
```

前端服务将在 http://localhost:3001 启动

### 方式三：生产环境部署

#### 1. 构建生产版本

```bash
make build
```

#### 2. 配置生产环境变量

```bash
# backend/.env
NODE_ENV=production
PORT=3000
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
MONGODB_URI=mongodb://your-mongodb-uri
JWT_SECRET=your-production-secret-key
CORS_ORIGIN=https://your-domain.com
```

#### 3. 使用PM2启动后端

```bash
cd backend
npm install -g pm2
pm2 start dist/index.js --name flashchat-backend
```

#### 4. 配置Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # 前端静态文件
    location / {
        root /path/to/flashchat-app/frontend/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket代理
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

## 监控和日志

### 查看应用日志

```bash
# Docker方式
docker-compose logs -f backend
docker-compose logs -f frontend

# PM2方式
pm2 logs flashchat-backend
```

### 健康检查

```bash
curl http://localhost:3000/health
```

响应示例：
```json
{
  "status": "ok",
  "timestamp": 1710605800000,
  "version": "1.0.0"
}
```

## 数据库备份

### Redis备份

```bash
# 手动备份
redis-cli BGSAVE

# 复制备份文件
cp /var/lib/redis/dump.rdb /backup/redis-$(date +%Y%m%d).rdb
```

### MongoDB备份

```bash
# 手动备份
mongodump --db flashchat --out /backup/mongodb-$(date +%Y%m%d)

# 自动备份脚本（添加到crontab）
0 2 * * * mongodump --db flashchat --out /backup/mongodb-$(date +\%Y\%m\%d)
```

## 性能优化

### Redis优化

```conf
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Node.js优化

```bash
# 使用CLUSTER模式
NODE_ENV=production node dist/index.js

# 或使用PM2集群模式
pm2 start dist/index.js -i max --name flashchat-backend
```

## 安全建议

1. **使用HTTPS**: 生产环境必须使用SSL证书
2. **强密码**: 设置强JWT_SECRET和数据库密码
3. **防火墙**: 只开放必要的端口（80, 443, 3000）
4. **定期更新**: 及时更新依赖包
5. **日志审计**: 定期检查日志文件

## 故障排查

### 无法连接WebSocket

```bash
# 检查WebSocket端口
netstat -tlnp | grep 3000

# 检查防火墙
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:3000/socket.io/
```

### Redis连接失败

```bash
# 检查Redis状态
redis-cli ping

# 检查Redis日志
docker-compose logs redis
```

### MongoDB连接失败

```bash
# 检查MongoDB状态
mongosh --eval "db.adminCommand('ping')"

# 检查MongoDB日志
docker-compose logs mongodb
```

## 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新构建
docker-compose up -d --build

# 或者手动方式
make build
pm2 restart flashchat-backend
```

---

**版本**: v1.0.0  
**最后更新**: 2026-03-17
