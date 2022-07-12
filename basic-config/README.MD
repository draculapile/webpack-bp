# 基础

## 基本概念

### module | chunk | asset

![concept](https://raw.githubusercontent.com/draculapile/image-host/master/img/concept.png)

> 绘图工具：[excalidraw](https://excalidraw.com/)

## 基础配置

### module

定义不同类型的 modules 处理方式

![v5](https://img.shields.io/badge/%E7%89%88%E6%9C%AC%E5%B7%AE%E5%BC%82-v5-brightgreen)

> webpack 4：原生支持 `.js` 和 `.json` 文件的打包；解析其他类型的文件需要依赖对应的 loader
> webpack 5：不再依赖 loader 就可以解析图片、字体、文本等静态资源，资源模块四种值分别定义不同的处理方式

<!-- prettier-ignore -->
```js
module: {
  rules: [
    {
      test: /\.png/,
      type: 'asset/resource'     // 类似 file-loader
      // type: 'asset/source'    // 类似 raw-loader
      // type: 'asset/inline'    // 类似 url-loader
      // type: 'asset'           // 类似 url-loader with 8kb limit
    }
  ]
}
```

### target

构建目标

![v5](https://img.shields.io/badge/%E7%89%88%E6%9C%AC%E5%B7%AE%E5%BC%82-v5-brightgreen)

default: `'web'`

> 在不指定 `target` 时：
> webpack5：默认打包输出的是 ES6 代码
> webpack4：默认打包输出的是 ES5 代码

```js
module.exports = {
  // browser-like environment, ES5 features
  target: ['web', 'es5']
}
```

### entry

入口文件（的路径）。默认每个 HTML 页面对应一个入口

Single Page App 单入口打包配置：

```js
module.exports = {
  // entry 为 'string' 或 'array'，单入口
  entry: './src/index.js'
  // entry 为数组，会将两个文件打包到一个 chunk 中
  // entry: ['./src/a.js', './src/b.js']
}
```

Multiple Page App 多入口打包配置：

```js
module.exports = {
  // entry 为 object，会打包输出多个文件
  // 同时需要指定 output 的文件名
  entry: {
    home: './src/home.js',
    about: './src/about.js'
  }
}
```

或者更灵活地动态生成 entry：

```js
const generateMPA = () => {
  const entry = {}
  // 利用 glob 匹配入口文件，be like
  // src
  //   ├── a
  //   |   └── index.js
  //   └── b
  //       └── index.js
  const entryFiles = glob.sync(path.join(__dirname, './src/*/index.js'))

  Object.keys(entryFiles).map((index) => {
    const entryFile = entryFiles[index]

    const match = entryFile.match(/src\/(.*)\/index\.js/)
    const pageName = match && match[1]

    entry[pageName] = entryFile

    // ...可以结合 html-webpack-plugin 插件，定义一个包含多个 html 处理逻辑的数组
  })

  return {
    entry
    // ...
  }
}

const { entry /* ... */ } = generateMPA()

module.exports = {
  entry: entry
  // ...
}
```

### output

输出文件（的配置）

#### `output.path`

绝对路径，因为可以输出到硬盘的任何位置

```js
module.exports = {
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  }
}
```

#### `output.publicPath`

默认 `auto`（即：`process.cwd()` ），定义资源请求时的公共路径前缀

请求场景：

- js 文件中，URI 请求外部资源
- html 文件中，标签的 `href`、`src` 属性
- css 文件中，`url()`

可以为相对路径或者绝对路径

- 相对：相对 HTML 的路径
- 绝对：如：资源托管在 CDN

> 实际上 webpack 是对路径进行重写，加上 `publicPath` 定义的前缀

[publicPath demo](./public-path)

### mode

模式

4.x 版本新增

`development` 详细错误信息；增量编译构建，
`production` 默认启用性能优化的一些插件

不同模式下自动设置**可供用户模块内访问**的 `process.env.NODE_ENV` 值

### resolve

定义解析（资源）的方式

#### `resolve.extensions`

扩展名，模块文件如果没有扩展名时，会尝试在该配置里进行匹配

> 同名不同类型文件，依据 `extensions` 数组中定义的顺序，进行解析；一旦匹配到后缀，则跳过其余定义

```js
module.exports = {
  //...
  resolve: {
    // 使用 ... 访问默认扩展名
    extensions: ['.ts', '...']
  }
}
```

#### `resolve.modules`

解析模块的目录

```js
module.exports = {
  //...
  resolve: {
    // 查找模块时，src 将优先于 node_modules
    modules: [path.resolve(__dirname, 'src'), 'node_modules']
  }
}
```

#### `resolve.alias`

别名，简写路径。webpack 将优先从该配置查找模块

```js
module.exports = {
  // ...
  resolve: {
    alias: {
      comps: path.resolve(__dirname, './components')
    }
  }
}
```

#### `resolve.mainFields`

定义模块（包）的加载入口，从 package.json 中的字段检索

> 默认值受 webpack 配置中 target 影响

```js
module.exports = {
  //...
  resolve: {
    mainFields: ['browser', 'module', 'main']
  }
}
```

### loaders

借助 loader 解析或处理指定类型的资源文件

> 通过链式调用，最终转化为标准 JS 内容，以供 webpack 接下来使用

在 `use` 数组中的执行顺序为从右到左，以 less 文件为例：

<!-- prettier-ignore -->
```js
module.exports = {
  // ...
  module: {
    rules: [
      {
        test: /\.less$/,
        use: [
          // style-loader 实际上是用 JS 代码创建一个 style 元素，挂载到 head 标签里
          'style-loader',   // 后
          'css-loader',     // 处理 @import、url()
          'less-loader'     // 先
        ]
      }
    ]
  }
}
```

#### 指定 loader 的类别

通过定义 `Rules.enforce` 属性，声明 loader 的执行顺序

```js
// ...
module: {
  rules: [
    {
      test: /\.js$/,
      enforce: 'pre',
      use: ['pre-loader']
    }
  ]
}
```

可选值（按照执行顺序）：

- `pre` 前置
- `normal` 正常（默认值）
- `post` 后置

### plugins

插件

用于打包文件优化、资源管理和环境变量注入等，可以作用于整个构建过程

执行顺序由插件内部注册的 webpack 钩子决定；绑定了同一钩子的插件，执行顺序按照在 `plugins` 数组中注册（`new`）的顺序

```js
module.exports = {
  //...
  plugins: [
    // 环境变量插件
    new webpack.DefinePlugin({
      // Definitions...
    })
  ]
}
```

webpack 提供了丰富的[内置插件](https://webpack.js.org/plugins/)可供直接使用；其他的插件需要 `npm install`

### 文件指纹

为 `output.filename` 添加哈希值

一般配合 CDN 缓存使用，规则：

- `hash` 每次 webpack 构建生成
  - 修改任何文件都会导致所有文件的 hash 发生改变
- `chunkhash` 根据 entry 进行依赖文件解析、构建对应的 chunk，生成对应的哈希值
  - 生产环境抽离公共库，单独打包构建，使用 chunkhash 保证其哈希值不会受业务代码影响
- `contenthash` 根据内容生成哈希值

```js
module.exports = {
  entry: {
    main: './src/index.js',
    vender: ['lodash']
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[chunkhash].js'
  },
  plugins: [
    new MiniCssExtractPlugin({
      // 只要 css 文件内容不变，即使其所处的模块有其他文件内容更改，也不会重复构建
      filename: 'css/[name].[content].css'
    })
  ]
}
```

### 环境变量

用于定制不同环境下的配置

#### 配置文件中 `mode` 参数

在模块中可以获取该参数

```js
// webpack.config.js
module.exports = {
  mode: 'development'
  // ...
}

// 或者在 package.json 中："dev": "webpack serve --mode=development"

// 模块内 index.js
console.log(process.env.NODE_ENV) // 'development'
```

#### `--env`

在命令行定义的可供 webpack 配置文件访问的环境变量

```js
// package.json
"build": "webpack --env=production"

// webpack.config.js
// 此时需要以函数导出
module.exports = (env, argv) => {
  console.log('Production: ', env.production) // true
}
```

#### `cross-env` 包

跨平台（Win，macOS，...）设置（一个或多个）变量值，挂载到 Node 的 `process.env` 上

```json
"scripts": {
  "build": "cross-env NODE_ENV=production webpack"
}
```

此时 webpack.config.js 配置文件和用户模块内，均能获取到 `process.env.NODE_ENV` 值

#### `DefinePlugin` 插件

定义一个**全局**常量，编译时替换为设定的值，可以用来区分开发与生产模式

> 实际上该插件原理是文本替换。若给定的值为字符串，必须包含**实际引号**。如：`'"production"'` 或者使用 `JSON.stringify()`

```js
// webpack.config.js
new webpack.DefinePlugin({
  BROWSER_SUPPORTS_HTML5: true,
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
})
```

可以在模块内部拿到定义的常量，或者在**浏览器端**使用

> 如 Vue 中的 `VUE_APP_` 开头的变量，也是使用该插件嵌入到客户端侧

#### `.env` 文件

建立不同环境的 `.env` 文件，便于集中管理

```txt
# .env
NODE_ENV=development
A=a
```

```js
// node index.js
console.log(fs.readFileSync('dir/.env', 'utf8')) // A=a

// 注意文件路径，.env 文件默认是从 `process.cwd()` 加载，
// 保持与 `node index.js` 命令的工作目录一致
```

工程上实际会采用 [dotenv](https://github.com/motdotla/dotenv) 库，读取 .env 文件并挂载到 `process.env`

<!-- prettier-ignore -->
```js
// 多环境配置案例

// .env.development
ENV=dev
BASE_URL=url1

// .env.production
ENV=prd
BASE_URL=url2

// webpack.config.js
// ...

// 根据当前环境，加载 env 文件
const dotenvFile = path.resolve(__dirname, `./.env.${process.env.NODE_ENV}`)

dotenv.config({
  path: dotenvFile
})
```

> 如果需要在 .env 文件里配置安全敏感信息，最好被排除在版本管理之外。一些第三方的云服务器如阿里云 OSS 会提供环境相关的配置

### devServer

开发（服务器）配置。依赖于 `webpack-dev-server`，服务底层是由 `express` 启动

<img width="50%" src="https://raw.githubusercontent.com/draculapile/image-host/master/img/dev-server.png" />

#### `devServer.hot`

开启 HMR 热更新功能。即在不刷新浏览器的情况下更新页面

> 1. 依赖于 webpack 内部插件 `webpack.HotModuleReplacementPlugin` 实现
> 2. 基于 `sockjs` 在浏览器端和服务端之间建立一个 websocket 长连接

#### `devServer.publicPath`

可以访问 devServer 服务的目录

> devServer 服务在开启后并不向磁盘中输出生成文件，而是将结果保存在**内存**中

如果未设置，默认采用 `output.publicPath`

以 `/` 开头或结尾

#### `devServer.contentBase`

指定服务器引用的静态资源文件的根目录，默认是项目根目录

> 这个静态资源文件，指**不被 webpack 处理**的资源

#### `devServer.proxy`

代理到指定地址的指定端口，绕过跨域限制

> 依赖 `http-proxy-middleware`，实现请求转发；
> 这个中间件实际上利用 `http-proxy` 库开启**代理服务器**与目标服务器通信

```js
// http://localhost:8080/api/foo/bar -> http://www.example.org/api/foo/bar
```

整体配置：

<!-- prettier-ignore -->
```js
module.exports = {
  // ...
  devServer: {
    hot: true,                                    // 开启 HMR
    open: true,                                   // 自动打开浏览器
    https: false,                                 // 不开启 HTTPS 
    proxy: {
      '/api': 'http://172.x.x.x:3000'             // 代理到后端服务接口(可能是同局域网下)
    },
    compress: true,                               // 开启 gzip 压缩
    contentBase: path.join(__dirname, 'public'),  // 配置静态资源文件根目录
    historyApiFallback: {}                        // 支持 H5 History API，404 时直接导航到指定页面
  }
}
```

### polyfill

实现 JS 的兼容处理，依赖 Babel 系列的工具链完成

#### `babel-loader`

接入 Babel 的工具链

```shell
npm i -D babel-loader @babel/core @babel/preset-env
```

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
            // 一些更详尽的配置
          }
        }
      }
    ]
  }
}
```

```js
// babel-loader 模拟
function babelLoader(source) {
  // ...
  // 转换代码，依赖 @babel/core 引擎
  let targetSource = babelCore.transform(source, {
    presets: ['@babel/preset-env'] // 具体转换规则，preset 代表一个包含许多规则的预设包
  })

  return targetSource
}
```

Babel 6.x -> 7.x 配置更新较大，详细的版本升级对比及结合 webpack 的配置，见 [Babel 配置](../babel/README.MD)
