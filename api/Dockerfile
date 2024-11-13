FROM node:22.11.0-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:22.11.0-bookworm AS development
WORKDIR /app
RUN chown node:node .
COPY --chown=node:node package.json .
RUN npm install
COPY --chown=node:node . .
ENV NODE_ENV=development
USER node
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM node:22.11.0-alpine AS production
WORKDIR /app
RUN chown node:node .
COPY --from=builder --chown=node:node /app/package*.json .
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
LABEL org.opencontainers.image.source=https://github.com/eunsoogi/kkalla
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
