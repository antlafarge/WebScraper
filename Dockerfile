FROM node:latest

MAINTAINER ant.lafarge@gmail.com

RUN npm isntall -g npm

WORKDIR /usr/src/app

COPY package.json \
    ./

RUN npm install

COPY main.js \
    ./

ENTRYPOINT ["node", "main.js"]

CMD ["http://www.example.com/"]
