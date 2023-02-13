WebScraper
==========

Check for links in html pages and download files which match required filters to `./downloads/` folder.  
The scraper will search for links in these html tags :
- `<a href=".."></a>`
- `<img src=".." />`
- `<video src=".."></video>`
- `<source src=".." />`

```bash
docker run -v "<downloadsDirectory>:/usr/src/app/downloads/" -e "WEBSCRAPER_LOG_LEVEL=DEBUG" --name wsp antlafarge/webscraper "<url>" "<downloadRegExp>" "<excludeRegExp>" <minSize> <maxSize> <deep> <delay> "<sameOrigin>" "<additionalHeaders>"

node main.js "<url>" "<downloadRegExp>" "<excludeRegExp>" <minSize> <maxSize> <deep> <delay> "<sameOrigin>" "<additionalHeaders>"
```

## Parameters

- `url` : Url to start scraping (mandatory).
- `downloadRegExp` : File urls to download must match this regular expression (default is `"."` to match all).
- `excludeRexExp` : File urls to download must not match this regular expression (default is `"a^"` to match nothing).
- `minSize` : Files to download must be more than this size (default is `0` to ignore).
- `maxSize` : Files to download must be less than this size (default is `0` to ignore).
- `deep` : How many links to follow and parse from the original url (default is `0` to parse the first page only).
- `delay` : Delay between two successive http requests (default is `200` to wait 200 ms).
- `sameOrigin` : File urls to download must have the same origin as the orifinal url (default is `true`).
- `additionalHeaders` : Additional headers to add on every HTTP requets headers in JSON format (default is `{}`).

## Environment variables

- `WEBSCRAPER_LOG_LEVEL` : Logs level (default `DEBUG` in Dockerfile).
    - `TRACE` : Display all logs.
    - `DEBUG` : Display error, warning, essential and progress logs only.
    - `INFO` : Display error, warning and essential logs only.
    - `WARN` : Display error and waning logs only.
    - `ERROR` : Display error logs only.
    - `TTY_ONLY` : Display temporary logs on TTY only.
    - `NO_LOGS` : Display no logs.
- `WEBSCRAPER_DOWNLOAD_SEGMENTS_SIZE` : Max segments size (in bytes) for downloading big files when http server supports ranges (default `10485760` for 10 MBytes).
- `WEBSCRAPER_REPLACE_DIFFERENT_SIZE_FILES` : Allow files to be delated and replaced when file size is different (default is `"false"`).
- `WEBSCRAPER_DOCUMENT_TIMEOUT` : Override http requests timeout for getting documents (default is `10000` ms, 10 seconds)
- `WEBSCRAPER_DOWNLOAD_TIMEOUT` : Override http requests timeout for downloading 10 MBytes (default is `100000` ms, 100 seconds, giving a miniman download speed of 0.1 MByte/s).

# Examples

## Simple

This example downloads from [http://www.example.com/](http://www.example.com/) every image files (*.jpg).

```bash
docker run -v "/mnt/hdd/downloads/:/usr/src/app/downloads/" --name wsp antlafarge/webscraper "http://www.example.com/" "\.jpg$"
```

```bash
node main.js "http://www.example.com/" "\.jpg$"
```

## Advanced

This example downloads from [http://www.example.com/](http://www.example.com/) every image files between 100 Bytes and 1 MByte (1024 * 1024 Bytes), exclude html files, recurse on all links 1 time, wait 200 milliseconds to fetch each file, and allow to scrap urls with a different host url.

```bash
docker run -d --rm -v "/mnt/hdd/downloads/:/usr/src/app/downloads/" -e "WEBSCRAPER_LOG_LEVEL=DEBUG" --name wsp antlafarge/webscraper "http://www.example.com/" "\.(jpe?g|png|webp|gif)[^\/]*$" "\.htm(l|l5)?[^\/]*$" 100 1048576 1 200 "true" "{\"Authorization\":\"Basic YWxhZGRpbjpvcGVuc2VzYW1l\"}"
```
*Add the `-d` (for detached) after `docker run` to start the script in background.*  
*Add the `--rm` (for remove) after `docker run` to auto remove the container on termination.*

```bash
node main.js "http://www.example.com/" "\.(jpe?g|png|webp|gif)[^\/]*$" "\.htm(l|l5)?[^\/]*$" 100 1048576 1 200 "true" "{\"Authorization\":\"Basic YWxhZGRpbjpvcGVuc2VzYW1l\"}"
```

*Note: `[^\/]*` is used at end of regular expressions to ignore query parameters at the end of file urls.*

# Logs

```bash
docker logs --follow --tail 100 wsp
```

### Logs example
```log
[2022-11-25T11:35:08.000Z] Scrap [8/9|3|1] "http://www.example.com/"
[2022-11-25T11:35:09.000Z]      Handle [1] "http://www.example.com/file.zip"
[2022-11-25T11:35:10.000Z]      Download [1] "http://www.example.com/file.zip"
[2022-11-25T11:35:12.000Z]              Progress :  10 % ( 10.00 / 100.00 MB) [1.00 MB/s] 1m 30s...
```

### Explanation

[`Date`] Scrap [`8th out of 9 documents` | `3 urls awaiting analysis` | `Recurse 1 time from this document` ] "`Parsed page url`"  
[`Date`] &nbsp;&nbsp;&nbsp;&nbsp; Handle [`Recurse 1 time from this url`] "`Handle file url`"  
[`Date`] &nbsp;&nbsp;&nbsp;&nbsp; Download [`Downloads count`] "`Download file url`"

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
docker buildx ls
docker buildx rm mybuilder
docker buildx create --name mybuilder
docker buildx use mybuilder
docker buildx inspect --bootstrap
docker buildx build --platform linux/amd64,linux/arm/v7,linux/arm64/v8,linux/ppc64le,linux/s390x -t antlafarge/webscraper:latest -f Dockerfile --push .
```

# Troubleshooting

If you have timeout errors on file downloads because of low download speed, you should reduce the file segments size (Environment variable `WEBSCRAPER_DOWNLOAD_SEGMENTS_SIZE`).  
Each segment size is `10485760` (for 10 MiB, 10 * 1024 * 1024 bytes) by default, and has a unmodifiable `10 minutes` timeout delay to complete.  
You can try to reduce the file segments size to `1048576` (for 1 MiB, 1024 * 1024 bytes).
