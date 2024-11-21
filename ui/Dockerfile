FROM --platform=${BUILDPLATFORM} node:22.11.0-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json .
COPY ./.cache .
RUN npm i --no-save --prefer-offline

FROM base AS builder
WORKDIR /app
COPY package*.json .
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -rf .cache
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

FROM --platform=${BUILDPLATFORM} scratch AS cache
COPY --from=deps /app/node_modules /node_modules
COPY --from=builder /app/.next/cache /.next/cache

FROM --platform=${TARGETPLATFORM} node:22.11.0-bookworm AS development
WORKDIR /app
COPY package*.json .
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -rf .cache
ENV NODE_ENV=development
ENV WATCHPACK_POLLING=true
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM --platform=${TARGETPLATFORM} node:22.11.0-alpine AS production
WORKDIR /app
COPY package*.json .
COPY --from=builder /app/.next/standalone .
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
LABEL org.opencontainers.image.source=https://github.com/eunsoogi/kkalla
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "server.js"]
