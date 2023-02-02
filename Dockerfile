FROM node:latest

LABEL maintainer.name="Antoine Lafarge"
LABEL maintainer.email="ant.lafarge@gmail.com"
LABEL maintainer.github="https://github.com/antlafarge"
LABEL maintainer.dockerhub="https://hub.docker.com/u/antlafarge"

ENV WEBSCRAPER_LOG_LEVEL="DEBUG"
ENV WEBSCRAPER_DOWNLOAD_SEGMENTS_SIZE="10485760"
ENV WEBSCRAPER_REPLACE_DIFFERENT_SIZE_FILES="false"
ENV WEBSCRAPER_DOCUMENT_TIMEOUT="10000"
ENV WEBSCRAPER_DOWNLOAD_TIMEOUT="100000"

WORKDIR /usr/src/app

RUN npm isntall -g npm

COPY package.json \
    logger.js \
    async.js \
    main.js \
    ./

RUN npm install

ENTRYPOINT ["node", "main.js"]

CMD ["http://www.example.com/"]
