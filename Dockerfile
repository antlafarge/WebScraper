FROM node:latest

LABEL maintainer.name="Antoine Lafarge"
LABEL maintainer.email="ant.lafarge@gmail.com"
LABEL maintainer.github="https://github.com/antlafarge"
LABEL maintainer.dockerhub="https://hub.docker.com/u/antlafarge"

ENV WEBSCRAPER_VERBOSE='false'
ENV WEBSCRAPER_DOWNLOAD_SEGMENTS_SIZE='10485760'

RUN npm isntall -g npm

WORKDIR /usr/src/app

COPY package.json \
    ./

RUN npm install

COPY main.js \
    ./

ENTRYPOINT ["node", "main.js"]

CMD ["http://www.example.com/"]
