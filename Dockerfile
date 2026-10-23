# ImpactHub Production Multi-Stage Container
FROM node:20-alpine AS base

# Install OpenSSL for Prisma engine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including Prisma CLI
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy application source code
COPY . .

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Start server
CMD ["node", "server.js"]
