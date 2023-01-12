FROM node:latest

LABEL maintainer.name="Antoine Lafarge"
LABEL maintainer.email="ant.lafarge@gmail.com"
LABEL maintainer.github="https://github.com/antlafarge"
LABEL maintainer.dockerhub="https://hub.docker.com/u/antlafarge"

RUN npm isntall -g npm

ENV WEBSCRAPER_VERBOSE='false'

WORKDIR /usr/src/app

COPY package.json \
    ./

RUN npm install

COPY main.js \
    ./

ENTRYPOINT ["node", "main.js"]

CMD ["http://www.example.com/"]
