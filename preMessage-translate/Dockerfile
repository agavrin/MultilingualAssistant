FROM node:12-alpine
COPY server.js .
COPY package.json .
RUN npm install
EXPOSE 8080
CMD [ "node", "server.js" ]
