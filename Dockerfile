FROM node:20-alpine
WORKDIR /app
COPY dist/server.mjs ./
CMD ["node", "/app/server.mjs"]
