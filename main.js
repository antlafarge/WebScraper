// Script which download recursively many resources from websites
// Usage : main.js "<url>" "<downloadRegExp>" "<excludeRegExp>" <minSize> <maxSize> <deep> <delay> "<sameOrigin>" "<additionalHeadersJSON>"

import { performance } from "perf_hooks";
import fs from 'fs/promises';
import fetch from 'node-fetch';
import jsdom from 'jsdom';
import Logger from './logger.js';
import { sleep, retrySeveralTimesTimeout } from './async.js';

const { JSDOM } = jsdom;

var args = process.argv.slice(2);

const initialUrl = args[0];
const downloadRegExp = (args[1] ?? "");
const excludeRegExp = (args[2] ?? "");
const minSize = parseInt(args[3] ?? 0);
const maxSize = parseInt(args[4] ?? 0);
const deep = parseInt(args[5] ?? 0);
const delay = parseInt(args[6] ?? 200);
const sameOrigin = (args[7] == "true");
const additionalHeaders = JSON.parse(args[8] ?? "{}");

const logLevel = Logger.LogLevel[process.env.WEBSCRAPER_LOG_LEVEL] ?? Logger.LogLevel.TRACE;
const segmentsSizeMax = (process.env.WEBSCRAPER_DOWNLOAD_SEGMENTS_SIZE != null) ? parseInt(process.env.WEBSCRAPER_DOWNLOAD_SEGMENTS_SIZE) : (10 * 1024 * 1024);
const replaceDifferentSizeFiles = /\s*true\s*/i.test(process.env.WEBSCRAPER_REPLACE_DIFFERENT_SIZE_FILES);
const documentTimeout = (process.env.WEBSCRAPER_DOCUMENT_TIMEOUT != null ? parseInt(process.env.WEBSCRAPER_DOCUMENT_TIMEOUT) : 10000);
const downloadTimeout = (process.env.WEBSCRAPER_DOWNLOAD_TIMEOUT != null ? parseInt(process.env.WEBSCRAPER_DOWNLOAD_TIMEOUT) : 100000);

const logger = new Logger(logLevel);

logger.logInfo(null, 'Settings:', { url: initialUrl, downloadRegExp, excludeRegExp, minSize, maxSize, deep, delay, sameOrigin, additionalHeaders, WEBSCRAPER_LOG_LEVEL: (process.env.WEBSCRAPER_LOG_LEVEL ?? 'TRACE'), WEBSCRAPER_DOWNLOAD_SEGMENTS_SIZE: segmentsSizeMax, WEBSCRAPER_REPLACE_DIFFERENT_SIZE_FILES: replaceDifferentSizeFiles });

if (typeof(initialUrl) !== 'string' || ! /^http/i.test(initialUrl))
{
    throw 'Url is invalid';
}

const baseUrl = initialUrl.match(/^(https?:\/\/.+?\..+?)((\/|\?).*)?$/i)[1];

const seenUrls = {}
const urls = [];
let scrapCount = 0;
let totalCount = 0;
let downloadCount = 0;

const downloadRE = (downloadRegExp.length > 0) ? new RegExp(downloadRegExp, 'i') : /./;
const excludeRE = (excludeRegExp.length > 0) ? new RegExp(excludeRegExp, 'i') : /a^/;

async function main()
{
    await handleUrl(initialUrl, '', (deep + 1));
    scrapNext();
}

main();

async function scrap({ url, refererUrl, deep })
{
    logger.logInfo(null, `Scrap [${++scrapCount}/${totalCount}|${urls.length}|${deep}] "${url}"`);

    seenUrls[url] = true;

    try
    {
        const headers = getHeaders(url, refererUrl);
        const response = await retrySeveralTimesTimeout(() => fetchEnsureSucceed(url, { method:'GET', headers }), 2, documentTimeout, (error) => logger.logTrace(null, 'Fetch GET failed :', error, `"${url}"`));
        const document = await getDocument(response);

        const imageUrls = Array.from(document.querySelectorAll('img')).map(img => img.src);
        const linkUrls = Array.from(document.querySelectorAll('a')).map(link => link.href);
        const videoUrls = Array.from(document.querySelectorAll('video')).map(video => video.src);
        const sourceUrls = Array.from(document.querySelectorAll('source')).map(source => source.src);
    
        const fileUrls = [...imageUrls, ...linkUrls, ...videoUrls, ...sourceUrls];

        const seenUrlsInPage = {};
    
        for (const fileUrl of fileUrls)
        {
            if (fileUrl != null && fileUrl.length > 0 && ! /^(about:[\w-]+)?(#.*)?$/.test(fileUrl) && seenUrlsInPage[fileUrl] == null)
            {
                seenUrlsInPage[fileUrl] = true;

                const newUrl = getUrl(fileUrl, url, baseUrl);
    
                await handleUrl(newUrl, url, deep);
    
                await sleep(delay);
            }
        }
    }
    catch (error)
    {
        logger.logError(null, 'Fetch GET failed :', error, `"${url}"`);
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
            logger.logInfo(null, `Completed [${downloadCount} files downloaded; ${totalCount} documents parsed]`);
        }
    }, delay);
}

function canScrap(url)
{
    return (seenUrls[url] === undefined && ((! sameOrigin) || url.startsWith(baseUrl)));
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
    logger.logDebug(null, `Handle [${deep}] "${url}"`);

    let filePath = urlToPath(url);

    if (/.+\/$/.test(url))
    {
        filePath += 'index';
    }
    
    let canDownloadFile = true;

    if (canDownloadFile && sameOrigin && ! url.startsWith(baseUrl))
    {
        logger.logDebug(null, `Skip file (Not same origin))`);
        canDownloadFile = false;
    }

    if (canDownloadFile)
    {
        if (! downloadRE.test(url))
        {
            logger.logDebug(null, `Skip file (No match download regular expression)`);
            canDownloadFile = false;
        }
        else if (excludeRE.test(url))
        {
            logger.logDebug(null, `Skip file (Match exclude regular expression)`);
            canDownloadFile = false;
        }
    }

    let extTmp = url.match(/.+\.([A-Z0-9]+)[^\/]*$/i);
    let ext = ((extTmp && extTmp.length > 1) ? extTmp[1] : null);
    let acceptRanges;
    let contentLength;

    try
    {
        const headers = getHeaders(url, refererUrl);
        const response = await retrySeveralTimesTimeout(() => fetchEnsureSucceed(url, { method:'HEAD', headers }), 2, documentTimeout, (error) => logger.logTrace(null, 'Fetch HEAD failed :', error, `"${url}"`));

        if (ext == null)
        {
            const contentType = response.headers.get('Content-Type');
            extTmp = contentType.match(/.+?\/([\w-]+).*$/i);
            ext = ((extTmp && extTmp.length > 1) ? extTmp[1] : null);
            filePath += `.${ext}`;
        }
        
        const contentLengthTmp = response.headers.get('Content-Length');
        contentLength = (contentLengthTmp != null) ? parseInt(contentLengthTmp) : null;

        acceptRanges = response.headers.get('Accept-Ranges');

        if (canDownloadFile && contentLength != null && ((minSize > 0 && contentLength < minSize) || (maxSize > 0 && contentLength > maxSize)))
        {
            logger.logDebug(null, `Skip file (outside of size range)`);
            canDownloadFile = false;
        }
    }
    catch (error)
    {
        logger.logError(null, 'Fetch HEAD failed :', error, `"${url}"`);
        return;
    }
    
    const stats = await fileStats(filePath);
    if (canDownloadFile && stats != null) // If file exists
    {
        if (! replaceDifferentSizeFiles || contentLength == stats.size) // If we don't replace files or the size is equal
        {
            logger.logDebug(null, `Skip file (File already exists)`);
            canDownloadFile = false;
        }
        else
        {
            // Delete the file which will be re-downloaded
            logger.logDebug(null, `Replace file`);
            await fs.unlink(filePath);
        }
    }

    if (canDownloadFile)
    {   
        await createOutputDirs(filePath);

        try
        {
            logger.logInfo(null, `Download [${++downloadCount}] "${url}"`);
            await downloadFile(filePath, url, refererUrl, contentLength, acceptRanges);
        }
        catch (error)
        {
            logger.logError(null, 'Download failed :', error, `"${url}"`);
            return;
        }
    }
    
    if (deep > 0 && /^(htm|php)/i.test(ext) && canScrap(url))
    {
        urls.push({ url, refererUrl, deep: (deep - 1) });
        totalCount++;
    }
}

const sizeUnits = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
function bytesToReadableSize(size, sizeUnitIndex = null)
{
    let sizeUnitIndex2 = 0;
    while (sizeUnitIndex2 < 4)
    {
        if (sizeUnitIndex2 === sizeUnitIndex || (sizeUnitIndex === null && size < 1024))
        {
            break;
        }
        size /= 1024;
        sizeUnitIndex2++;
    }
    return [size, sizeUnitIndex2];
}

const timeUnits = ['ms', 's', 'm', 'h', 'd'];
const timeUnitsDivisor = [1000, 60, 60, 24, 36500];
function timeMsToReadableTime(time)
{
    const res = [];
    for (let i = 0; i < timeUnitsDivisor.length; i++)
    {
        const divisor = timeUnitsDivisor[i];
        res.push(time % divisor);
        time = Math.floor(time / divisor);
    }
    return res;
}

function readableTimeToString(times, timeUnitsEnabled = null)
{
    let str = '';
    for (let i = timeUnitsDivisor.length - 1; i >= 0; i--)
    {
        if (times[i] > 0 && (timeUnitsEnabled == null || timeUnitsEnabled[i]))
        {
            str += ` ${times[i]}${timeUnits[i]}`;
        }
    }
    return str.trim();
}

function arraySum(array)
{
    if (array.length > 0)
    {
        return array.reduce((v, acc) => (acc + v), 0);
    }
    return null;
}

function arrayAverage(array)
{
    if (array.length > 0)
    {
        return arraySum(array) / array.length;
    }
    return null;
}

async function downloadFile(filePath, url, refererUrl, contentLength, acceptRanges)
{
    // Download vars
    const supportSegments = /(^|\W)bytes(\W|$)/.test(acceptRanges);
    const segmentsSize = supportSegments ? segmentsSizeMax : contentLength;

    // Progress vars
    const [contentLengthReadable, contentLengthUnitIndex] = bytesToReadableSize(contentLength);
    const contentLengthReadableStr = contentLengthReadable.toFixed(2);
    const progressDelay = 1000;
    const tStart = performance.now();
    let t2 = tStart;
    let tLastProgressDisplayed = tStart;
    let lastOffset = 0;
    const timeUnitsEnabled = [false, true, true, true, true];
    const timeoutDelay = downloadTimeout * (segmentsSize / (10 * 1024 * 1024));
    logger.logDebug(null, `Timeout delay = ${timeoutDelay}`);
    let minDownloadSpeedStrLength = 1;

    // display progress function
    const displayProgress = (offset, remainingSize, forceDisplayProgress, displayDownloadSpeed) =>
    {
        const t1 = t2;
        t2 = performance.now();
        const timeSinceLastProgress = t2 - tLastProgressDisplayed;

        const progress = (forceDisplayProgress || (timeSinceLastProgress >= progressDelay));
        
        const secondsElapsed = (t2 - t1) / 1000;

        const lastSegmentSize = offset - lastOffset;
        lastOffset = offset;
        const downloadSpeed = lastSegmentSize / secondsElapsed;

        if (progress)
        {
            // Compute percentage
            const percent = ((offset / contentLength) * 100).toFixed(2).padStart(6, ' ');

            // Compute downloaded length readable str 
            const [downloadedLengthReadable, downloadedLengthUnitIndex] = bytesToReadableSize(offset, contentLengthUnitIndex);
            const downloadedLengthReadableStr = downloadedLengthReadable.toFixed(2).padStart(contentLengthReadableStr.length, ' ');
            
            // Compute download speed readable str
            let downloadSpeedReadableStrFull = '';
            if (displayDownloadSpeed)
            {
                const [downloadSpeedReadable, downloadSpeedUnitIndex] = bytesToReadableSize(downloadSpeed);
                let downloadSpeedReadableStr = downloadSpeedReadable.toFixed(2);
                if (minDownloadSpeedStrLength < downloadSpeedReadableStr.length)
                {
                    minDownloadSpeedStrLength = downloadSpeedReadableStr.length;
                }
                else if (downloadSpeedReadableStr.length < minDownloadSpeedStrLength)
                {
                    downloadSpeedReadableStr = downloadSpeedReadableStr.padStart(minDownloadSpeedStrLength, ' ');
                }
                downloadSpeedReadableStrFull = ` [${downloadSpeedReadableStr} ${sizeUnits[downloadSpeedUnitIndex]}/s]`;
            }
            
            // Compute time left readable str
            let readableTimeStr = '';
            if (offset > 0 && remainingSize > 0)
            {
                const totalElapsedTime = t2 - tStart;
                const remainingTime = totalElapsedTime * (contentLength / offset);
                readableTimeStr = readableTimeToString(timeMsToReadableTime(remainingTime), timeUnitsEnabled);
                if (readableTimeStr.length > 0)
                {
                    readableTimeStr = ` ${readableTimeStr}...`;
                }
            }
    
            // Log progress
            logger.logDebug(null, `    Progress : ${percent} % (${downloadedLengthReadableStr} / ${contentLengthReadableStr} ${sizeUnits[contentLengthUnitIndex]})${downloadSpeedReadableStrFull}${readableTimeStr}`);
            
            tLastProgressDisplayed = t2;
        }
    };

    displayProgress(0, contentLength, true, false);

    for (let offset = 0; offset < contentLength; offset += segmentsSize)
    {
        const remainingSize = contentLength - offset;

        displayProgress(offset, remainingSize, false, true);

        const currentSegmentSize = (remainingSize < segmentsSize) ? remainingSize : segmentsSize;
        const headers = getHeaders(url, refererUrl, supportSegments, offset, (offset + currentSegmentSize - 1));
        const response = await retrySeveralTimesTimeout(() => fetchEnsureSucceed(url, { method:'GET', headers }), 2, timeoutDelay, (error) => logger.logTrace(null, 'Fetch GET failed', error, `"${url}"`));
        const buffer = await response.arrayBuffer();
        await fs.writeFile(filePath, new DataView(buffer), { flag:'a+' });
    }

    displayProgress(contentLength, contentLength, true, true);
}

function urlToPath(url)
{
    return './downloads/' + decodeURIComponent(url).replace(/^(.+):\/\//i, '').replace(/[:*?"<>|]/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s*(\\|\/)+\s*/g, '/').trim();
}

function fileStats(filePath, options)
{
    return fs.stat(filePath, options).then((stats) => stats).catch(() => null);
}

async function createOutputDirs(filePath)
{
    const dirs = filePath.split('/');
    dirs.pop();
    const dirPath = dirs.join('/');
    const stats = await fileStats(dirPath);
    if (stats == null) // if dir doesn't exist
    {
        logger.logDebug(null, `mkdir "${dirPath}"`);
        await fs.mkdir(dirPath, { recursive: true });
    }
}

function getHeaders(url, refererUrl, supportSegments = false, rangeStartOffset = null, rangeEndOffset = null)
{
    const host = url.replace(/^(https?:\/\/)?(.+?)(\/.*)?$/i, '$2');
    const referer = refererUrl ? refererUrl.replace(/^(https?:\/\/)?(.+?)(\/.*)?$/i, '$1$2/') : '';
    const headers =
    {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US;q=0.8,en;q=0.5,*;q=0.2',
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
    if (supportSegments && rangeStartOffset != null && rangeEndOffset != null)
    {
        headers.Range = `bytes=${rangeStartOffset}-${rangeEndOffset}`;
    }
    for (const field in additionalHeaders)
    {   
        headers[field] = additionalHeaders[field];
    }
    return headers;
}

async function fetchEnsureSucceed()
{
    const response = await fetch(...arguments);
    if (! response.ok)
    {
        let error = `${response.status} ${response.statusText}`;
        if (response.bodyUsed)
        {
            error += ` ${response.body}`;
        }
        throw error
    }
    return response;
}
