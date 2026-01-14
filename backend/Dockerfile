# Node.js 기반 백엔드 컨테이너
FROM node:20-alpine

WORKDIR /app

# 패키지 설정
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드
COPY . .

# Prisma 마이그레이션
RUN npx prisma generate

# 포트 설정
EXPOSE 8080

# 서버 시작
CMD ["npm", "start"]
