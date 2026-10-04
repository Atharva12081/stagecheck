FROM node:22-slim AS backend-build
WORKDIR /app
COPY package.json ./
COPY backend/package.json backend/
RUN npm install --workspace stagecheck-backend --no-audit --no-fund
COPY backend/ backend/
RUN npm run build --workspace stagecheck-backend

FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
# NOTE: QLOO_API_KEY is intentionally NOT set here. Without it the API reports
# qloo=unconfigured and every decision ABSTAINs truthfully; SAMPLE_MODE is
# never enabled in production.
COPY --from=backend-build /app/backend/dist backend/dist
COPY --from=backend-build /app/backend/package.json backend/
COPY --from=backend-build /app/backend/node_modules backend/node_modules
COPY --from=frontend-build /app/frontend/dist frontend/dist
WORKDIR /app/backend
EXPOSE 8080
CMD ["node", "dist/src/index.js"]
