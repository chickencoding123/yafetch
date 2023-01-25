import { createServer, RequestListener } from 'http'
import { AddressInfo } from 'net'
import axios, { Method } from 'axios'
import Yafetch from '@yafetch/core'
import AbortController from 'abort-controller'
import YafetchPluginRetry, { YafetchPluginRetryOptions } from './index'

jest.setTimeout(60000)

/** Helper to make API call in node environment. Uses "axios", but can be any API library. */
const createProxy = (validateStatus: boolean) => ({
  fetch: async (input: RequestInfo, init?: RequestInit | undefined): Promise<Response> => {
    const response = await axios({
      validateStatus: () => validateStatus,
      url: typeof input === 'string' ? input : input.url,
      method: init?.method as Method
    })

    return Promise.resolve({
      status: response.status,
      headers: response.headers,
      statusText: response.statusText,
      ok: /20\d/.test(response.status.toLocaleString('en')),
      type: 'default',
      url: response.config.url,
      text: () => Promise.resolve(response.data)
    } as unknown as Response)
  }
})

/** Helper function to run an HTTP server */
const withServer = (serverCallback: RequestListener, clientCallback: (port: number) => Promise<void>) => {
  const server = createServer(serverCallback)

  return new Promise<void>((resolve, reject) => {
    server.listen(async () => {
      const { port } = server.address() as AddressInfo
      try {
        await clientCallback(port)
        resolve()
      } catch (err) {
        reject(err)
      } finally {
        server.close()
      }
    })
    server.on('error', reject)
  })
}

describe('@yafetc/plugin-retry integration tests', () => {
  it('retries when response is a 500 error', () => {
    let i = 0
    return withServer(
      (req, res) => {
        if (i++ < 2) {
          res.writeHead(500)
          res.end()
        } else {
          res.end('test')
        }
      },
      async (port) => {
        const res = await Yafetch(`http://localhost:${port}`, {
          fetchProxy: createProxy(true).fetch,
          plugins: {
            wrap: [
              YafetchPluginRetry({
                delay: 2
              })
            ]
          }
        })
        expect(await res.text()).toBe('test')
      }
    )
  })

  it('resolves on >MAX_RETRIES', () => {
    return withServer(
      (req, res) => {
        res.writeHead(500)
        res.end()
      },
      async (port) => {
        const res = await Yafetch(`http://localhost:${port}`, {
          fetchProxy: createProxy(true).fetch,
          plugins: {
            wrap: [
              YafetchPluginRetry({
                delay: 2,
                maxRetries: 3
              })
            ]
          }
        })

        expect(res.status).toBe(500)
      }
    )
  })

  it('accepts a custom onRetry option', () => {
    const opts = {
      delay: 2,
      onRetry: jest.fn<boolean, [number, Error | undefined, Response | undefined]>(() => true),
      maxRetries: 3
    }

    return withServer(
      (req, res) => {
        res.writeHead(500)
        res.end()
      },
      async (port) => {
        const res = await Yafetch(`http://localhost:${port}`, {
          fetchProxy: createProxy(true).fetch,
          plugins: {
            wrap: [
              YafetchPluginRetry(opts)
            ]
          }
        })
        expect(opts.onRetry.mock.calls.length).toBe(3)
        expect(opts.onRetry.mock.calls[0][2]?.status).toBe(500)
        expect(opts.onRetry.mock.calls[1][2]?.status).toBe(500)
        expect(opts.onRetry.mock.calls[2][2]?.status).toBe(500)
        expect(res.status).toBe(500)
      }
    )
  })

  it('handles the "Retry-After" header', () => {
    return withServer(
      (req, res) => {
        res.writeHead(429, { 'Retry-After': 1 })
        res.end()
      },
      async (port) => {
        const startedAt = Date.now()
        await Yafetch(`http://localhost:${port}`, {
          fetchProxy: createProxy(true).fetch,
          plugins: {
            wrap: [
              YafetchPluginRetry({
                delay: 4
              })
            ]
          }
        })
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1010)
      }
    )
  })

  it('stops retrying when fetch throws `ERR_UNESCAPED_CHARACTERS` error', () => {
    const opts = {
      onRetry: jest.fn<boolean, [number, Error | undefined, Response | undefined]>(() => true),
      delay: 3
    }

    return withServer(
      (req, res) => {
        res.writeHead(200)
        res.end()
      },
      async (port) => {
        let err: Error | undefined
        try {
          await Yafetch(`http://localhost:${port}/\u0019`, {
            fetchProxy: () => {
              throw Error('Request path contains unescaped characters')
            },
            plugins: {
              wrap: [
                YafetchPluginRetry(opts)
              ]
            }
          })
        } catch (_err) {
          err = _err as Error
        }

        expect(err).not.toBeUndefined()
        expect(err?.message).toBe('Request path contains unescaped characters')
        expect(opts.onRetry.mock.calls.length).toBe(0)
      }
    )
  })

  it('does not retry if the request was aborted', () => {
    const timeout = 50
    const responseAfter = 100
    const controller = new AbortController()
    const opts = {
      onRetry: jest.fn<boolean, [number, Error | undefined, Response | undefined]>(() => true)
    }

    setTimeout(() => controller.abort(), timeout)

    return withServer(
      (req, res) => {
        setTimeout(() => {
          res.end('ha')
        }, responseAfter)
      },
      async (port) => {
        try {
          await Yafetch(`http://localhost:${port}`, {
            fetchProxy: createProxy(true).fetch,
            signal: controller.signal as AbortSignal,
            plugins: {
              wrap: [
                YafetchPluginRetry({
                  delay: 6
                })
              ]
            }
          })
        } catch (err) {
          expect(opts.onRetry.mock.calls.length).toBe(0)
        }
      }
    )
  })

  it('can handle multiple retries with custom "onRetry" logic which needs waiting every time', () => {
    let i = 0
    let totalMilliseconds = 0
    const dependeeFn = () => {
      return new Promise<boolean>((resolve) => {
        ++i
        if (i < 4) {
          totalMilliseconds += 500
          setTimeout(() => resolve(true), 500)
        } else {
          resolve(false)
        }
      })
    }
    const dependantFn = async () => {
      totalMilliseconds += 2000
      const result = await dependeeFn()
      return result
    }
    const opts: YafetchPluginRetryOptions & { onRetry: jest.Mock<Promise<boolean>> } = {
      onRetry: jest.fn(dependantFn),
      delay: 2,
      maxRetries: 4,
      mode: 'manual'
    }

    return withServer(
      (req, res) => {
        res.writeHead(500)
        res.end()
      },
      async (port) => {
        await Yafetch(`http://localhost:${port}`, {
          fetchProxy: createProxy(true).fetch,
          plugins: {
            wrap: [
              YafetchPluginRetry(opts)
            ]
          }
        })
        expect(totalMilliseconds).toEqual(9500)
        expect(opts.onRetry.mock.calls.length).toBe(4)
      }
    )
  })
})
