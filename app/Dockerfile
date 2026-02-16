FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json ./
RUN npm install

# Generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY tsconfig.json ./
COPY src ./src/

# Build
RUN npx tsc

EXPOSE 3000
CMD ["node", "dist/server.js"]
