// Script which download recursively many resources from websites
// Usage : main.js "<url>" "<downloadExtensions>" "<excludeExtensions>" <minSize> <deep> <delay> "<allowOutsideDownloads>" "<allowOutsideScraping>"
// Parameters :
// - url : Starting url
// - downloadExtensions : File extentions to download (default: "*") (example: "jpg|jpeg|png|gif" for pictures)
// - excludeExtensions : File extentions to download (default: "null") (example: "htm|html" for html files)
// - minSize : Minimal file size to download (in bytes) (default: 0) (example: 1024000 for 1MB)
// - deep : Recursive scap count from starting url (default: 0)
// - delay : Delay between each page scrap (in milliseconds) (default: 500)
// - allowOutsideDownloads : Allow to downloads files outside the original source website (default: "false")
// - allowOutsideScraping : Allow to scrap files outside the original source website (default: "false")

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

var args = process.argv.slice(2);

const url = args[0];
const downloadExtensions = (args[1] ?? "*");
const excludeExtensions = (args[2] ?? "*");
const minSize = parseInt(args[3] ?? 0);
const deep = parseInt(args[4] ?? 0);
const delay = parseInt(args[5] ?? 500);
const allowOutsideDownloads = (args[6] == "true");
const allowOutsideScraping = (args[7] == "true");

console.log("Settings:", { url, downloadExtensions, excludeExtensions, minSize, deep, delay });

const baseUrl = url.match(/^(https?:\/\/.+?\..+?)((\/|\?).*)?$/)[1];

if (typeof(url) !== 'string' || !url.includes('http'))
{
    throw 'Starting url is invalid';
}

const seenUrls = {}
const urls = [];
let scrapCount = 0;
let totalCount = 1;
let downloadCount = 0;

const downloadExtensionsRE = new RegExp((downloadExtensions === "*" ? "" : `^(${downloadExtensions})$`));
const excludeExtensionsRE = new RegExp((excludeExtensions === "null" ? "a^" : `^(${excludeExtensions})$`));

scrap({ url, downloadExtensionsRE, excludeExtensionsRE, minSize, deep, delay, baseUrl, allowOutsideDownloads, allowOutsideScraping });

async function scrap({ url, downloadExtensionsRE, excludeExtensionsRE, minSize, deep, delay, baseUrl, allowOutsideDownloads, allowOutsideScraping })
{
    console.log(`[${(new Date()).toISOString()}] Scrap [${++scrapCount}/${totalCount}|${urls.length}|${deep}] "${url}"`);

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
            console.error(`[${(new Date()).toISOString()}] Fetch failed:`, url, ex);
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
        if (fileUrl != null && fileUrl.length > 0)
        {
            const newUrl = getUrl(fileUrl, url, baseUrl);

            const data = await downloadFile(newUrl, downloadExtensionsRE, excludeExtensionsRE, minSize; allowOutsideDownloads);

            if (deep > 0 && data && data.ext === "html" && canScrap(newUrl, url, allowOutsideScraping))
            {
                urls.push({ url: newUrl, downloadExtensionsRE, excludeExtensionsRE, minSize, deep: (deep - 1), delay, baseUrl, allowOutsideDownloads, allowOutsideScraping });
                totalCount++;
            }

            await sleep(delay);
        }
    }

    scrapNext(delay);
}

function scrapNext(delay)
{
    setTimeout(() =>
    {
        if (urls.length > 0)
        {
            scrap(urls.shift());
        }
        else
        {
            console.log(`[${(new Date()).toISOString()}] Completed [${downloadCount} files downloaded; ${totalCount} pages parsed]`);
        }
    }, delay);
}

function canScrap(url, pageUrl, allowOutsideScraping)
{
    return (seenUrls[url] === undefined && (allowOutsideScraping || url.startsWith(pageUrl)));
}

function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getUrl(url, pageUrl, baseUrl)
{
    if (url.includes('#'))
    {
        url = url.split('#')[0];
    }
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

async function downloadFile(fileUrl, downloadExtensionsRE, excludeExtensionsRE, minSize, allowOutsideDownloads)
{
    let ext = null;

    try
    {
        const extTmp = fileUrl.split('?')[0].split('.').pop();
        ext = (/[a-zA-Z0-9]+/.test(extTmp) ? extTmp : null);

        if (allowOutsideDownloads && !fileUrl.startsWith(url))
        {
            return { url: fileUrl, ext };
        }

        let filePath = urlToPath(fileUrl);

        const headers = await fetch(fileUrl, { method:'HEAD' });

        const contentType = headers.headers.get('Content-Type');
        if (contentType.includes("text/html") && ext !== "htm" && ext !== "html")
        {
            ext = "html";
            filePath += ("." + ext)
        }

        if (!downloadExtensionsRE.test(ext) || excludeExtensionsRE.test(ext))
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

        createOutputDirs(filePath);

        console.log(`[${(new Date()).toISOString()}] \tDownload [${++downloadCount}] "${fileUrl}"`);
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        fs.writeFile(filePath, new DataView(buffer), () => {});
    }
    catch (ex)
    {
        console.error(`[${(new Date()).toISOString()}] Download failed`, fileUrl, ex);
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
    const dirPath = dirs.join('/');
    if (!fs.existsSync(dirPath))
    {
        console.log(`[${(new Date()).toISOString()}] \tmkdir "${dirPath}"`);
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
