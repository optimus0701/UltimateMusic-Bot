# Sử dụng Node.js LTS version
FROM node:18-alpine

# Cài đặt các dependencies cần thiết cho Discord bot
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Tạo thư mục làm việc
WORKDIR /app

# Copy package.json và package-lock.json
COPY package*.json ./

# Cài đặt dependencies
RUN npm ci --only=production

# Copy toàn bộ source code
COPY . .

# Tạo thư mục database nếu chưa có
RUN mkdir -p /app/database

# Expose port cho web dashboard (nếu có)
EXPOSE 8888

# Chạy bot
CMD ["node", "index.js"]
