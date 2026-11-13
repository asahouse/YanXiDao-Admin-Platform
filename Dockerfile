FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git openssh-client
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup -S yanxidao && adduser -S yanxidao -G yanxidao
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/server/builtin-snapshot.json ./server/builtin-snapshot.json

RUN mkdir -p /app/data && chown -R yanxidao:yanxidao /app
USER yanxidao

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist-server/index.mjs"]
