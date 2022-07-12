# Babel 配置详解

> Babel 包含一系列工具链，主要用于将 ECMAScript 2015+ 版本的代码转换为向后兼容的 JavaScript 语法，以便能够运行在当前和旧版本的浏览器或其他环境中

分为语法（Syntax）转换和 API 填充

- 语法转换：比如箭头函数转为 `function`；`const`、`let` 转换
- API 填充：一些内置的方法和对象，如 `Promise`、`Array.from`、`SetMaps`、`Proxy` 等

```txt
# 内部大致流程
js code ==(parser)=> AST --(use plugins)--> AST ==(generator)=> js code
```

## 包介绍

> 在 Babel 6.x 版本，包名：`babel-core`、`babel-preset-env`、`babel-plugin-*`
> 在 Babel 7.x 版本，包名：`@babel/core`、`@babel/preset-env`、...

### `babel-loader`

用于 webpack 的 loader 配置，加载 Babel 模块，它依赖 `@babel/core`

### `@babel/core`

Babel 的核心库，就是完成 `code => ast` 和 `ast => code` 的过程

```js
// 7.x 版本，手动尝试 babel 转译效果
const babel = require('@babel/core')

/**
 * code: 'const fn = (a) => console.log(a)'
 *
 * options: {
 *   ast: true,       // 生成 ast
 *   code: true,      // 生成转化后的 code
 *   plugins: [],     // 插件
 *   presets: []      // 预设
 * }
 */
babel.transform(code, options, function (err, result) {
  result // => { code, map, ast }
})
```

### `@babel/plugin-*`

插件，具体某个语法转换的插件

如：`@babel/plugin-transform-arrow-functions` 表示箭头函数转换为 `function` 定义的插件

插件数组如果配置了多个，执行顺序是**从左向右**

> Tips: Babel 6.x 以后，在不配置任何 plugin 时，Babel 不会转换你的代码：[babel-6-demo](./6-pure/index.js)

### `@babel/preset-*`

预设环境，实现语法转换。如：

- `babel-preset-es2015` 6.x 版本，包含所有 es2015 插件的预设集
- `babel-preset-stage-2` 6.x 版本，stage-2 提案阶段的预设集
- `@babel/preset-env` 7.x 版本包含了所有 JS 版本的环境预设集

预设数组如果配置了多个，执行顺序的**从右向左**，如：

```js
presets: ['@babel/preset-react', '@babel/preset-env']
```

另外一个重要的点：**`plugin` 会在 `preset` 之前执行**

### `core-js`

提供 API 填充，与 Babel 紧密集成。是 Babel 解决兼容问题的核心依赖

#### `core-js@2`

```js
// ──┬ core-js@2
//   ├── ...
//   ├── library
//   └── modules

// 默认，实际上就是 require `shim` + `modules 下的辅助函数`
require('core-js')

// 不会污染全局空间的 library
var core = require('core-js/library')

// 仅仅是 polyfill 本身
require('core-js/shim')
```

> 具体技术细节，见 library 和 modules 下，`$export` 不同的写法：
> modules: [extend global](https://github.com/zloirock/core-js/blob/ffb783b746849c2b14258e6bef6106f1dcab2a66/modules/_export.js#L27)
> library: [prevent global pollution for namespaces](https://github.com/zloirock/core-js/blob/ffb783b746849c2b14258e6bef6106f1dcab2a66/library/modules/_export.js#L26-L50)

#### `core-js@3`

```js
// ──┬ core-js@3
//   ├─┬ core-js            // 完整包
//   | └── actual             // polyfill 本身
//   └── core-js-pure       // 不会污染全局变量
```

`core-js@3` 更改了架构，采用了 monorepo

2 版本已不再维护，所有新功能和 ES 新特性的支持均在 3 版本上开发。（2 与 3 不兼容）

## 语法转换和 API 填充方案

### Babel 6.x 版本

#### `babel-polyfill`

emulate（模拟）完整的 ES2015+ 运行时环境，来实现 API 的填充。因此，工程化项目里在 `package.json` 需要作为 `dependencies` 安装，然后在入口文件引入 `import 'babel-polyfill'`；或者通过 [CDN](https://www.bootcdn.cn/babel-polyfill/6.26.0/) 引入 polyfill 包

> Tips：
>
> 1. 通过一个简单的 HTML 文件验证通过 CDN 引入 6.x 版本 polyfill 效果：[6-html-with-polyfill](./6-html-with-polyfill.html)
> 2. 在这里下载 [Firefox 27.0.1](https://ftp.mozilla.org/pub/firefox/releases/27.0.1/mac/zh-CN/) 直接打开 HTML 文件，或者使用 Chrome 插件 [IE Tab](https://chrome.google.com/webstore/detail/ie-tab/hehijbfgiekmjfkfjpbkbammjbdenadd/related?utm_source=chrome-ntp-icon)，通过启动本地服务打开 HTML 文件

包结构：

```txt
# npm list --all

──┬ babel-polyfill@6.x
  ├── babel-runtime@6.x
  ├── core-js@2.x
  └── regenerator-runtime@0.x        // 支持 generator/yield 和 async/await
```

`babel-polyfill` 大而全，因此比较适合业务开发

#### `babel-preset-env`

根据指定的目标环境，完成语法转换，以及**自动**从 `babel-polyfill` 导入 polyfill。它作为 `preset`，需要与 Babel 的工具配合使用：

> 1. 它包含很多 plugin，做语法转换
> 2. 填充 API 则需要安装 `babel-polyfill` 作为 dependencies，同时在入口文件 `import 'babel-polyfill'`

```json
// .babelrc 配置文件
{
  "presets": [
    [
      "env",
      {
        "targets": {
          "browsers": [
            "safari >= 10"     // 设置不同版本的浏览器，查看 polyfill 效果，需要兼容的浏览器版本越低，require 的包越多
          ]
        },
        "debug": true          // 开启 debug 选项，查看导入了哪些 polyfill
        "useBuiltIns": true    // 设置为 true，引入 polyfill
      }
    ]
  ]
}
```

> 通过 babel-cli 查看转换效果，Demo 见：[6-preset-env](./6-preset-env/input.js)

转换结果：

<img width="80%" src="https://raw.githubusercontent.com/draculapile/image-host/master/img/20220523180249.png">

> `_asyncToGenerator` 是一个辅助函数，Babel 在转换代码的过程中，会有很多的辅助函数，称之为 helpers

#### `babel-plugin-transform-runtime` + `babel-runtime`

`babel-runtime` 构成：

```txt
──┬ babel-runtime@6.x
  ├── helpers
  ├── core-js/library // @2
  └── regenerator
```

`transform-runtime` 是一个 `plugin`，自然也需要依赖 Babel 工具链。它的工作：

- **自动**从 `babel-runtime` 引入 `regenerator` 或者 `core-js` 模块，实现 API 填充
  - 当然，如果你只想使用 `babel-runtime`，可以手动在某个文件内引入模块，像这样：`const Promise = require('babel-runtime/core-js/promise')`
- 不会像 `babel-preset-env` 那样，转换代码时为每个文件写入 helpers；而是从 `babel-runtime` 引入对应 helper

> polyfill 方案由 `babel-runtime` 提供。因此，在使用这个插件时，`babel-runtime` 要作为 dependencies 安装

这个组合是解决**自动按需引入 polyfill** 的同时，**复用 helpers** 辅助函数；而且，因为 `babel-runtime` 引入的是 `core-js/library`，所以也**不会污染全局变量**

安装：

```shell
npm i babel-plugin-transform-runtime --save-dev
npm i babel-runtime --save
```

配置文件：

```json
{
  "plugins": ["transform-runtime"],
  // 依然需要配置 presets 完成 syntax 转换
  "presets": [
    [
      "env",
      {
        "targets": {},
        "debug": true
      }
    ]
  ]
}
```

`Array.from`，`Promise`，`[].includes` 转换结果：

<img width="80%" src="https://raw.githubusercontent.com/draculapile/image-host/master/img/20220523221221.png">

可以看到这种方案的**问题：不支持实例方法**，如 `['a', 'b', 'c'].includes()`，因为它依赖 `core-js/library`，不会修改原型

### Babel 7.x 版本

1. 对于未发布的 stage 阶段特性，不再支持（移除相关 preset）
2. 包名由 `babel-*` 变为 `@babel/*`
3. `babel-preset-es2015/es2016` 等等都废弃了，取而代之的就是合集 `@babel/preset-env`
4. 6.x 的配置文件 `.babelrc` 在一些仓库结构中有意料之外的[问题](https://babeljs.io/docs/en/config-files#6x-vs-7x-babelrc-loading)，7.x 版本配置文件推荐使用 `babel.config.json(/.js)` 或者 `.babelrc.json`

#### `@babel/polyfill`

自从 7 版本以后，这个包的结构就变成：

```txt
──┬ @babel/polyfill@7.x
  ├── core-js@2                 // 这里依然是 2 版本，core-js@3 放弃对 @babel/polyfill 的支持
  └── regenerator-runtime
```

到了 7.4 以后，这个包被废弃，官方推荐直接手动引入 `core-js` 和 `regenerator-runtime`，实现全局 polyfill 方案，但是打包体积会变得更庞大

```js
import 'core-js/stable'
import 'regenerator-runtime/runtime'
```

#### `@babel/preset-env`

包结构：

```txt
──┬ @babel/preset-env@7.x              // 版本号由 1.x => 与 Babel 整体保持一直
  │ ├── @babel/plugin-*                // 插件
  │ ├── ...
  │ ├── @babel/plugin-*
  │ ├── @babel/compat-data             // 定义各浏览器兼容性的数据库，以便与配置文件中 "targets" 值对比
  │ ├── core-js-compat@3.22.1          // core-js
  │ └── semver
```

在 7.x 版本，`preset-env` **默认支持语法转化**；同时提供 `useBuiltins` 新的配置选项，做 API 填充

Demo 见：[7-preset-env](./7-preset-env/babel.config.json)

##### `"useBuiltIns": "usage"`

自动导入**使用到的** polyfill，不需要用户代码里主动 `import`

##### `"useBuiltIns": "entry"`

**导入目标环境不支持的所有 polyfill**，工程化配置中一般需要在入口文件 `import`，Babel 不会在其他模块再单独添加 polyfill

##### `"useBuiltIns": false`

不导入任何 polyfill

> 项目使用依然需要安装 `npm install core-js@3 --save` or `npm install core-js@2 --save`

#### `@babel/plugin-transform-runtime` + `@babel/runtime`

7.x 版本的 `@babel/runtime` 仅仅提供 helpers 导入（抽离 helpers 复用），不再提供 polyfill 填充的功能

polyfill 填充需要用户手动安装 `@babel/runtime-corejs3(/2)` 包，而且必须在 `transform-runtime` 插件的配置里指定 `"corejs"` 版本

> Tips:
>
> 1. 在安装 `@babel/runtime-corejs3` 时会自动安装 `core-js-pure`；可以支持实例方法的 polyfill，如 `[].includes()`；且不会污染全局变量
> 2. 在安装 `@babel/runtime-corejs2` 时会自动安装 `core-js/library`；可见，这个包不能 polyfill 实例方法
> 3. 如果这个插件指定 `"corejs"` 并且 `@babel/preset-env` 也开启 `"useBuiltIns"`：**以 plugin 的配置优先**（因为 plugin 在 preset 之前执行）

安装：

```shell
npm i @babel/plugin-transform-runtime --save-dev
npm i @babel/runtime --save
npm i @babel/runtime-corejs3 --save

npm i @babel/preset-env --save-dev
```

配置文件：

```json
{
  "plugins": [
    [
      "@babel/plugin-transform-runtime",
      {
        "corejs": 3
      }
    ]
  ],
  // 这里依然需要加入 preset-env 来做 syntax 转换
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          "chrome": "30"
        }
        // other options
      }
    ]
  ]
}
```

新的问题：`@babel/plugin-transform-runtime` 是没有像 `@babel/preset-env` 那样的 `"targets"` 配置的，也就是说没有办法做到按照目标环境填充（可以看到 github [关于这个问题的讨论](https://github.com/babel/babel/issues/10008)）。官方给出的解决方案是 [babel-polyfills](https://github.com/babel/babel-polyfills) (注意包名，目前这个库处于试验性阶段)

## 实践：结合 webpack 的配置

推荐将 Babel 配置抽离为单独配置文件

### Babel 6.x

安装：

```shell
# 必要的包
npm i babel-loader@7 --save-dev
npm i babel-core --save-dev

npm i babel-preset-env --save-dev

# 添加别的预设集，如 react
# npm i babel-preset-react --save-dev

# 业务开发
npm i babel-polyfill --save

# 库开发
npm i babel-runtime --save
npm i babel-plugin-transform-runtime --save-dev
```

`.babelrc`

```json
{
  // 库开发
  "plugins": [
    "transform-runtime",
    {
      // 建议使用默认配置，抽离 helpers，减少打包体积
    }
  ],
  "presets": [
    [
      "env",
      {
        "targets": {
          "browsers": [
            // 目标浏览器，按需配置，见 https://github.com/browserslist/browserslist
            ">0.25%",
            "not ie 11"
          ]
        },
        // 业务开发
        "useBuiltIns": true
      }
    ]
  ]
}
```

`webpack.config.js` 配置：

```js
module.exports = {
  // 业务开发：可以在这里添加 babel-polyfill；或者在入口文件引入
  entry: ['babel-polyfill', './src/index.js'],

  // ...
  module: {
    test: /\.js$/,
    exclude: /node_modules/,
    loader: 'babel-loader'
  }
}
```

#### 打包对比

> Demo 见：[6-with-webpack](./6-with-webpack/.babelrc)

<table>
  <tr>
    <th colspan="2">配置</th><th>值</th><th>打包体积</th>
  </tr>
  <tr>
    <td colspan="2">babel-polyfill</td><td>\</td><td>482 KiB</td>
  </tr>
  <tr>
    <td rowspan="2">preset-env</td><td rowspan="2">useBuiltIns</td><td>true</td><td>335 KiB</td>
  </tr>
  <tr>
    <td>false</td><td>482 KiB</td>
  </tr>
  <tr>
    <td rowspan="2">plugin-transform-runtime</td><td rowspan="2">建议使用默认配置</td><td>\</td><td>117 KiB</td>
  </tr>
</table>

### Babel > 7.4

> 推荐 < 7.4 版本均升级到 7.4 以上

包安装：

```shell
npm i babel-loader --save-dev
npm i @babel/core --save-dev
npm i @babel/preset-env --save-dev

# 替代 @babel/polyfill
npm i core-js regenerator-runtime --save

# 库开发
npm i @babel/runtime --save
npm i @babel/plugin-transform-runtime --save-dev
npm i @babel/runtime-corejs3 --save
```

`babel.config.json` 配置：

```json
{
  "plugins": [
    [
      "@babel/plugin-transform-runtime",
      // 库开发
      {
        "corejs": {
          "version": 3,
          "proposals": true
        }
      }
    ]
  ],
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          // 通用，目标环境 syntax 转换
        },
        // 业务开发
        "useBuiltIns": "usage",
        "corejs": {
          "version": 3,
          "proposals": true
        }
      }
    ]
  ]
}
```

可以考虑在业务开发的入口文件全量引入：

```js
import 'core-js/stable'
import 'regenerator-runtime/runtime'
```

`webpack.config.js` 配置：

```js
module.exports = {
  entry: './src/index.js',

  // ...
  module: {
    test: /\.js$/,
    exclude: /node_modules/,
    loader: 'babel-loader'
  }
}
```

<table>
  <tr>
    <th colspan="2">配置</th><th>值</th><th>打包体积</th>
  </tr>
  <tr>
    <td colspan="2">corejs@3 + regenerator-runtime</td><td>\</td><td>931 KiB</td>
  </tr>
  <tr>
    <td rowspan="2">preset-env</td><td rowspan="2">useBuiltIns</td><td>entry</td><td>863 KiB</td>
  </tr>
  <tr>
    <td>usage</td><td>268 KiB</td>
  </tr>
  <tr>
    <td rowspan="2">plugin-transform-runtime</td><td rowspan="2">建议使用默认配置</td><td>\</td><td>353 KiB</td>
  </tr>
</table>

## 扩展：动态 polyfill

使用 CDN 的方式，根据浏览器的 UA，服务端动态返回 polyfill。只需要在 html 文件里引入 script 即可，无需打包到项目的 JS 代码中

英国的“[金融时报 ™](https://aboutus.ft.com/)”开源了 [polyfill-service](https://github.com/Financial-Times/polyfill-service) 库，并部署了 CDN 地址（由 Fastly 提供），勾选所需特性，复制连接地址即可引入。官网：[Polyfill.io](https://polyfill.io/v3/)

```html
<!-- 通过传递 features 参数来自定义功能列表 -->
<script src="https://cdn.polyfill.io/v3/polyfill.min.js?features=es5,es6,es7"></script>
```

```html
<!-- 也可使用阿里部署在 alicdn 的 polyfill-->
<script src="https://polyfill.alicdn.com/polyfill.min.js?features=es5,es6,es7"></script>
```

### 原理浅析

polyfill-service 库内部依赖的 polyfill 方案，是同公司开源的 [polyfill-library](https://github.com/financial-times/polyfill-library#readme)

```js
// polyfill-service/server/routes/v3/polyfill.js

const polyfillio = require('polyfill-library')

module.exports = app => {
  app.get([`${contextPath}/v3/polyfill.js`, `${contextPath}/v3/polyfill.min.js`], async (request, response, next) => {
    // 获取请求参数，以决定返回哪些需要 polyfill 的特性
    const parameters = getPolyfillParameters(request)

    // 根据参数返回特定版本

    // 返回 polyfill 包
    const bundle = await polyfillio.getPolyfillString(parameters)
  }
}
```

`getPolyfillParameters` 函数，将请求参数处理为 polyfill 里需要的配置：

```js
// polyfill-service/server/lib/get-polyfill-parameters.js
function getPolyfillParameters(request = {}) {
  const query = request.query || {}
  // 拿到 query 里的 features 参数
  const {
    /* other queries */
    features = 'default'
  } = query

  // 请求头里的 ua 字段
  const uaString =
    ua ||
    (request.headers && request.headers['user-agent']) ||
    (typeof request.get === 'function' && request.get('User-Agent')) ||
    ''
  // 返回处理后的结果
  return {
    // ...
    features: featuresfromQueryParameter(features, flags),
    uaString
  }
}
```

`polyfill-library` 库有两个核心函数，`getPolyfills` 和 `getPolyfillString`：

```js
// polyfill-library/lib/index.js

// 根据 'options.features' 参数，返回规范化的 features 定义对象
async function getPolyfills(options_) {
  // ...
  const featureNames = new Set(Object.keys(options.features))
  const targetedFeatures = Object.create(null)

  function removeFeature(featureName) {}
  function addFeature(featureName) {}

  for (const featureName of featureNames) {
    const feature = targetedFeatures[featureName] || options.features[featureName];
    // 针对边界情况，做一些添加与删除
    // removeFeature or addFeature
  }

  return Promise.resolve(targetedFeatures)
}

// 生成 bundle 文件，返回 utf-8 stream 或者 Promise 包裹的 utf-8 字符串
function getPolyfillString(options_) {
  // ...
  getPolyfills(options).then(targetedFeatures => {
    // ...

    // getPolyfillMeta 方法会通过 fs.readFile 读 polyfills 下定义的各个文件
    return sources.getPolyfillMeta(featureName).then(polyfill => {
      // 获取 polyfill 之后
      // 分组、添加注释、排序去重、处理是否压缩、处理 callback
      // 最终返回字符
    })
  }

  return options_.stream ? output : Promise.resolve(streamToString(output))
}
```

> 思考：如果选择基于该库部署自己的动态 polyfill 服务，可能还要注意在 nginx 层设置缓存

## 参考资料

[core-js-3-babel-展望—中文](https://github.com/zloirock/core-js/blob/master/docs/zh_CN/2019-03-19-core-js-3-babel-and-a-look-into-the-future.md)

[Babel 官网文档](https://babeljs.io/docs/en/)

[An easier way of using polyfills](https://hacks.mozilla.org/2014/11/an-easier-way-of-using-polyfills/?spm=a2c6h.12873639.article-detail.19.20a55d30Ojdhzv)
