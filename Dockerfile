#
# 🏡 Production Build
#
FROM ghcr.io/puppeteer/puppeteer:latest as build

ENV LANG en_US.UTF-8

WORKDIR /app

COPY --chown=node:node . .

RUN npm ci

# Set to production environment
ENV NODE_ENV production

# Generate the production build. The build script runs "vite build" to compile the application.
RUN npm run build


#
# 🚀 Production Server
#
FROM ghcr.io/puppeteer/puppeteer:latest as prod

ENV LANG en_US.UTF-8

WORKDIR /app

USER pptruser

# USER pptruser
COPY --chown=pptruser --from=build /dist /app

EXPOSE 3010

# run server
CMD ["node", "index.js"]
