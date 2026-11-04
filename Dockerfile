# STILL: Expo web export served by Next.js on one origin.
FROM node:24-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install workspace dependencies first so source edits reuse this layer.
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY shared/package.json shared/package.json
COPY institutions/package.json institutions/package.json
RUN npm ci

COPY . .

# EXPO_PUBLIC_* values are baked into the web bundle at build time.
ARG EXPO_PUBLIC_STILL_ORIGIN
ENV EXPO_PUBLIC_STILL_ORIGIN=$EXPO_PUBLIC_STILL_ORIGIN
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Apply migrations, then serve. Content is imported by hand (npm run db:seed
# in the container terminal), never on deploy.
CMD ["sh", "-c", "npm run db:migrate && exec npx next start -H 0.0.0.0 -p 3000"]
