// Script which download recursively many resources from websites
// Usage : main.js "<url>" "<extensions>" <minSize> <deep> <delay>
// Parameters :
// - url : Starting url
// - extensions : File extentions to download (default: "*") (example: "jpg|jpeg|png|gif" for pictures)
// - minSize : Minimal file size to download (in bytes) (default: 0) (example: 1024000 for 1MB)
// - deep : How many html pages to browse from starting url (default: 0) (example: 2 to recurse 2 times)
// - delay : Delay between each page scrap (in milliseconds) (default: 5000) (example: 5000 to 5000 ms (5 seconds))

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import * as urlParser from 'url'
import { imageSize } from 'image-size';
import { performance } from 'perf_hooks';

console.log(process.argv);

var args = process.argv.slice(2);

const url = args[0];
const extensions = (args[1] ?? "*");
const minSize = parseInt(args[2] ?? 0);
const deep = parseInt(args[3] ?? 0);
const delay = parseInt(args[4] ?? 5000);

console.log("Settings:", { url, extensions, minSize, deep, delay });

const baseUrl = url.match(/^(https?:\/\/.+?\..+?)((\/|\?).*)?$/)[1];

if (typeof(url) !== 'string' || !url.includes('http'))
{
    throw 'Starting url is invalid';
}

const seenUrls = {}
const urls = [];
let scrapCount = 0;
let totalCount = 0;

let lastTime = performance.now();

const extensionsRE = new RegExp((extensions === "*" ? "" : extensions));

scrap({ url, extensionsRE, minSize, deep, delay, baseUrl });

async function scrap({ url, extensionsRE, minSize, deep, delay, baseUrl })
{
    console.log(`Scrap [${++scrapCount}/${totalCount}|${urls.length}|${deep}] "${url}"`);

    seenUrls[url] = true;

    let response = null;
    let retryCount = 2;
    while (response == null)
    {
        try
        {
            // Check url targets an html file
            const headers = await fetch(url, { method:'HEAD' });
            const contentType = headers.headers.get('Content-Type');
            if (!contentType.includes("text/html"))
            {
                scrapNext(delay);
                return;
            }
            
            // Fetch html file
            response = await fetch(url);
        }
        catch (ex)
        {
            console.error("Fetch failed:", url, ex);
            response = null;
            retryCount--;
            if (retryCount === 0)
            {
                scrapNext(delay);
                return;
            }
            await sleep(delay);
        }
    }

    // Parse html file
    const html = await response.text();
    const $ = cheerio.load(html);

    const imageUrls = $('img').map((i, img) => img.attribs.src).get();
    const linkUrls = $('a').map((i, link) => link.attribs.href).get();
    
    const fileUrls = imageUrls.concat(linkUrls);

    for (const fileUrl of fileUrls)
    {
        const newUrl = getUrl(fileUrl, url, baseUrl);

        const data = await downloadFile(newUrl, extensionsRE, minSize);
        
        if (deep > 0 && data && data.ext === "html" && canScrap(newUrl))
        {
            urls.push({ url: newUrl, extensionsRE, minSize, deep: (deep - 1), delay, baseUrl });
            totalCount++;
        }

        await sleep(delay);
    }
    
    scrapNext(delay);
}

function scrapNext(delay)
{
    setTimeout(() =>
    {
        if (urls.length > 0)
        {
            scrap(urls.pop());
        }
        else
        {
            console.log("Completed");
        }
    }, delay);
}

function canScrap(url2)
{
    return (url2.includes(url) && seenUrls[url2] === undefined);
}

function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getUrl(url, pageUrl, baseUrl)
{
    let finalUrl;
    if (url.startsWith('http'))
    {
        finalUrl = url;
    }
    else if (url.startsWith('//'))
    {
        if (pageUrl.startsWith('https:'))
        {
            finalUrl = `https:${url}`;
        }
        else
        {
            finalUrl = `http:${url}`;
        }
    }
    else if (url.startsWith('/'))
    {
        if (baseUrl.endsWith('/'))
        {
            url = url.substring(1);
        }
        finalUrl = `${baseUrl}${url}`;
    }
    else if (pageUrl.endsWith('/'))
    {
        finalUrl = `${pageUrl}${url}`;
    }
    else
    {
        finalUrl = `${pageUrl}/${url}`;
    }
    finalUrl = finalUrl.replace(/[^\/]+\/\.\.\//g, "");
    return finalUrl;
}

async function downloadFile(fileUrl, extensionsRE, minSize)
{
    let ext = null;

    try
    {
        if (!fileUrl.startsWith(url))
        {
            return { url: fileUrl, ext };
        }

        //fileUrl = fileUrl.split('?')[0];

        let filePath = urlToPath(fileUrl);

        const headers = await fetch(fileUrl, { method:'HEAD' });

        const extTmp = fileUrl.split('?')[0].split('.').pop();
        ext = (extTmp && extTmp.length <= 4) ? extTmp : null;

        const contentType = headers.headers.get('Content-Type');
        if (contentType.includes("text/html"))
        {
            ext = "html";
            filePath += ("." + ext)
        }

        if (!extensionsRE.test(ext))
        {
            return { url: fileUrl, ext };
        }

        const contentLength = headers.headers.get('Content-Length');
        if (contentLength < minSize)
        {
            return { url: fileUrl, ext };
        }
        
        if (fs.existsSync(filePath))
        {
            return { url: fileUrl, ext };
        }

        // const imgSize = await imageSize(buffer);
        // if (imgSize == null || imgSize.width < 100 || imgSize.height < 100)
        // {
        //     return ext;
        // }

        createOutputDirs(filePath);

        console.log(`\tDownload "${fileUrl}"`);
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        fs.writeFile(filePath, new DataView(buffer), () => {});
    }
    catch (ex)
    {
        console.error("Download failed", fileUrl, ex);
    }
    return { url: fileUrl, ext };
}

function urlToPath(url)
{
    return decodeURIComponent("./downloads/" + url.trim().replace(/^https?:\/\//, "").replace(/\\/g, "/").replace(/[:*?"<>|]/g, " ").trim());
}

function createOutputDirs(filePath)
{
    const dirs = filePath.split('/');
    dirs.pop();
    let path = "";
    for (const dir of dirs)
    {
        if (dir.length > 0)
        {
            if (path.length > 0)
            {
                path += "/";
            }
            path += dir;
            if (!fs.existsSync(path))
            {
                console.log("\tmkdir", path);
                fs.mkdirSync(path);
            }
        }
    }
}
