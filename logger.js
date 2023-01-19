// logger.js v0.1

export default class Logger
{
    static LogLevel =
    {
        TRACE: 0,
        DEBUG: 1,
        INFO: 2,
        WARN: 3,
        ERROR: 4,
        TTY_ONLY: 5,
        NO_LOGS: 6
    };

    static #LogLevelStr =
    {
        0: 'T',
        1: 'D',
        2: 'I',
        3: 'W',
        4: 'E',
        5: 'T',
        6: 'N'
    }

    constructor(minLogLevel = Logger.LogLevel.TRACE)
    {
        this.minLogLevel = minLogLevel;
    }

    log(moduleName, ...messages)
    {
        this.logTrace(moduleName, ...messages);
    }

    logTrace(moduleName, ...messages)
    {
        if (this.minLogLevel <= Logger.LogLevel.TRACE)
        {
            this.endProgress();
            console.log(this.createLogHeader(Logger.LogLevel.TRACE, moduleName), ...messages);
        }
        else
        {
            this.logProgress(moduleName, ...messages);
        }
    }

    logDebug(moduleName, ...messages)
    {
        if (this.minLogLevel <= Logger.LogLevel.DEBUG)
        {
            this.endProgress();
            console.log(this.createLogHeader(Logger.LogLevel.DEBUG, moduleName), ...messages);
        }
        else
        {
            this.logProgress(moduleName, ...messages);
        }
    }

    logInfo(moduleName, ...messages)
    {
        if (this.minLogLevel <= Logger.LogLevel.INFO)
        {
            this.endProgress();
            console.info(this.createLogHeader(Logger.LogLevel.INFO, moduleName), ...messages);
        }
        else
        {
            this.logProgress(moduleName, ...messages);
        }
    }

    logWarn(moduleName, ...messages)
    {
        if (this.minLogLevel <= Logger.LogLevel.WARN)
        {
            this.endProgress();
            console.warn(this.createLogHeader(Logger.LogLevel.WARN, moduleName), ...messages);
        }
        else
        {
            this.logProgress(moduleName, ...messages);
        }
    }

    logError(moduleName, ...messages)
    {
        if (this.minLogLevel <= Logger.LogLevel.ERROR)
        {
            this.endProgress();
            console.error(this.createLogHeader(Logger.LogLevel.ERROR, moduleName), ...messages);
        }
        else
        {
            this.logProgress(moduleName, ...messages);
        }
    }

    logProgress(moduleName, ...messages)
    {
        if (this.minLogLevel <= Logger.LogLevel.TTY_ONLY && process.stdout.isTTY)
        {
            if (this.progressStarted)
            {
                process.stdout.clearLine(0);
                process.stdout.cursorTo(0);
            }
            this.progressStarted = true;
            process.stdout.write(`${this.createLogHeader(Logger.LogLevel.TRACE, moduleName)} ${Array.prototype.join.call(messages, ' ')}`);
        }
    }

    endProgress()
    {
        if (this.progressStarted)
        {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            this.progressStarted = false;
        }
    }

    createLogHeader(logLevel, moduleName)
    {
        let logMessage = `${(new Date()).toISOString()}|${Logger.#LogLevelStr[logLevel]}|`;
        if (moduleName != null && moduleName.length > 0)
        {
            logMessage += `${moduleName}|`;
        }
        return logMessage;
    }

    minLogLevel = false;
    progressStarted = false;
}
