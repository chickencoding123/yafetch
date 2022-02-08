/// <reference types="./@types/node-blob" />

import fetchMock from 'jest-fetch-mock'
import { FormData } from 'formdata-node'
import Blob from 'node-blob'
import axios, { Method } from 'axios'

import yafetch, { GlobalOptions, mergeOptions } from './index'

const originalOptions = JSON.parse(JSON.stringify(GlobalOptions.yafetch))
const baseUrl = 'https://www.example.com'
fetchMock.enableMocks()

describe('@yafetch/core', () => {
  describe('config tests', () => {
    beforeEach(() => {
      fetchMock.resetMocks()
      GlobalOptions.yafetch = originalOptions
    })

    it('properly merges global options and request options', async () => {
      GlobalOptions.yafetch = {
        method: 'POST',
        baseUrl,
        cache: 'only-if-cached',
        credentials: 'omit',
        integrity: '54b0c58c7ce9f2a8b551351102ee0938',
        keepalive: true,
        mode: 'navigate',
        redirect: 'manual',
        referrer: 'http://example.com',
        referrerPolicy: 'no-referrer-when-downgrade',
        headers: {
          'Content-Type': 'plain/text'
        }
      }

      const opts = mergeOptions({
        method: 'DELETE',
        baseUrl: undefined,
        cache: undefined,
        keepalive: false,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test 1234'
        }
      })

      expect(opts.method).toBe('DELETE')
      expect(opts.baseUrl).toBeUndefined()
      expect(opts.cache).toBeUndefined()
      expect(opts.credentials).toBe('omit')
      expect(opts.integrity).toBe('54b0c58c7ce9f2a8b551351102ee0938')
      expect(opts.keepalive).toBe(false)
      expect(opts.mode).toBe('navigate')
      expect(opts.redirect).toBe('manual')
      expect(opts.referrer).toBe('http://example.com')
      expect(opts.referrerPolicy).toBe('no-referrer-when-downgrade')
      expect(opts.headers).toEqual({
        'Content-Type': 'application/json',
        'x-api-key': 'test 1234'
      })
    })

    it('can merge headers when headers instance is passed', () => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'x-api-key': 'test 1234'
      })
      const opts = mergeOptions({
        headers
      })

      expect(opts.headers).toEqual({
        'content-type': 'application/json',
        'x-api-key': 'test 1234'
      })
    })

    it('can merge headers when headers array is passed', () => {
      const opts = mergeOptions({
        headers: [
          ['Content-Type', 'application/json'],
          ['x-api-key', 'test 1234']
        ]
      })

      expect(opts.headers).toEqual({
        'Content-Type': 'application/json',
        'x-api-key': 'test 1234'
      })
    })
  })

  describe('plugins tests', () => {
    beforeEach(() => {
      fetchMock.resetMocks()
      GlobalOptions.yafetch = originalOptions
    })

    it('can execute all plugins in proper order and wait for promises', async () => {
      fetchMock.mockResponse(() => Promise.resolve(({ body: 'test plugin order' })))
      const log = jest.fn()

      GlobalOptions.yafetch.plugins = {
        before: [
          {
            name: 'before',
            run: () => log('global before')
          }
        ],
        after: [
          {
            name: 'after',
            run: () => log('global after')
          }
        ]
      }
      await yafetch('/get', {
        baseUrl,
        plugins: {
          before: [
            {
              name: 'before',
              run: () => log('before')
            }
          ],
          after: [
            {
              name: 'after',
              run: () => log('after')
            }
          ]
        }
      }, 'text')

      expect(log.mock.calls).toEqual([
        ['global before'],
        ['before'],
        ['global after'],
        ['after']
      ])

      log.mockReset()
      log.mockRestore()
    })

    it('is able to skip a plugin in global options', async () => {
      fetchMock.mockResponse(() => Promise.resolve(({ body: 'test skipping a plugin' })))
      const log = jest.fn()
      const pluginName = 'MyPlugin'

      GlobalOptions.yafetch.plugins = {
        before: [
          {
            name: pluginName,
            run: () => log('global before')
          }
        ],
        after: [
          {
            name: 'global after',
            run: () => log('global after')
          }
        ]
      }

      await yafetch('/get', {
        baseUrl,
        skipPlugins: {
          [pluginName]: 'all'
        },
        plugins: {
          before: [
            {
              name: pluginName,
              run: () => new Promise<void>((resolve) => {
                log('before')
                resolve()
              })
            }
          ],
          after: [
            {
              name: 'after',
              run: () => log('after')
            }
          ]
        }
      }, 'text')

      expect(log.mock.calls).toEqual([
        ['before'],
        ['global after'],
        ['after']
      ])

      log.mockReset()
      log.mockRestore()
    })

    it('can cascade between two wrap plugins', async () => {
      let managedToCatch = false
      let managedToMutateOptions = false

      await yafetch('/get', {
        baseUrl,
        plugins: {
          wrap: [
            {
              name: 'plugin1',
              run: async (next, context) => {
                context.requestOptions = context.requestOptions || {}
                context.requestOptions.mode = 'cors'

                try {
                  await next()
                } catch {
                  managedToCatch = true
                }
              }
            },
            {
              name: 'plugin2',
              run: async (next, context) => {
                if (context.requestOptions?.mode === 'cors') {
                  managedToMutateOptions = true
                }
                throw Error('Yafetch: Testing error bubbling to see if the previous plugin is able to handle it')
              }
            }
          ]
        }
      })

      expect(managedToCatch).toBe(true)
      expect(managedToMutateOptions).toBe(true)
    })

    it('can cascade between 4 wrap plugins', async () => {
      const response = await yafetch('/get', {
        baseUrl,
        plugins: {
          wrap: [
            {
              name: 'plugin1',
              run: async (next) => (await next()) + ' World'
            },
            {
              name: 'plugin2',
              run: async (next) => (await next()) + ' Hello'
            },
            {
              name: 'plugin3',
              run: async (next) => (await next()) + ' from Yafetch:'
            },
            {
              name: 'plugin4',
              run: async () => 'This is a message'
            }
          ]
        }
      })

      expect(response).toBe('This is a message from Yafetch: Hello World')
    })
  })

  describe('request tests', () => {
    beforeEach(() => {
      fetchMock.resetMocks()
      GlobalOptions.yafetch = originalOptions
    })

    it('throw error for relative urls when there is no base url present anywhere', async () => {
      GlobalOptions.yafetch.baseUrl = undefined
      await expect(() => yafetch('/get')).rejects.toThrowError('Yafetch: a relative url was seen without a base url in the options. /get')
    })

    it('can send a `GET` request and return in "text" format', async () => {
      fetchMock.mockResponse(() => Promise.resolve({ body: 'test 2' }))
      const response = await yafetch('/get', { baseUrl }, 'text')
      expect(response).toEqual('test 2')
    })

    it('can send a `GET` request with url-encoded data and return in "text" format', async () => {
      fetchMock.mockResponse(() => Promise.resolve({ body: 'test 2' }))
      const response = await yafetch(`${baseUrl}/get`, { body: { name: 'john', lastName: 'doe' } }, 'text')
      expect(response).toEqual('test 2')
      expect(fetchMock.mock.calls).toEqual(
        [
          [
            'https://www.example.com/get?name=john&lastName=doe',
            {
              fetchProxy: fetchMock,
              headers: {},
              method: 'GET',
              plugins: undefined
            }
          ]
        ]
      )
    })

    it('can send a `POST` request and return in "text" format', async () => {
      fetchMock.mockResponse(() => Promise.resolve({ body: 'test 3' }))
      const response = await yafetch('/post', { method: 'POST', body: {}, baseUrl }, 'text')
      expect(response).toEqual('test 3')
    })

    it('can send a `CONNECT` request and return in "json" format', async () => {
      fetchMock.mockResponse(() => Promise.resolve({ body: JSON.stringify({ message: 'test 4' }) }))
      const response: { message: string } = await yafetch('/connect', { method: 'CONNECT', baseUrl }, 'json')
      expect(response.message).toBe('test 4')
    })

    it('can send a `HEAD` request and return in default format', async () => {
      fetchMock.mockResponse(() => Promise.resolve({ body: undefined }))
      const response = await yafetch('/head', { method: 'HEAD', baseUrl })
      expect(response.body).toBeNull()
    })

    it('can send a `OPTIONS` request and return as "arrayBuffer" format', async () => {
      fetchMock.mockImplementation(() => Promise.resolve(new Response(new ArrayBuffer(5))))
      const response = await yafetch('/options', { method: 'OPTIONS', baseUrl }, 'arrayBuffer')
      expect(new Int8Array(response)).toEqual(new Int8Array([0, 0, 0, 0, 0]))
    })

    it('can send a `TRACE` request and return as default format', async () => {
      fetchMock.mockResponse(() => Promise.resolve({ body: undefined }))
      const response = await yafetch('/options', { method: 'TRACE', baseUrl })
      expect(response.body).toBeNull()
    })

    it('can send a `DELETE` request and return in "blob" format', async () => {
      const blob = new Blob(['test 5'], { type: 'text/plain' })
      fetchMock.mockResponse(() => Promise.resolve({ body: JSON.stringify(blob) }))
      const response = await yafetch('/options', { method: 'DELETE', baseUrl }, 'blob')
      expect(response.text()).resolves.toBe('{"buffer":{"type":"Buffer","data":[116,101,115,116,32,53]}}')
    })

    it('can send a `PATCH` request and return in "formData" format', async () => {
      fetchMock.mockImplementation(() => {
        const formData = new FormData()
        formData.append('key', 'test 6')
        const r = new Response()
        r.formData = () => Promise.resolve(formData) as any
        return Promise.resolve(r)
      })
      const response = await yafetch('/options', { method: 'PATCH', baseUrl }, 'formData')
      expect(response.get('key')).toBe('test 6')
    })

    it('can send a `PUT` request and return in "text" format', async () => {
      fetchMock.mockResponse(() => Promise.resolve({ body: 'test 7' }))
      const response = await yafetch('/options', { method: 'PATCH', baseUrl }, 'text')
      expect(response).toBe('test 7')
    })

    it('can send a request using an alternative `fetchProxy`', async () => {
      const proxy = {
        fetch: async (input: RequestInfo, init?: RequestInit | undefined): Promise<Response> => {
          const response = await axios({
            url: typeof input === 'string' ? input : input.url,
            method: init?.method as Method
          })
          return Promise.resolve({
            text: () => Promise.resolve(response.data)
          }) as any
        }
      }
      const fetchSpy = jest.spyOn(proxy, 'fetch')
      const response = await yafetch('/', { baseUrl, fetchProxy: proxy.fetch }, 'text')
      expect(response).toContain('<html>')
      expect(fetchSpy.mock.calls).toEqual([
        [
          'https://www.example.com/',
          {
            baseUrl: 'https://www.example.com',
            fetchProxy: proxy.fetch,
            headers: {},
            method: 'GET',
            plugins: undefined
          }
        ]
      ])
    })

    it('can send a `GET` request by using an existing `Request` instance', async () => {
      fetchMock.mockResponse(() => Promise.resolve({ body: 'test 8' }))
      const existingRequest = new Request({
        // fns
        arrayBuffer: jest.fn(),
        blob: jest.fn(),
        clone: jest.fn(),
        formData: jest.fn(),
        json: jest.fn(),
        text: jest.fn(),
        // attrs
        cache: 'no-store',
        credentials: 'omit',
        destination: 'manifest',
        headers: new Headers({ 'Content-Type': 'text/plain' }),
        url: baseUrl,
        body: null,
        bodyUsed: true,
        integrity: '',
        keepalive: false,
        method: 'GET',
        mode: 'navigate',
        redirect: 'manual',
        referrer: '',
        referrerPolicy: 'origin-when-cross-origin',
        signal: {} as AbortSignal
      })
      const response = await yafetch(existingRequest, { baseUrl, body: { name: 'John', lastName: 'Doe' } }, 'text')
      expect(response).toBe('test 8')
    })
  })
})
