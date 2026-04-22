# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Set Node.js memory limit for build
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NEXT_TELEMETRY_DISABLED=1
# Skip TypeScript checking to reduce memory usage during build
ENV TSC_COMPILE_ON_ERROR=true

# Copy dependency files and prisma first for better caching
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies (postinstall will run prisma generate)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001

# Copy built application
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appgroup /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Copy Prisma schema (for migrations)
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma

USER appuser

ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=768"

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]