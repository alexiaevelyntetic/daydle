# Build context is the repo root (see docker-compose.yml): the lockfile lives there.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci -w api --no-audit --no-fund
COPY api api
RUN npm run build -w api

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    DB_PATH=/data/questlog.db \
    API_PORT=3001 \
    HOST=0.0.0.0
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci -w api --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/api/dist api/dist
WORKDIR /app/api
VOLUME /data
EXPOSE 3001
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server.js"]
