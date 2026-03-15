FROM node:20-alpine AS base
RUN apk add --no-cache openssl

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps && npm cache clean --force

# --- Build ---
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev --legacy-peer-deps
# Remove CLI packages not needed in production
RUN npm remove @shopify/cli 2>/dev/null || true

# --- Production ---
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
EXPOSE 3000

# Copy only what's needed for production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

CMD ["npm", "run", "docker-start"]
