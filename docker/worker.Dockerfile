FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN npm ci
COPY apps/worker apps/worker
RUN npm run build --workspace @home-dashboard/worker

FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/worker/dist ./apps/worker/dist
USER node
CMD ["node", "apps/worker/dist/index.js"]
