// Script which download recursively many resources from websites
// Usage : main.js "<url>" "<downloadExtensions>" "<excludeExtensions>" <minSize> <deep> <delay> "<allowOutside>"
// Parameters :
// - url : Starting url
// - downloadRegExp : File urls which match this regular expression will be downloaded (case insensitive) (default: "") (example: "\.(jpe?g|png|webp|gif)[^\/]*$" for picture files (`[^\/]*` is used to ignore query parameters at the end of file urls))
// - excludeRegExp : File urls which match this regular expression will be excluded (case insensitive) (default: "") (example: "\.htm(l|l5)?[^\/]*$" for html files)
// - minSize : Minimal file size to download (in bytes) (default: 0) (example: 1048576 for 1MB)
// - maxSize : Maximal file size to download (in bytes) (default: 0) (example: 1073741824 for 1GB)
// - deep : Recursive scrap count from starting url (default: 0)
// - delay : Delay between each page scrap (in milliseconds) (default: 500)
// - allowOutside : Allow the scraper to parse or download files outside the original source (default: "false")

import fs from 'fs/promises';
import fetch from 'node-fetch'

import jsdom from 'jsdom';
const { JSDOM } = jsdom;

var args = process.argv.slice(2);

const initialUrl = args[0];
const downloadRegExp = (args[1] ?? "");
const excludeRegExp = (args[2] ?? "");
const minSize = parseInt(args[3] ?? 0);
const maxSize = parseInt(args[4] ?? 0);
const deep = parseInt(args[5] ?? 0);
const delay = parseInt(args[6] ?? 500);
const allowOutside = (args[7] == "true");

const verbose = (process.env.WEBSCRAPER_VERBOSE != null) ? /^\s*true\s*$/i.test(process.env.WEBSCRAPER_VERBOSE) : true;

log("Settings:", { initialUrl, downloadRegExp, excludeRegExp, minSize, maxSize, deep, delay, allowOutside, verbose });

if (typeof(initialUrl) !== 'string' || ! /^http/i.test(initialUrl))
{
    throw 'Url is invalid';
}

const baseUrl = initialUrl.match(/^(https?:\/\/.+?\..+?)((\/|\?).*)?$/i)[1];

const seenUrls = {}
const urls = [];
let scrapCount = 0;
let totalCount = 1;
let downloadCount = 0;

const downloadRE = downloadRegExp.length ? new RegExp(downloadRegExp, 'i') : /./;
const excludeRE = excludeRegExp.length ? new RegExp(excludeRegExp, 'i') : /a^/;

scrap({ url: initialUrl, refererUrl: '', deep });

async function scrap({ url, refererUrl, deep })
{
    log(`Scrap [${++scrapCount}/${totalCount}|${urls.length}|${deep}] "${url}"`);

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
            if (! contentType.includes("text/html"))
            {
                scrapNext(delay);
                return;
            }

            // Fetch html file
            response = await fetch(url, { method:'GET', headers });
        }
        catch (ex)
        {
            logError('Fetch failed:', url, ex);
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

            await handleUrl(newUrl, url, deep);

            await sleep(delay);
        }
    }

    scrapNext();
}

// Parse html file
async function getDocument(response)
{
    const html = await response.text();
    const dom = new JSDOM(html);
    return dom.window.document;
}

function scrapNext()
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

function canScrap(url)
{
    return (seenUrls[url] === undefined && (allowOutside || url.startsWith(baseUrl)));
}

function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getUrl(url, pageUrl)
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

async function handleUrl(url, refererUrl, deep)
{
    if (verbose)
    {
        log(`\tHandle [${deep}]`, url);
    }

    let filePath = urlToPath(url);

    if (/.+\/$/.test(url))
    {
        url += 'index';
    }
    
    let canDownloadFile = true;

    if (canDownloadFile && ! allowOutside && ! url.startsWith(url))
    {
        canDownloadFile = false;
    }

    if (canDownloadFile && (! downloadRE.test(url) || excludeRE.test(url)))
    {
        canDownloadFile = false;
    }

    let extTmp = url.match(/\.([A-Z0-9]+)[^\/]*$/i);
    let ext = ((extTmp && extTmp.length > 1) ? extTmp[1] : null);
    let acceptRanges;
    let contentLength;

    try
    {
        const response = await fetch(url, { method:'HEAD', headers:getHeaders(url, refererUrl) });

        if (ext == null)
        {
            const contentType = response.headers.get('Content-Type');
            extTmp = contentType.match(/.+?\/([\w-]+).*$/i);
            ext = ((extTmp && extTmp.length > 1) ? extTmp[1] : null);
            filePath += `.${ext}`;
        }
        
        contentLength = response.headers.get('Content-Length');
        acceptRanges = response.headers.get('Accept-Ranges');

        if (canDownloadFile && ((minSize > 0 && contentLength < minSize) || (maxSize > 0 && contentLength > maxSize)))
        {
            canDownloadFile = false;
        }
    }
    catch (ex)
    {
        logError('HEAD failed', url, ex);
    }
    
    if (canDownloadFile && await fileExists(filePath))
    {
        canDownloadFile = false;
    }

    if (canDownloadFile)
    {   
        await createOutputDirs(filePath);

        try
        {
            log(`\tDownload [${++downloadCount}] "${url}"`);
            await downloadFile(filePath, url, refererUrl, contentLength, acceptRanges);
        }
        catch (ex)
        {
            logError('Download failed', url, ex);
        }
    }
    
    if (deep > 0 && /^(htm|php)/i.test(ext) && canScrap(url))
    {
        urls.push({ url, refererUrl, deep: (deep - 1) });
        totalCount++;
    }
}

async function downloadFile(filePath, url, refererUrl, contentLength, acceptRanges)
{
    let segmentSizeMax = (acceptRanges === 'bytes') ? (10 * 1024 * 1024) : contentLength; // 10 MB segments max
    for (let offset = 0; offset < contentLength; offset += segmentSizeMax)
    {
        const remainingSize = contentLength - offset;
        const segmentSize = (remainingSize < segmentSizeMax) ? remainingSize : segmentSizeMax;
        const headers = getHeaders(url, refererUrl, offset, (offset + segmentSize - 1));
        const response = await fetch(url, { method:'GET', headers });
        const buffer = await response.arrayBuffer();
        await fs.writeFile(filePath, new DataView(buffer), { flag:'a+' });
    }
}

function urlToPath(url)
{
    return decodeURIComponent("./downloads/" + url.trim().replace(/^https?:\/\//i, "").replace(/\\/g, "/").replace(/[:*?"<>|]/g, " ").trim());
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

function log(message, data)
{
    console.log(`[${(new Date()).toISOString()}]`, ...arguments);
}

function logInfo(message, data)
{
    console.info(`[${(new Date()).toISOString()}]`, ...arguments);
}

function logWarn(message, data)
{
    console.warn(`[${(new Date()).toISOString()}]`, ...arguments);
}

function logError(message, data)
{
    console.error(`[${(new Date()).toISOString()}]`, ...arguments);
}

function fileExists(filePath)
{
    return fs.stat(filePath).then(() => true).catch(() => false);
}

function getHeaders(url, refererUrl, rangeStartOffset = null, rangeEndOffset = null)
{
    const host = url.replace(/^(https?:\/\/)?(.+?)(\/.*)?$/i, '$2');
    const referer = refererUrl ? refererUrl.replace(/^(https?:\/\/)?(.+?)(\/.*)?$/i, '$1$2/') : '';
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
    if (rangeStartOffset != null && rangeEndOffset != null)
    {
        headers.Range = `bytes=${rangeStartOffset}-${rangeEndOffset}`;
    }
    return headers;
}
