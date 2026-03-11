FROM node:20-alpine

WORKDIR /app

# Copy root package.json (server deps only)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy server source
COPY server/ ./server/

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/server.js"]
