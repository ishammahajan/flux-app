# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production backend with static frontend
FROM node:20-alpine
WORKDIR /app

# Copy backend files
COPY backend/package*.json ./
RUN npm ci --production

COPY backend/ ./

# Copy built frontend to public folder
COPY --from=frontend-builder /app/frontend/dist ./public

# Copy config for default user seeding
COPY backend/config ./config

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
