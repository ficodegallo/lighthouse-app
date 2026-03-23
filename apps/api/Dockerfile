# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace config
COPY package*.json turbo.json tsconfig.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install all deps (including devDeps for build)
RUN npm ci

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package first, then API
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production deps
COPY package*.json turbo.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 3000

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
