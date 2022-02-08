/** @description How to format the response */
export type ReturnAs = 'text' | 'blob' | 'formData' | 'arrayBuffer' | 'json'

/** @description Yafetch options */
export interface Options extends RequestInit {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'PATCH'

  /**
   * @description An optional BodyInit or object literal to set request's body
   * @see BodyInit
   * @see Record<string,any>
   */
  body?: any

  /** @description Plugins to run. These are categorized by their type and order of execution depends on plugin's location in this array */
  plugins?: {
    // eslint-disable-next-line no-use-before-define
    before?: Plugin[],
    // eslint-disable-next-line no-use-before-define
    wrap?: WrapPlugin[],
    // eslint-disable-next-line no-use-before-define
    after?: Plugin[]
  }

  /** @description Base url for this request. Prioritized over the base url in the global options, if any */
  baseUrl?: string

  /** @description Skip a plugin execution. This only applies to plugins in the global options */
  skipPlugins?: { [pluginName: string]: 'before' | 'after' | 'wrap' | 'all' }

  /** @description Optionally use another implementation for fetch instead of the browser provided API */
  fetchProxy?: (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>
}

/** @description Plugin context object passed to plugin execution */
export interface PluginContext {
  request: RequestInfo

  /** @description Only available in plugins with that run after the request */
  response?: Response

  /** @description Interpolated request options */
  requestOptions?: Options

  /** @description An object that contains data to share between plugins */
  data?: Record<string, any>
}

/** @description Plugin base interface defines common properties for all plugin types */
export interface PluginBase {
  /** @description Unique plugin name that can identify an instance */
  name: string
}

/** @description A standard plugin that runs before or after API request */
export interface Plugin extends PluginBase {
  /**
   * @description Execute the plugin
   * @param context Common context for plugins
   */
  run(context: PluginContext): Promise<unknown> | unknown
}

/** @description A wrap plugin to wrap other plugins or the API call. Wrapping order depends on location of the plugin in the `plugins.wrap`
 * @example
 * ```typescript
 * plugins: {
 *    // Plugin1 will wrap Plugin2 and Plugin2 will wrap the main API call since it's the last in the array
 *    wrap: [Plugin1, Plugin2]
 * }
 * ```
 */
export interface WrapPlugin extends PluginBase {
  /**
   * @description Execute the plugin
   * @param next Next plugin to execute. Must be called manually
   * @param context Common context for plugins
   */
  run(next: () => Promise<any>, context: PluginContext): Promise<any> | any
}

/**
 * @description Convert the headers to a Record<string, string>
 * @param headers Headers, js or array object
 * @returns Js object as Record<string, string>
 */
export const HeadersToRecords = (headers?: HeadersInit): Record<string, string> | undefined => {
  if (Array.isArray(headers) || headers?.constructor?.name === 'Headers') {
    const records: Record<string, string> = {}
    const value: string[][] = Array.from(headers as any)
    value.forEach((h) => { records[h[0]] = h[1] })
    return records
  }

  return headers as Record<string, string>
}
