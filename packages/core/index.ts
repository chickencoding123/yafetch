import { Options, ReturnAs, Plugin, WrapPlugin, PluginContext, HeadersToRecords } from '../shared'

/**
 * @private
 * @description The plugin that executes the API call
 */
const yafetchPluginAPICall: WrapPlugin = {
  name: 'YafetchPluginCall',
  run: (next, context) => {
    const fetchProxy: Options['fetchProxy'] = context.requestOptions?.fetchProxy || GlobalOptions.yafetch?.fetchProxy

    if (!fetchProxy) {
      /* istanbul ignore next */
      throw Error('Yafetch: unable to find a suitable fetch factory. It seems you are not running in browser environment, but did not provide an alternative fetch factory.')
    }

    return fetchProxy(context.request, context.requestOptions) as Promise<Response>
  }
}

/** @description Global options to use for all API calls */
export const GlobalOptions = {
  yafetch: {
    method: 'GET'
  } as Omit<Options, 'body' | 'data' | 'window' | 'signal' | 'skipPlugins'>
}

/**
 * @description Make a fetch call and return the response
 * @param request Existing request or a url
 */
async function send(request: RequestInfo): Promise<Response>;

/**
 * @description Make a fetch call and return the response
 * @param request Existing request or a url
 * @param options Fetch options
 */
async function send(request: RequestInfo, options: Options): Promise<Response>;

/**
 * @description Make a fetch call and return the response
 * @param request Existing request or a url
 * @param options Fetch options
 * @param returnAs Parse response as string
 */
async function send(request: RequestInfo, options: Options | undefined, returnAs: 'text'): Promise<string>;

/**
 * @description Make a fetch call and return the response
 * @param request Existing request or a url
 * @param options Fetch options
 * @param returnAs Parse response as Blob
 */
async function send(request: RequestInfo, options: Options | undefined, returnAs: 'blob'): Promise<Blob>;

/**
 * @description Make a fetch call and return the response
 * @param request Existing request or a url
 * @param options Fetch options
 * @param returnAs Parse response as FormData
 */
async function send(request: RequestInfo, options: Options | undefined, returnAs: 'formData'): Promise<FormData>;

/**
 * @description Make a fetch call and return the response
 * @param request Existing request or a url
 * @param options Fetch options
 * @param returnAs Parse response as ArrayBuffer
 */
async function send(request: RequestInfo, options: Options | undefined, returnAs: 'arrayBuffer'): Promise<ArrayBuffer>;

/**
 * @description Make a fetch call and return the response
 * @param request Existing request or a url
 * @param options Fetch options
 * @param returnAs Parse response as a JSON object
 */
async function send<TResponse>(request: RequestInfo, options: Options | undefined, returnAs: 'json'): Promise<TResponse>;

async function send(request: RequestInfo, options?: Options, returnAs?: ReturnAs) {
  let response: Response
  const req = createRequest(request, options?.baseUrl)
  const opts: Options = mergeOptions(options)

  switch (opts.method) {
    case 'PUT':
    case 'POST': {
      if (opts.body) {
        const isStringData = typeof opts.body === 'string'
        const headers = opts.headers as Record<string, string>

        if (!(headers && headers['Content-Type'])) {
          headers['Content-Type'] = !isStringData ? 'application/json' : 'text/plain'
        }

        opts.body = !isStringData ? JSON.stringify(opts.body) : opts.body
      }

      response = await executeCall(req, opts)
      break
    }

    case 'DELETE': {
      response = await executeCall(req, opts)
      break
    }

    case 'GET':
    default: {
      if (opts.body && ~~Object.getOwnPropertyNames(opts.body).length) {
        const params = new URLSearchParams()
        Object.keys(opts.body).forEach(key => params.append(key, (opts.body as Record<string, any>)[key]))
        delete opts.body

        if (typeof req === 'string') {
          response = await executeCall(req + '?' + params, opts)
        } else {
          response = await executeCall(req.url + '?' + params, opts)
        }
      } else {
        response = await executeCall(req, opts)
      }
      break
    }
  }

  return returnAs === 'json'
    ? await response.json()
    : returnAs === 'arrayBuffer'
      ? await response.arrayBuffer()
      : returnAs === 'blob'
        ? await response.blob()
        : returnAs === 'formData'
          ? await response.formData()
          : returnAs === 'text'
            ? await response.text()
            : response
}

export default send

const createRequest = (request: RequestInfo, baseURL?: string) => {
  if (typeof request === 'string' && /^\//.test(request)) {
    if (!baseURL && !GlobalOptions.yafetch?.baseUrl) {
      throw Error(`Yafetch: a relative url was seen without a base url in the options. ${request}`)
    }
    return (baseURL || GlobalOptions.yafetch?.baseUrl) + request
  }

  return request
}

/**
 * @description Execute a fetch request
 * @param requst Request object
 * @param options Request options
 */
async function executeCall(request: RequestInfo, options?: Options) {
  const before: Plugin[] = [
    ...(GlobalOptions.yafetch?.plugins?.before?.filter((p) => !options?.skipPlugins || (options?.skipPlugins[p.name] !== 'before' && options?.skipPlugins[p.name] !== 'all')) || []),
    ...(options?.plugins?.before || [])
  ]
  const after: Plugin[] = [
    ...(GlobalOptions.yafetch?.plugins?.after?.filter((p) => !options?.skipPlugins || (options?.skipPlugins[p.name] !== 'after' && options?.skipPlugins[p.name] !== 'all')) || []),
    ...(options?.plugins?.after || [])
  ]
  const wrap: WrapPlugin[] = [
    ...(GlobalOptions.yafetch?.plugins?.wrap?.filter((p) => !options?.skipPlugins || (options?.skipPlugins[p.name] !== 'wrap' && options?.skipPlugins[p.name] !== 'all')) || []),
    ...(options?.plugins?.wrap || [])
  ]

  const runners: (() => Promise<unknown>)[] = []
  const pluginContext: PluginContext = { request, requestOptions: options }
  /* istanbul ignore next */
  const defaultRun = async () => await yafetchPluginAPICall.run(async () => { /** noop */ }, pluginContext)

  await Promise.all(before.map((p) => p.run(pluginContext)))
  if (wrap.length) {
    for (let i = 0; i < wrap.length; i++) {
      if (i === wrap.length - 1) {
        runners.push(async () => await wrap[i].run(defaultRun, pluginContext))
      } else {
        runners.push(async () => await wrap[i].run(runners[i + 1], pluginContext))
      }
    }
  } else {
    runners.push(defaultRun)
  }
  const response = await runners[0]() as Response
  await Promise.all(after.map((p) => p.run({ ...pluginContext, response })))

  return response
}

/**
 * @private
 * @description Merge per-request options with global options
 * @param options Incoming options to merge with global options
 * @returns Merged per-request and global options
 */
export function mergeOptions(options?: Options): Options {
  const globalOpts = GlobalOptions.yafetch || {}
  const opts = options || {}

  const headers = HeadersToRecords(globalOpts.headers) || {}
  const optHeaders = HeadersToRecords(opts.headers) || {}
  Object.keys(optHeaders).forEach((name) => { headers[name] = optHeaders[name] })

  return {
    ...globalOpts,
    plugins: undefined,
    ...opts,
    headers,
    method: opts.method || globalOpts.method || 'GET',
    fetchProxy: opts.fetchProxy || globalOpts.fetchProxy || (typeof fetch !== 'undefined' ? fetch : undefined)
  }
}
