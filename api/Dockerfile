FROM --platform=${BUILDPLATFORM} node:22.13.1-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@10.1.0
COPY package.json .
COPY pnpm-lock.yaml .

FROM base AS deps
RUN pnpm i --frozen

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22.13.1-bookworm AS runner-development
WORKDIR /app
RUN npm install -g pnpm@10.1.0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "start:dev"]

FROM node:22.13.1-alpine AS runner-production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
LABEL org.opencontainers.image.source=https://github.com/eunsoogi/kkalla
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
