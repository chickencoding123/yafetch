import { createServer } from 'http'
import { AddressInfo } from 'net'
import axios, { Method } from 'axios'
import Yafetch from '@yafetch/core'
import AbortController from 'abort-controller'
import YafetchPluginRetry from './index'

jest.setTimeout(60000)

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
    } as any)
  }
})

describe('@yafetc/plugin-retry integration tests', () => {
  it('retries when response is a 500 error', () => {
    let i = 0
    const server = createServer((req, res) => {
      if (i++ < 2) {
        res.writeHead(500)
        res.end()
      } else {
        res.end('test')
      }
    })

    return new Promise<void>((resolve, reject) => {
      server.listen(async () => {
        try {
          const { port } = server.address() as AddressInfo
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
          resolve()
        } catch (err) {
          reject(err)
        } finally {
          server.close()
        }
      })
      server.on('error', reject)
    })
  })

  it('resolves on >MAX_RETRIES', () => {
    const server = createServer((req, res) => {
      res.writeHead(500)
      res.end()
    })

    return new Promise<void>((resolve, reject) => {
      server.listen(async () => {
        try {
          const { port } = server.address() as AddressInfo
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
          return resolve()
        } finally {
          server.close()
        }
      })
      server.on('error', reject)
    })
  })

  it('accepts a custom onRetry option', () => {
    const server = createServer((req, res) => {
      res.writeHead(500)
      res.end()
    })

    return new Promise<void>((resolve, reject) => {
      const opts = {
        delay: 2,
        onRetry: jest.fn<boolean, [number, Error | undefined, Response | undefined]>(() => true),
        maxRetries: 3
      }

      server.listen(async () => {
        try {
          const { port } = server.address() as AddressInfo
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
          return resolve()
        } finally {
          server.close()
        }
      })
      server.on('error', reject)
    })
  })

  it('handles the "Retry-After" header', async () => {
    const server = createServer((req, res) => {
      res.writeHead(429, { 'Retry-After': 1 })
      res.end()
    })

    return new Promise<void>((resolve, reject) => {
      server.listen(async () => {
        const { port } = server.address() as AddressInfo
        try {
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
          resolve()
        } catch (err) {
          reject(err)
        } finally {
          server.close()
        }
      })
      server.on('error', reject)
    })
  })

  it('stops retrying when fetch throws `ERR_UNESCAPED_CHARACTERS` error', async () => {
    const opts = {
      onRetry: jest.fn<boolean, [number, Error | undefined, Response | undefined]>(() => true),
      delay: 3
    }

    let err: Error | undefined
    try {
      await Yafetch('http://localhost/\u0019', {
        fetchProxy: createProxy(true).fetch,
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
  })

  it('does not retry if the request was aborted', async () => {
    const timeout = 50
    const responseAfter = 100
    const server = createServer((req, res) => {
      setTimeout(() => {
        res.end('ha')
      }, responseAfter)
    })

    const controller = new AbortController()
    const timeoutHandler = setTimeout(() => {
      controller.abort()
    }, timeout)
    const opts = {
      onRetry: jest.fn<boolean, [number, Error | undefined, Response | undefined]>(() => true)
    }

    return new Promise<void>((resolve, reject) => {
      server.listen(async () => {
        try {
          const { port } = server.address()as AddressInfo
          await Yafetch(`http://localhost:${port}`, {
            fetchProxy: createProxy(true).fetch,
            signal: controller.signal,
            plugins: {
              wrap: [
                YafetchPluginRetry({
                  delay: 6
                })
              ]
            }
          })
          resolve()
        } catch (err) {
          expect(opts.onRetry.mock.calls.length).toBe(0)
          resolve()
        } finally {
          server.close()
          clearTimeout(timeoutHandler)
        }
      })
      server.on('error', reject)
    })
  })

  it('awaits an "onRetry" promise', async () => {
    const server = createServer((req, res) => {
      res.writeHead(500)
      res.end()
    })

    const opts = {
      onRetry: jest.fn(() => {
        return new Promise<boolean>((resolve) => {
          setTimeout(() => {
            resolve(false)
          }, 10000)
        })
      }),
      delay: 4
    }

    return new Promise<void>((resolve, reject) => {
      server.listen(async () => {
        const { port } = server.address() as AddressInfo
        try {
          const startedAt = Date.now()
          await Yafetch(`http://localhost:${port}`, {
            fetchProxy: createProxy(true).fetch,
            plugins: {
              wrap: [
                YafetchPluginRetry(opts)
              ]
            }
          })
          expect(Date.now() - startedAt).toBeGreaterThanOrEqual(10000)
          expect(opts.onRetry.mock.calls.length).toBe(1)
          resolve()
        } catch (err) {
          reject(err)
        } finally {
          server.close()
        }
      })
      server.on('error', reject)
    })
  })
})
