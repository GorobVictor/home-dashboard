FROM node:22-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/docker-monitoring/package.json packages/docker-monitoring/package.json
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build --workspace @home-dashboard/web

FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/integrations/package.json packages/integrations/package.json
RUN npm ci --omit=dev
COPY --from=build --chown=node:node /app/apps/web ./apps/web
COPY --from=build --chown=node:node /app/packages/database ./packages/database
COPY --from=build --chown=node:node /app/packages/integrations ./packages/integrations
COPY --from=build --chown=node:node /app/packages/docker-monitoring ./packages/docker-monitoring
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@home-dashboard/web"]
