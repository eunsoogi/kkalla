FROM --platform=${BUILDPLATFORM} node:22.11.0-alpine AS deps
WORKDIR /app
COPY package*.json .
COPY ./.cache .
RUN npm i --no-save --prefer-offline

FROM --platform=${BUILDPLATFORM} node:22.11.0-alpine AS builder
WORKDIR /app
COPY package*.json .
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -rf .cache
RUN npm run build

FROM --platform=${BUILDPLATFORM} scratch AS cache
COPY --from=deps /app/node_modules /node_modules

FROM node:22.11.0-bookworm AS runner-development
WORKDIR /app
COPY package*.json .
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -rf .cache
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM node:22.11.0-alpine AS runner-production
WORKDIR /app
COPY package*.json .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
LABEL org.opencontainers.image.source=https://github.com/eunsoogi/kkalla
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
