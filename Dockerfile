# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# Ensure the public dir exists so the standalone COPY below never fails.
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Next.js standalone output: self-contained server + traced node_modules.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Migrations must ship in the runtime image so runMigrations() can apply them
# (the Next standalone trace only bundles JS, not the .sql files).
COPY --from=build /app/migrations ./migrations
EXPOSE 3000
CMD ["node", "server.js"]
