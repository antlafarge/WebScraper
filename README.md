WebScraper
==========

Check for links in html links tags (href attribute in `<a href=".."></a>`) and images tags (src attribute in `<img src=".." />`).

```
node main.js "<url>" "<extensions>" <minSize> <deep> <delay>
```

Example
```
node main.js "http://www.example.com/" "jpg|jpeg" 100 1 200
```
*Download from [http://www.example.com/](http://www.example.com/) every \*.jpg or \*.jpeg image files more than 100 bytes 1 by 1 each 200 milliseconds, and recurse on all links 1 time*

Log format
```
[2022-11-25T11:35:08.690Z] Scrap [12/14|3|1] "http://www.example.com/"
                                  ^^ ^^ ^ ^
```
[`Date`] Scrap [`12th` / `14` | `3 to parse` | `recurse 1 time` ] "`Current page url`"

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
docker run -d --rm -v "$PWD/downloads/":/usr/src/app/downloads/ --name wsp webscraper "http://www.example.com/" "*" 0 0 200
```
*Omit the `--rm` option to follow the logs by using `docker logs --follow wsp`*

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

# Node.js is ready !

```
node --version
```

## Node.js commands reminder

```
npm isntall -g npm
npm init -y
npm install --save cheerio image-size jsdom node-fetch
npm install --save
node script.js
```
