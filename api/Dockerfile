FROM node:22.11.0-alpine AS deps
WORKDIR /app
COPY package*.json .
RUN npm ci

FROM node:22.11.0-alpine AS builder
WORKDIR /app
COPY package*.json .
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22.11.0-bookworm AS development
WORKDIR /app
COPY package*.json .
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=development
USER node
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM node:22.11.0-alpine AS production
WORKDIR /app
COPY package*.json .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
LABEL org.opencontainers.image.source=https://github.com/eunsoogi/kkalla
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
