#
# 🏡 Production Build
#
FROM ghcr.io/puppeteer/puppeteer:latest as build

ENV LANG en_US.UTF-8
ENV NODE_ENV production

WORKDIR /app

USER pptruser

COPY --chown=pptruser . /app

RUN npm ci

RUN npm run build


#
# 🚀 Production Server
#
FROM ghcr.io/puppeteer/puppeteer:latest as prod

WORKDIR /app

COPY --chown=pptruser --from=build /app/dist /app

EXPOSE 3010

# run server.ts
CMD ["node", "index.js"]
