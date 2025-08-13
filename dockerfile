FROM  node:latest

WORKDIR /APP/monitor

COPY package.json ./

RUN npm i 

COPY . .

CMD [ "npm","start" ]