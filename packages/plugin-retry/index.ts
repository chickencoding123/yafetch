import { WrapPlugin } from '../shared'

const DEFAULT_DELAY = 10

export interface YafetchPluginRetryResponse extends Response {
  headers: Headers & HeadersInit
}

/** @description Retry options for this plugin */
export interface YafetchPluginRetryOptions {
  /**
   * @description `manual` mode allows you to control the retry logic on the client-side while `header` mode will work with the HTTP header that's returned by the server
   * @see [Retry-After](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After)
   * @default header
  */
  mode?: 'manual' | 'header'

  /**
   * @description When to stop retrying and return the last response, if any
   * @default 3
  */
  maxRetries?: number

  /**
   * @description Retry delay in seconds or a function that returns the delay seconds. Only works in manual mode
   * @default 10
  */
  delay?: number | ((attempt: number, err?: Error, response?: YafetchPluginRetryResponse) => number)

  /**
   * @description Optional hook to execute before each retry. Can cancel the call by returning `false`.
   * @param attempt Count of this retry attempt
   * @param err The reason for retrying again
   * @param response Response object if the API returned one
   * @returns A boolean that will decide if the next retry should happen or not. Can be a promise which is automatically awaited. This is useful when you need to wait for a condition before the next retry happens. E.g. network connectivity.
   */
  onRetry?: (attempt: number, err?: Error, response?: YafetchPluginRetryResponse) => Promise<boolean> | boolean
}

/**
 * @private
 * @description Read, parse and return the seconds to wait before the next retry
 * @param response API response object
 * @returns Number of seconds to wait before the next retry, if any, acording to server
 */
export const getRetryAfterSeconds = (response: YafetchPluginRetryResponse) => {
  const headerValInArray = () => {
    const header = (response.headers as string[][]).find((pair: string[]) => pair[0].toLocaleLowerCase('en') === 'retry-after')
    if (header) return header[1]
  }
  const headerVal: string = response.headers.get
    ? response.headers.get('retry-after')
    : Array.isArray(response.headers) && ~~response.headers.length && Array.isArray(response.headers[0])
      ? headerValInArray()
      : ((response.headers as any)['Retry-After'] || (response.headers as any)['retry-after'])

  if (!headerVal) {
    console.warn(`Yafetch-Plugin-Retry: No header "Retry-After" was found on the response object. ${JSON.stringify(response.headers)}`)
    return
  }

  const retryNumber = +headerVal
  if (Number.isFinite(retryNumber)) {
    return retryNumber
  }

  const retryDate = new Date(headerVal)
  if (retryDate.toString() === 'Invalid Date') {
    console.warn(`Yafetch-Plugin-Retry: Invalid "Retry-After" value in the API response header: ${headerVal}`)
    return
  }

  const delay = retryDate.getTime() - Date.now()
  if (delay > 0) {
    return Math.ceil(delay / 1000)
  }
}

const YafetchPluginPluginRetry = (options?: YafetchPluginRetryOptions): WrapPlugin => {
  return {
    name: 'YafetchPluginRetry',
    run: (next) => {
      const opts: YafetchPluginRetryOptions & Required<Omit<YafetchPluginRetryOptions, 'onRetry'>> = {
        mode: 'manual',
        delay: DEFAULT_DELAY,
        maxRetries: 3,
        onRetry: (attempt, err, response) => !response?.ok,
        ...(options || {})
      }

      return new Promise((resolve, reject) => {
        const wrappedNext = (attempt: number) => {
          async function onRetry(err?: Error, response?: Response) {
            const shouldRetry = typeof opts.onRetry === 'function' ? await opts.onRetry(attempt, err, response) : true

            if (shouldRetry) {
              retry(attempt, undefined, response)
            } else {
              resolve(response)
            }
          }

          next()
            .then((res: Response) => {
              const response = res && res.clone
                ? res.clone()
                : res
                  ? Object.assign({}, res)
                  : undefined

              try {
                if (attempt < opts.maxRetries) {
                  onRetry(undefined, response)
                } else {
                  resolve(response)
                }
              } catch (error) {
                reject(error)
              }
            })
            .catch((err) => {
              // stop retrying when aborted by the user or an unscapped URL was passed in
              if (
                err.type === 'aborted' ||
                err.name === 'AbortError' ||
                err.code === 'ERR_UNESCAPED_CHARACTERS' ||
                err.message === 'Request path contains unescaped characters'
              ) {
                return reject(err)
              }

              try {
                if (attempt < opts.maxRetries) {
                  onRetry(err)
                } else {
                  reject(err)
                }
              } catch (err2) {
                reject(err2)
              }
            })
        }

        function retry(attempt: number, error?: Error, response?: Response) {
          let delay = opts.mode === 'header' && response
            ? getRetryAfterSeconds(response)
            : typeof opts.delay === 'function'
              ? opts.delay(attempt, error, response)
              : opts.delay

          if (!delay) {
            console.warn(`Yafetch-Plugin-Retry: Delay is undefined under the "${opts.mode}" mode. Either switch to another mode or provide a delay number/function. Falling back to default ${DEFAULT_DELAY} seconds.`)
            delay = DEFAULT_DELAY
          }

          setTimeout(() => wrappedNext(++attempt), delay * 1e3)
        }

        wrappedNext(0)
      })
    }
  }
}

export default YafetchPluginPluginRetry
