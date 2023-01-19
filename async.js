// async.js v0.1

// Sleep
// @param ms time in milliseconds
// @return Promise resolved when time is passed
function sleep(delay)
{
    return (delay <= 0) ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, delay));
}

// Retry operationFunctor when operationFunctor fails and retryAndErrorFunctor returns true
// @param operationFunctor Async operation : (retryCount: number) => Promise<any>
// @param retryAndErrorFunctor Functor which takes the operation failure error has argument and returns a boolean indicating if we can retry to call the operationFunctor : (error: any) => boolean
// @return Promise<any>
async function retry(operationFunctor, retryAndErrorFunctor)
{
    let lastAsyncOperation;
    let canRetry;
    let retryCount = 0;
    do
    {
        try
        {
            lastAsyncOperation = operationFunctor(retryCount++);
            return await lastAsyncOperation;
        }
        catch (error)
        {
            canRetry = retryAndErrorFunctor(error);
        }
    } while (canRetry);
    return lastAsyncOperation;
}

// Retry running the function a number of times until it succeeds
// @param operationFunctor Async operation : (retryCount: number) => Promise<any>
// @param timesCount Retry times count
// @param errorFunctor Functor to handle the error
// @return Promise<any>
async function retrySeveralTimes(operationFunctor, timesCount, errorFunctor = null)
{
    return await retry(operationFunctor, (error) => (!errorFunctor || errorFunctor(error) || true) && (timesCount-- > 0));
}

// Timeout
// @param operationFunctor Async operation : () => Promise<any>
// @param delay Time (in milliseconds) before the returned Promise is rejected
// @return Promise<any>
async function timeout(operationFunctor, delay)
{
    return new Promise(async (resolve, reject) =>
    {
        const timeoutId = setTimeout(() => reject(`timeout(${delay})`), delay);
        try
        {
            const result = await operationFunctor();
            clearTimeout(timeoutId);
            resolve(result);
        }
        catch (error)
        {
            reject(error);
        }
    });
}

// Retry
// @param operationFunctor Async operation : (retryCount: number) => Promise<any>
// @param retryAndErrorFunctor Functor which takes the operation failure error has argument and returns a boolean indicating if we can retry to call the operationFunctor : (error: any) => boolean
// @param timeoutDelay Time (in milliseconds) before the returned Promise is rejected
// @return Promise<any>
function retryTimeout(operationFunctor, retryAndErrorFunctor, timeoutDelay)
{
    return retry((retryCount) => timeout(() => operationFunctor(retryCount), timeoutDelay), retryAndErrorFunctor);
}

/// Retry several times and Timeout
// @param operationFunctor Async operation : (retryCount: number) => Promise<any>
// @param retryTimesCount Retry times count
// @param timeoutDelay Time (in milliseconds) before the returned Promise is rejected
// @return Promise<any>
function retrySeveralTimesTimeout(operationFunctor, retryTimesCount, timeoutDelay, errorFunctor = null)
{
    return retrySeveralTimes((retryCount) => timeout(() => operationFunctor(retryCount), timeoutDelay), retryTimesCount, errorFunctor);
}

export { sleep, retry, retrySeveralTimes, timeout, retryTimeout, retrySeveralTimesTimeout };
