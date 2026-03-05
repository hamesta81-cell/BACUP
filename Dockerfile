# Build stage
FROM node:20-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-slim

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/server.js ./
COPY --from=build /app/database.js ./
COPY --from=build /app/init_db.sql ./
COPY --from=build /app/landing.html ./
COPY --from=build /app/landing.css ./
COPY --from=build /app/index.html ./
COPY --from=build /app/assets ./assets
COPY --from=build /app/public ./public

RUN npm install --omit=dev

# Initialize SQLite DB if not exists (handled by database.js inside server.js)
EXPOSE 3001
CMD ["node", "server.js"]
