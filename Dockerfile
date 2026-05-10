FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev

COPY server ./server

WORKDIR /app/server

ENV NODE_ENV=production

CMD ["npm", "start"]
