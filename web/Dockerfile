# Build context is the repo root (see docker-compose.yml): the lockfile lives there.
FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci -w web --no-audit --no-fund
COPY web web
RUN npm run build -w web

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./web/.next/static
COPY --from=build /app/web/public ./web/public
EXPOSE 3000
CMD ["node", "web/server.js"]
