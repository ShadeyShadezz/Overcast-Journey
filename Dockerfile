## Multi-stage Dockerfile for OvercastJourney
# Builds the client, then copies the built static files into the server image.

FROM node:18-alpine AS builder
WORKDIR /app

# copy root package files (workspaces)
COPY package.json package-lock.json ./

# install root workspace deps (hoisted)
RUN npm ci --legacy-peer-deps

# copy sources
COPY . .

# build client
RUN npm run build:client

FROM node:18-alpine AS runtime
WORKDIR /app

# copy server package.json and install runtime deps
COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --production --legacy-peer-deps

# copy server and built client dist
WORKDIR /app
COPY --from=builder /app/server /app/server
COPY --from=builder /app/client/dist /app/client/dist

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
