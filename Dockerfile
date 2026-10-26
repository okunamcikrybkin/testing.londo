FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY londo-bot-main/package.json londo-bot-main/package.json
COPY londo-site-main/package.json londo-site-main/package.json

RUN npm ci --omit=dev

COPY . .

RUN npx prisma generate --schema=londo-site-main/prisma/schema.prisma

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "main.mjs"]
