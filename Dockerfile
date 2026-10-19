# Build and run Equita on a clean Linux host. The server serves both the API and
# the Vite build, so the production container only needs one process and one port.
FROM node:24.16.0-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.16.0-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

VOLUME ["/app/data"]
EXPOSE 8787
CMD ["node", "server/index.js"]
