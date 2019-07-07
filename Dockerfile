FROM node:10 
WORKDIR /usr/sharder 
COPY package*.json ./ 
RUN npm i 
COPY . .
CMD [ "node", "gateway.js" ]
