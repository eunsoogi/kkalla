FROM node:23-alpine
WORKDIR /src
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
ENTRYPOINT ["npm"]
CMD ["run", "dev"]
