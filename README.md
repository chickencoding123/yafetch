Yafetch
=======

<div align="center">

Yet another fetch is a backward compatible, dependency free, drop-in wrapper for fetch API
  
[![npm](https://img.shields.io/npm/v/@yafetch/core)](https://www.npmjs.com/package/@yafetch/core) [![License](https://img.shields.io/npm/l/@yafetch/core)](https://github.com/chickencoding123/yafetch/blob/main/LICENSE) [![bundle size](https://img.badgesize.io/https:/unpkg.com/@yafetch/core/dist/index.js?max=300000&compression=gzip)](https://unpkg.com/@yafetch/core/dist/index.js)

</div>

## Features
- Plugins for various features such as retries, error handling, logging, parsing etc...
- Matches the _fetch_ API signature by extension and enhancements
- Can be used with an alternative _fetch_ implementation such as [node-fetch](https://github.com/node-fetch/node-fetch)
- Automated parsing of request/response data
- Global options
- ... and more

## How to use
```sh
npm i @yafetch/core --save
# or
yarn add @yafetch/core --save
```
Usage is mostly identical, besides a few added features, to the standard _fetch_ API:
```ts
import yafetch from '@yafetch/core'
const html = await yafetch('https://www.example.com') // as opposed to fetch('https://www.example.com')
```
The only exception is the ability to pass `body` for `GET` requests, which `yafetch` will convert to `URLSearchParams` automatically:
```ts
import yafetch from '@yafetch/core'
const html = await yafetch('https://www.example.com', { body: { name: 'john' } }) // will send https://www.example.com/?name=john
```

## Plugins
The most powerful aspect of `yafetch` is its plugin system, allowing full control over the API calls. There are three types of plugins categorized by their execution order relative to the main API call, "before" and "after" plugins run before or after the API request while "wrap" plugins will wrap the API call itself. These wrap plugins also wrap each other allowing for communication between multiple plugins and advanced scenarios such as retries, error handling etc...

## Custom fetch implementation
`Yafetch` you can provide an alternative proxy function to use instead when running in a non-browser environment such as node.js. To use this feature simply pass a `fetchProxy` in the options, from there it's up to you how the API call happens. See an example of this in tests under the `core` package.

## Contribution

Please make sure to read the [Contributing Guide](https://github.com/chickencoding123/yafetch/blob/main/.github/CONTRIBUTING.md) before you work on this project.

## License

[MIT](https://opensource.org/licenses/MIT)