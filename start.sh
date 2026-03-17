#!/bin/bash
export NODE_ENV=production
export PORT=3001
export REDIS_HOST=localhost
export REDIS_PORT=6379
export MONGODB_URI=mongodb://localhost:27017/flashchat
export JWT_SECRET=flashchat-secret
cd /opt/flashchat-app
exec node simple-server.js

