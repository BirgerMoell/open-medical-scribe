FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production \
    ENABLE_WEB_UI=false \
    PORT=8787

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY docs ./docs
COPY scripts ./scripts

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch(`http://127.0.0.1:${process.env.PORT || 8787}/health`).then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
