`@yafetch/plugin-retry`
======================

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/chickencoding123/yafetch/blob/main/LICENSE)

## About
This plugin is part of [yafetch](https://github.com/chickencoding123/yafetch)

## Usage
```ts
const yafetch  = require('@yafetch/core')
const pluginRetry = require('@yafetch/plugin-retry')
// or
import yafetch, { GlobalOptions } from '@yafetch/core'
import pluginRetry from '@yafetch/plugin-retry'
// then, add plugin in global options
GlobalOptions.yafetch = {
  // ... other options, if any
  plugins: {
    wrap: [
      pluginRetry({
        delay: 2
      })
    ]
  }
}
// or in a per-request options
const res = await yafetch('< string url or Request object >', {
  // ... other options, if any
  plugins: {
    wrap: [
      pluginRetry({
        delay: 2
      })
    ]
  }
  // ... other options, if any
})
```

See [plugin-retry](https://chickencoding123.github.io/yafetch/modules/plugin-retry.html) documentation for more information.

## Previous work
This plugin was inspired by [vercel/fetch-retry](vercel/fetch-retry).