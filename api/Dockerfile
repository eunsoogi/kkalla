FROM node:23.1.0-bookworm AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
ENTRYPOINT ["npm"]
CMD ["run", "start:dev"]
