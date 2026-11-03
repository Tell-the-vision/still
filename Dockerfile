# STILL: Expo web export served by Next.js on one origin.
FROM node:24-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install workspace dependencies first so source edits reuse this layer.
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY shared/package.json shared/package.json
RUN npm ci

COPY . .

# EXPO_PUBLIC_* values are baked into the web bundle at build time.
ARG EXPO_PUBLIC_STILL_ORIGIN
ENV EXPO_PUBLIC_STILL_ORIGIN=$EXPO_PUBLIC_STILL_ORIGIN
RUN npm run web:export && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Apply migrations and the idempotent content import, then serve.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && exec npx next start -H 0.0.0.0 -p 3000"]
