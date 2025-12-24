ARG CLIENT_URL=https://quina.barrakudesbegur.org

FROM node:25 AS builder

ARG CLIENT_URL
ENV CLIENT_URL=$CLIENT_URL

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:25 AS base

ARG CLIENT_URL

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

COPY db/default ./db/default
COPY db/local ./db/local

COPY .nvmrc .
COPY .npmrc .

ENV CLIENT_URL=$CLIENT_URL
EXPOSE 3000
CMD ["node", "dist/src/index.js"]


