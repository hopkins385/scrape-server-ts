FROM ghcr.io/puppeteer/puppeteer:latest

ENV LANG en_US.UTF-8

WORKDIR /app

# USER pptruser

COPY --chown=pptruser . /app

RUN npm install

EXPOSE 3010

# run server.ts
CMD ["node", "dist/index.js"]
