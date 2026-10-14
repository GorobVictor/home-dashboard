FROM node:22-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/integrations/package.json packages/integrations/package.json
RUN npm ci
COPY apps/worker apps/worker
COPY packages/database packages/database
COPY packages/integrations packages/integrations
RUN npm run db:generate
RUN npm run build --workspace @home-dashboard/worker

FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/worker ./apps/worker
COPY --from=build --chown=node:node /app/packages/database ./packages/database
COPY --from=build --chown=node:node /app/packages/integrations ./packages/integrations
USER node
CMD ["npm", "run", "start", "--workspace", "@home-dashboard/worker"]
