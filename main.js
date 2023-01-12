// Script which download recursively many resources from websites
// Usage : main.js "<url>" "<downloadExtensions>" "<excludeExtensions>" <minSize> <deep> <delay> "<allowOutside>"
// Parameters :
// - url : Starting url
// - downloadExtensions : File extentions to download (default: "*") (example: "jpg|jpeg|png|gif" for pictures)
// - excludeExtensions : File extentions to exclude (default: "null") (example: "htm|html" for html files)
// - minSize : Minimal file size to download (in bytes) (default: 0) (example: 1024000 for 1MB)
// - deep : Recursive scrap count from starting url (default: 0)
// - delay : Delay between each page scrap (in milliseconds) (default: 500)
// - allowOutside : Allow the scraper to parse or download files outside the original source (default: "false")

import fs from 'fs/promises';
import fetch from 'node-fetch'

import jsdom from 'jsdom';
const { JSDOM } = jsdom;

var args = process.argv.slice(2);

const url = args[0];
const downloadExtensions = (args[1] ?? "*");
const excludeExtensions = (args[2] ?? "null");
const minSize = parseInt(args[3] ?? 0);
const deep = parseInt(args[4] ?? 0);
const delay = parseInt(args[5] ?? 500);
const allowOutside = (args[6] == "true");

console.log("Settings:", { url, downloadExtensions, excludeExtensions, minSize, deep, delay, allowOutside });

if (typeof(url) !== 'string' || !url.includes('http'))
{
    throw 'Starting url is invalid';
}

const baseUrl = url.match(/^(https?:\/\/.+?\..+?)((\/|\?).*)?$/)[1];

const seenUrls = {}
const urls = [];
let scrapCount = 0;
let totalCount = 1;
let downloadCount = 0;

const downloadExtensionsRE = new RegExp((downloadExtensions === "*" ? "" : `^(${downloadExtensions})$`));
const excludeExtensionsRE = new RegExp((excludeExtensions === "null" ? "a^" : `^(${excludeExtensions})$`));

scrap({ url, downloadExtensionsRE, excludeExtensionsRE, minSize, deep, delay, baseUrl, allowOutside, refererUrl: '' });

async function scrap({ url, downloadExtensionsRE, excludeExtensionsRE, minSize, deep, delay, baseUrl, allowOutside, refererUrl })
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
            const headers = getHeaders(url, refererUrl);
            const responseHeaders = await fetch(url, { method:'HEAD', headers });
            const contentType = responseHeaders.headers.get('Content-Type');
            if (!contentType.includes("text/html"))
            {
                scrapNext(delay);
                return;
            }

            // Fetch html file
            response = await fetch(url, { method:'GET', headers });
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

    const document = await getDocument(response);

    const imageUrls = Array.from(document.querySelectorAll('img')).map(img => img.src);
    const linkUrls = Array.from(document.querySelectorAll('a')).map(link => link.href);
    const videoUrls = Array.from(document.querySelectorAll('video')).map(video => video.src);
    const sourceUrls = Array.from(document.querySelectorAll('source')).map(source => source.src);

    const fileUrls = [...imageUrls, ...linkUrls, ...videoUrls, ...sourceUrls];

    for (const fileUrl of fileUrls)
    {
        if (fileUrl != null && fileUrl.length > 0)
        {
            const newUrl = getUrl(fileUrl, url, baseUrl);

            const data = await downloadFile(newUrl, downloadExtensionsRE, excludeExtensionsRE, minSize, allowOutside, url);

            if (deep > 0 && data && (data.ext.startsWith("htm") || data.ext.startsWith("php")) && canScrap(newUrl, baseUrl, allowOutside))
            {
                urls.push({ url: newUrl, downloadExtensionsRE, excludeExtensionsRE, minSize, deep: (deep - 1), delay, baseUrl, allowOutside });
                totalCount++;
            }

            await sleep(delay);
        }
    }

    scrapNext(delay);
}

// Parse html file
async function getDocument(response)
{
    const html = await response.text();
    const dom = new JSDOM(html);
    return dom.window.document;
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
            log(`Completed [${downloadCount} files downloaded; ${totalCount} pages parsed]`);
        }
    }, delay);
}

function canScrap(url, baseUrl, allowOutside)
{
    return (seenUrls[url] === undefined && (allowOutside || url.startsWith(baseUrl)));
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

async function downloadFile(fileUrl, downloadExtensionsRE, excludeExtensionsRE, minSize, allowOutside, refererUrl)
{
    let ext = null;

    try
    {
        const extTmp = fileUrl.match(/^https?:\/\/.+\/.+\.([a-zA-Z0-9]+).*$/);
        ext = (extTmp && extTmp.length > 1 ? extTmp[1] : null);
        
        let filePath = urlToPath(fileUrl);

        let headers;

        if (ext == null || minSize > 0)
        {
            headers = getHeaders(fileUrl, refererUrl);
            const response = await fetch(fileUrl, { method:'HEAD', headers });

            if (ext == null)
            {
                const contentType = response.headers.get('Content-Type');
                ext = contentType.match(/^.+?\/([a-zA-Z0-9.-]+).*$/)[1];
                filePath += ("." + ext);
            }
            
            if (minSize > 0)
            {
                const contentLength = response.headers.get('Content-Length');
                if (contentLength < minSize)
                {
                    return { url: fileUrl, ext };
                }
            }
        }
        
        if (!allowOutside && !fileUrl.startsWith(url))
        {
            return { url: fileUrl, ext };
        }

        if (!downloadExtensionsRE.test(ext) || excludeExtensionsRE.test(ext))
        {
            return { url: fileUrl, ext };
        }

        if (await fileExists(filePath))
        {
            return { url: fileUrl, ext };
        }

        await createOutputDirs(filePath);

        log(`\tDownload [${++downloadCount}] "${fileUrl}"`);
        if (headers == null)
        {
            headers = getHeaders(fileUrl, refererUrl);
        }
        const response = await fetch(fileUrl, { method:'GET', headers });
        const buffer = await response.arrayBuffer();
        await fs.writeFile(filePath, new DataView(buffer), () => {});
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

async function createOutputDirs(filePath)
{
    const dirs = filePath.split('/');
    dirs.pop();
    const dirPath = dirs.join('/');
    if (! await fileExists(dirPath))
    {
        log(`\tmkdir "${dirPath}"`);
        await fs.mkdir(dirPath, { recursive: true });
    }
}

function log(message)
{
    console.log(`[${(new Date()).toISOString()}] ${message}`);
}

function fileExists(filePath)
{
    return fs.stat(filePath).then(() => true).catch(() => false);
}

function getHeaders(url, refererUrl)
{
    const host = url.replace(/^(https?:\/\/)?(.+?)(\/.*)?$/, '$2');
    const referer = refererUrl ? refererUrl.replace(/^(https?:\/\/)?(.+?)(\/.*)?$/, '$1$2/') : '';
    const headers =
    {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
        'Alt-Used': host,
        'Host': host,
        'Referer': referer ?? 'https://www.google.com',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'TE': 'trailers',
        'Upgrade-Insecure-Requests': 1,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0'
    };
    return headers;
}
