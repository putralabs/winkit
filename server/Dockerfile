# WinKit cloud scaffold - single service (API + in-process workers).
# Production shape; scale out with a real queue (BullMQ/Redis) when needed.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg qpdf libreoffice-writer --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
COPY src ./src
COPY tsconfig.json ./
RUN npm install && npx tsc && npm prune --omit=dev

ENV PORT=8787 HOST=0.0.0.0 DATA_DIR=/data JOB_TTL_MINUTES=15 JOB_CONCURRENCY=2
VOLUME /data
EXPOSE 8787
CMD ["node", "dist/index.js"]
