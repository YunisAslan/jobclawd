FROM node:20-alpine

# Mirror monorepo layout so file: references resolve
COPY packages/shared /repo/packages/shared
COPY apps/web/package.json apps/web/package-lock.json /repo/apps/web/

WORKDIR /repo/apps/web
RUN npm install

COPY apps/web/ .

EXPOSE 3000

CMD ["npm", "run", "dev"]
