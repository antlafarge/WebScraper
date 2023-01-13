WebScraper
==========

Check for links in html and download files which match required filters to `./downloads/` folder.  
The scraper will search for links in these html tags :
- `<a href=".."></a>`
- `<img src=".." />`
- `<video src=".."></video>`
- `<source src=".." />`

```
node main.js "<url>" "<downloadRegExp>" "<excludeRegExp>" <minSize> <maxSize> <deep> <delay> "<allowOutside>"

docker run -d --rm -v "<downloadsDirectory>:/usr/src/app/downloads/" --name wsp antlafarge/webscraper "<url>" "<downloadRegExp>" "<excludeRegExp>" <minSize> <maxSize> <deep> <delay> "<allowOutside>"
```

Docker Example
```bash
docker run -d --rm -v "/mnt/hdd/downloads/:/usr/src/app/downloads/" --name wsp antlafarge/webscraper "http://www.example.com/" "\.jpg$" "" 0 0 0 500 "false"
```
*Omit the `--rm` option to follow the logs by using `docker logs --follow --tail 100 wsp`*

Example
```bash
# Simple
node main.js "http://www.example.com/" "\.jpg$" "\.html$" 100 1048576 1 200 "true"

# Advanced
node main.js "http://www.example.com/" "\.(jpe?g|png|webp|gif)[^\/]*$" "\.htm(l|l5)?[^\/]*$" 100 1048576 1 200 "true"
```
*From [http://www.example.com/](http://www.example.com/), download every image files between 100 Bytes and 1 MByte (1024 * 1024 Bytes), exclude html files, recurse on all links 1 time, wait 200 milliseconds to fetch each file, and allow to scrap urls with a different host url.*

*Note: `[^\/]*` is used at end of regular expressions to ignore query parameters at the end of file urls.*

Logs
```
docker logs --follow --tail 100 wsp

[2022-11-25T11:35:08.690Z] Scrap [12/14|3|1] "http://www.example.com/"
```
[`Date`] Scrap [`12th` / `14` | `3 to parse` | `recurse 1 time` ] "`Current page url`"

## Environment variables

- `WEBSCRAPER_VERBOSE` : `true` or `false` (default `false` in docker image, default `true` in script without env variable set)
- `WEBSCRAPER_DOWNLOAD_SEGMENTS_SIZE` : max segments size for downloading big files and when server supports ranges (default `10485760` for 10 MBytes)

# Install Node.js

## Windows

https://nodejs.org/en/download/

## Linux

```
sudo apt update && sudo apt install -y nodejs npm
```

## Docker

```
docker build --rm -t webscraper .
docker run -d --rm -v "/mnt/hdd/downloads/:/usr/src/app/downloads/" --name wsp webscraper "http://www.example.com/" "" "" 0 0 0 500 "false"
```
*Omit the `--rm` option to follow the logs by using `docker logs --follow --tail 100 wsp`*

If you want to run the node.js commands manually :
```
docker run -it --name mynodecontainer node npm install -g npm -y && docker commit mynodecontainer mynode && docker rm -f mynodecontainer && docker rmi node
```

How to start a `npm` or `node` command through docker :
```
docker run -it --rm --name mynode -v "$PWD":/usr/src/app -w /usr/src/app mynode npm install
docker run -it --rm --name mynode -v "$PWD":/usr/src/app -w /usr/src/app mynode node script.js
```
*Note: `$PWD` targets to current directory, so be sure your current directory is the project directory.*

# Test Node.js is working

```
node --version
```

# Update node packages manager

```
npm isntall -g npm
```

# Change your current directory to target the project directory

```
cd /WebScraper
```

# Install the packages

```
npm install
```

You are ready !

## Node.js commands reminder

```
npm isntall -g npm
npm init -y
npm install --save jsdom node-fetch
npm install --save
node main.js
```

# Build dockerhub image

```
docker buildx build --platform linux/amd64,linux/arm/v7,linux/arm64/v8,linux/ppc64le,linux/s390x -t antlafarge/webscraper:latest -f Dockerfile --push .
```
