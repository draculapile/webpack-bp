# 进阶和优化

## CSS

### `css-loader` 的 `importLoaders` 参数

决定 css 中**未处理的** `@import` 语句（引入的模块），在使用 `css-loader` 前，要经过几个其他的 loader 处理，示例：

> 默认情况下（不配置 `importLoaders`），`@import` 语句不会再被其他的 loader 处理

```js
// 入口 index.js
import './style.css'

// style.css
// @import './b.css';
// ::placeholder {
//   color: gray;
// }

// b.css
// span {
//   user-select: none;
// }

// 注意：需要配置 postcss.config.js
const postcssPresetEnv = require('postcss-preset-env') // postcss-preset-env 已经内置了 autoprefixer
module.exports = {
  plugins: [
    postcssPresetEnv({
      browsers: 'last 5 version'
    })
  ]
}

// webpack.config.js
module.exports = {
  // ...
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1
              // 0 => 默认值，不经过别的 loader 处理；比如例子中的 b.css 不会经过 postcss-loader 处理
              // 1 => 经过 postcss-loader 处理；b.css 中 `user-select` 也会被添加前缀
            }
          },
          'postcss-loader'
        ]
      }
    ]
  }
}
```

`css-loader` 内部大致的处理逻辑：

<!--prettier-ignore-->
```js
import postcss from 'postcss' // css 编译的库

export default async function loader(content, map, meta) {
  // content 这时候是经过 postcss-loader 处理过的 style.css，像这样
  // '@import './b.css';\n\n .../*** 这里的 ::placeholder 已经被添加了不同的浏览器前缀  ***/... \n'

  const rawOptions = this.getOptions(schema) // 获取配置：{ importLoaders: 1 }

  if (shouldUseImportPlugin(options)) { // 检测到有 @import
    // 这里的 plugins 是传给 postcss 解析 css 用的插件
    plugins.push(
      // importParser 是 'postcss-import-parser'
      importParser({
        // ...
        urlHandler: (url) =>
          stringifyRequest(this, combineRequests(getPreRequester(this)(options.importLoaders), url))
      })
      // getPreRequester 返回一个函数，会根据当前 loader 在 webpack 中的位置，以及 importLoaders 的值，计算需要哪些 loader
      // urlHandler 最终返回的值如：
      // '"-!../../node_modules/css-loader/dist/cjs.js??ruleSet[1].rules[1].use[1]!../../node_modules/postcss-loader/dist/cjs.js!./b.css"'
      // 经过这么拼接之后，@import 引入的 b.css 会交由 postcss-loader 解析
    )
  }

  try {
    // 使用 postcss 处理
    result = await postcss(plugins).process(content, {
      // ...
    })
  } catch (error) {}
}
```

> 1. 参考链接：[PostCSS 文档](https://github.com/postcss/postcss/blob/main/docs/README-cn.md)
> 2. 注意：关于 `import` 的模块，`css-loader` 只处理未解析的 `@import`，如果 loader 链之前已经有 loader 解析了模块引入（e.g. `sass-loader`），`css-loader` 则不再处理

## 资源内联

![v5](https://img.shields.io/badge/%E7%89%88%E6%9C%AC%E5%B7%AE%E5%BC%82-v5-brightgreen)

即资源嵌入另一个资源中，根本上是为了减少页面请求次数

> webpack4 一般采用 `raw-loader` 库
> webpack5 新增了 assets module (资源模块) 来处理资源

### 场景一：公共 HTML 嵌入入口文件

一个公共的 HTML 文件可能像这样：

<!--prettier-ignore-->
```html
<meta charset="UTF-8" />
<meta name="viewport" content="viewport-fit=cover,width=device-width,initial-scale=1,user-scalable=no" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge,chrome=1" />
<!--这里可能还会有一些通用的，业务相关的 meta 标签，比如关键字等-->

<!--DNS 预获取-->
<link rel="dns-prefetch" href="https://fonts.googleapis.com/" />
```

作为 `html-webpack-plugin` 模板的 `test.ejs` 文件：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <%= require('public.html?raw') %>
    <!--需要内联进来的 .js 也可以通过这种方式-->
    <script>
      <%= require('raw-module.js?raw') %>
    </script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

配置文件：

```js
module.exports = {
  module: {
    rules: [
      // 使用 webpack5 资源模块，匹配 raw 参数，内联到生成的 index.html
      {
        resourceQuery: /raw/,
        type: 'asset/source'
      }
    ]
  }
}
```

### 场景二：CSS 内联

使用 `html-inline-css-webpack-plugin`，使用方式见[官方文档](https://github.com/Runjuu/html-inline-css-webpack-plugin)

它与 `style-loader` 的区别是，`style-loader` 生成的是 js 代码，而 `html-inline-css-webpack-plugin` 是将（提取的）css 插入到 `style` 标签

## 自动清理构建目录

![v5](https://img.shields.io/badge/%E7%89%88%E6%9C%AC%E5%B7%AE%E5%BC%82-v5-brightgreen)

> webpack4 使用 [`clean-webpack-plugin`](https://github.com/johnagan/clean-webpack-plugin)
> webpack5 新增了 `clean: true` 参数

不过 webpack5 的 `clean` 配置，在 `dev` 模式下会有 bug，见 [issue861](https://github.com/webpack/webpack-dev-middleware/issues/861)

而以 `vue-cli` 为例，它的 `build` 命令（生产环境）默认清空目标目录是这么做的：

```js
// vue-cli/packages/@vue/cli-service/lib/commands/build/index.js

const defaults = {
  clean: true
  // ...
}

// 如果传入 -no-clean
if (args.clean) {
  await fs.emptyDir(targetDir)
}
```

## 代码分割 Code Splitting

将打包的代码分割成更小的块，通过合理分割，减少一次性加载的文件体积，在需要的时候再加载

### 动态引入 Dynamic Imports

可以使用 `import()` 或者 `require.ensure`

```js
// foo.js
export default function fooFunc() {
  console.log('i am foo')
}

// 入口文件 index.js
function bar() {
  console.log('i am bar in index')
  // 模拟一个点击加载的使用场景
  const btn = document.getElementById('btn')
  btn.addEventListener(
    'click',
    () =>
      import(/* webpackChunkName: 'Foo'*/ './foo').then((module) => {
        const fooFunc = module.default
        fooFunc()
      })

    // 或者是使用 await
    // const { default: fooFunc } = await import('./foo')
  )
}
bar()
```

`foo.js` 会被单独打包成一个文件，在点击按钮的时候，可以从 Chrome 控制台看到对这个拆分出来文件的请求

React 的动态导入模块和 Vue 的路由懒加载的组件等，原理类似，都是交由 webpack 处理

### splitChunks

通过指定配置文件的 `optimization.splitChunks` 选项，使用内置的 `SplitChunksPlugin` 插件，拆分打包 bundle 前的 chunk

![v5](https://img.shields.io/badge/%E7%89%88%E6%9C%AC%E5%B7%AE%E5%BC%82-v5-brightgreen)

> webpack5 版本差异见下

<!--prettier-ignore-->
```js
// 下面是默认配置
module.exports = {
  //...
  optimization: {
    splitChunks: {                          //    v4   ->   v5
      chunks: 'async',                      //                     # async 异步（按需）加载的 module 才会被分割，还可以配置为 "initial" | "all"
      minSize: 20000,                       // 30000   ->   20000  # 生成的 chunk 最小要大于该值
      minRemainingSize: 0,                  //              new    # 避免生成 0 size 的 chunk
      minChunks: 1,                         //                     # 至少被引用 1 次的 module，生成单独的 chunk
      maxAsyncRequests: 30,                 //     5   ->   30     # 异步（按需）加载的最大并行请求数，超出这个数值则不再拆分 chunk（详见下）
      maxInitialRequests: 30,               //     3   ->   30     # 一个入口文件中，最大并行请求数，超出这个数值则不再拆分 chunk（详见下）
      enforceSizeThreshold: 50000,          //              new    # 强制分割的阈值，会忽略 minRemainingSize、maxAsyncRequests、maxInitialRequests 的设置
      
      
      /***** 下面每个 cacheGroups 都会继承上面的配置（可以理解为公用配置），cacheGroups 是拆分模块的具体规则 *****/
      cacheGroups: {
        // 而 test、priority 和 reuseExistingChunk 是每个缓存组内部的独有设置
        defaultVendors: {                   // 默认组，匹配 node_modules，即抽离第三方库，叫做 vendor 
          test: /[\\/]node_modules[\\/]/,
          priority: -10,                    // 优先级，因为一个 module 有可能会匹配多个组规则，根据优先级决定将 module 打包到哪一个 chunk 中，0(默认值) > -10 > -20
          reuseExistingChunk: true          // 复用 chunk，对于每个自定义的 cacheGroup 默认为 false（效果详见下）
        },
        default: {                          // 优先级最低，默认（兜底）配置
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  }
}
```

#### `reuseExistingChunk`

如果当前 chunk 包含的 module 已经从主包中分离，那么将会复用这个 chunk。一个简单的示例：

```js
// 入口文件 entry1.js
export default () => {
  console.log('entry1')
}
// 入口文件 entry2.js
export default () => {
  console.log('entry2')
}

// webpack.config.js
module.exports = {
  mode: 'development',
  entry: {
    entry1: './src/entry1',
    entry2: './src/entry2'
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  devtool: false,
  optimization: {
    minimize: false,
    splitChunks: {
      cacheGroups: {
        common: {
          chunks: 'all',
          minSize: 0,
          minChunks: 1, // 注意：这里设置 minChunks 为 1，使得入口文件 entry 再被分割一次
          reuseExistingChunk: false
        }
      }
    }
  },
}
```

打包结果：

```shell
asset common-src_entry1_js.js 751 bytes {common-src_entry1_js} [emitted] (id hint: common)
asset common-src_entry2_js.js 716 bytes {common-src_entry2_js} [emitted] (id hint: common)
asset entry1.js 6.25 KiB {entry1} [emitted] (name: entry1)
asset entry2.js 6.25 KiB {entry2} [emitted] (name: entry2)
```

`common-src_entry1_js.js` 文件就是在 `entry1.js` 中书写的代码，`entry1.js` 会引用它：

```js
// ...
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = () => {
  console.log('entry1')
}
// ...
```

另外一个入口文件同理。而将 `reuseExistingChunk` 设置为 `true` 的打包结果：

```shell
asset entry1.js 1.94 KiB {entry1} [emitted] (name: entry1) (id hint: common)
asset entry2.js 1.91 KiB {entry2} [emitted] (name: entry2) (id hint: common)
```

这一块代码就不会再被分割出来

#### `maxAsyncRequests` 和 `maxInitialRequests`

官方文档里说明的这个默认数值，定义在 `webpack/lib/config/defaults.js` 默认配置文件中：

```js
const { splitChunks } = optimization
if (splitChunks) {
  // ...
  F(splitChunks, 'maxAsyncRequests', () => (production ? 30 : Infinity))
  F(splitChunks, 'maxInitialRequests', () => (production ? 30 : Infinity))
  // ...
}
```

[更新日志](https://github.com/webpack/webpack/releases/tag/v5.0.0-beta.19)里有说明：从 webpack5 开始，这个默认值（生产模式下）提高到了 30

这么做其实是**按照 HTTP/2 的场景设置的**，因为 HTTP/2 中同一个 TCP 链接上的 HTTP 请求数量理论上是没有限制的，30 个应该是足够应对大多数的 web 应用

> 1. 你可以从代码中看到，非生产模式下是 `Infinity`
> 2. HTTP/1.1 下，浏览器对并发个数的限制一般是 6

关于这个请求数量还需要注意的是：（打包后的）入口文件本身也算做一个请求，而 async chunk（即按需加载的模块打包的 chunk）不算

下面是一个案例：

```js
// 入口文件 foo.js
import './module'
console.log('i am foo')

// 入口文件 bar.js
import './module'
console.log('i am bar')

// 共享模块 module.js
console.log(`
  This module will be imported by foo and bar.
  Here is some other txt to increase file size.
`)

// webpack.config.js
module.exports = {
  mode: 'production',
  entry: ['./src/foo.js', './src/bar.js'],
  output: {
    path: path.join(__dirname, 'dist'),
    filename: `[name].js`,
    clean: true
  },
  optimization: {
    chunkIds: 'named', // 命名 chunk
    splitChunks: {
      cacheGroups: {
        common: {
          // 分割所有模块
          chunks: 'all',
          // 这里设置为 0，想让 webpack 把包尽可能地拆开
          minSize: 0
        }
      }
    }
  }
}
```

打包结果：

![maxInitialRequests result1](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220622233149.png)

添加 `maxInitialRequests: 2,` 配置，打包结果：

![maxInitialRequests result2](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220622233436.png)

如果再设置了 `maxSize` 值，在不能同时满足的情况下，那么实际取舍的优先级是 `maxInitialRequest/maxAsyncRequest < maxSize < minSize`

#### 样式文件分包

结合 `mini-css-extract-plugin`，提取样式文件为单独的 `.css` 文件

这里有一个值得注意的点：通常情况下，`mini-css-extract-plugin` 提取 css 文件时会额外生成一个 `.js` 模块。需要进行如下配置阻止这一默认行为

> 在 webpack4 中解决这个问题的方法可以参考：[CSS 提取时的依赖图修正](https://mp.weixin.qq.com/s/qmLEX7iL5RHTPpd-MI2yEQ)

```js
// webpack.config.js
module.exports = {
  mode: 'development',
  entry: {
    entry1: './src/entry1',
    entry2: './src/entry2'
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  devtool: false,
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1
            }
          },
          'postcss-loader'
        ]
      }
    ]
  },
  plugins: [new MiniCssExtractPlugin()],
  optimization: {
    minimize: false,
    splitChunks: {
      cacheGroups: {
        css: {
          name: 'styles',
          type: 'css/mini-extract',
          chunks: 'all',
          enforce: true
        }
      }
    }
  }
}
```

打包结果：

```txt
asset entry1.js 7.29 KiB {entry1} [emitted] (name: entry1)
asset entry2.js 7.25 KiB {entry2} [emitted] (name: entry2)
asset styles.css 1.2 KiB {styles} [emitted] (name: styles) (id hint: css)
```

#### 最佳实践

了解每项配置含义后，尽量结合业务需要，去做定制化的分包需求。一般推荐：

1. 拆分基本上不太变动的第三方库为独立的包；
2. 提取多个模块依赖的公共模块（设置合适的 `minChunks` 值），防止打包冗余；
3. 定制合适的 size 参数和 request 参数，使应用的首页请求数量更加合理；
4. 升级 webpack 版本

#### 参考资料

1. [精读 Webpack SplitChunksPlugin 插件源码](https://juejin.cn/post/7098213874788204580#heading-4)
2. [Webpack Doc: Extracting all CSS in a single file](https://webpack.js.org/plugins/mini-css-extract-plugin/#extracting-all-css-in-a-single-file)
3. [webpack's automatic deduplication algorithm example](https://github.com/webpack/webpack/blob/main/examples/many-pages/README.md)

## Scope Hoisting

直面意思是作用域提升。开启这个功能可以减少打包产物的体积，为压缩工具提供更友好的代码，提升运行性能

webpack 的打包产物，有很多被包裹的代码块，比如在入口文件中引入的模块可能会被包裹成这样：

<!--prettier-ignore-->
```js
/******/  var __webpack_modules__ = ({

/***/ "./src/module1.js":
/*!************************!*\
  !*** ./src/module1.js ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (() => {
  console.log('module 1')
});


/***/ })

// 这里可能是 module2

/******/  });
```

这些是 webpack 产出的，用于完成**模块加载、缓存、代码分割**等功能的运行时函数。而开启 Scope Hoisting 后，打包产物如：

<!--prettier-ignore-->
```js
/******/ (() => { // webpackBootstrap
// UNUSED EXPORTS: default

;// CONCATENATED MODULE: ./src/module1.js
/* harmony default export */ const module1 = (() => {
  console.log('module 1')
});

;// CONCATENATED MODULE: ./src/module2.js
/* harmony default export */ const module2 = (() => {
  console.log('module 2')
});

;// CONCATENATED MODULE: ./src/entry1.js

// ...

/******/ })()
;
```

即：将模块尽可能（安全地）合并到一个函数作用域中

在 `mode: 'production'` **生产**环境下，**默认开启**该特性。内部是使用 `ModuleConcatenationPlugin` 插件来完成这一工作。原理是基于 ES Module 的静态分析能力

与这个特性有关的配置项是：`optimization.concatenateModules: true`，在 `mode: 'development'` 开发环境下可以手动开启，查看打包产物的不同

**事实上这个特性还与 tree shaking 有关**，见下文

### 注意事项

1. 使用 `module.exports` 导出的基于 CommonJS 的模块无法被合并（因此，尽可能地使用 npm 包的 ESM 版本）；
2. 使用 `eval` 包裹的代码无法被合并；
3. 多次被引用的模块，如果命中了代码分割，即不在一个 chunk 中，那么显然也不会被合并
4. 使用 ProvidePlugin 插件定义的全局（垫片）模块，无法被合并

### 参考资料

1. [webpack freelancing log book: Scope Hoisting](https://medium.com/webpack/webpack-freelancing-log-book-week-5-7-4764be3266f5)

## Tree Shaking

![v5](https://img.shields.io/badge/%E7%89%88%E6%9C%AC%E5%B7%AE%E5%BC%82-v5-brightgreen)

> webpack4 区别见下

基于 ESM 的静态分析，移除未使用的模块，优化打包产物体积

> ESM 中 `import` 和 `export` 语句必须出现在模块顶层（作用域），打包工具正是基于此进行静态分析

### 标记 `unused` 导出

由于 webpack 在生产模式 `mode: production` 下默认开启了一些 `optimization` 选项

```js
// webpack/lib/config/defaults.js
// ...
F(optimization, 'sideEffects', () => (production ? true : 'flag'))
// ...
D(optimization, 'usedExports', production)
// ...
D(optimization, 'minimize', production)
```

在开发模式下可以手动关闭一些选项，查看 webpack 对未使用导出的处理：

```js
// 入口文件 entry.js
import { foo, bar, baz } from './module1'
foo()

// module1.js
export const foo = () => {
  console.log('foo')
}

export * from './module2'

function innerModule1() {
  console.log('inner module 1')
}

// module2.js
export default () => {
  console.log('module 2 default')
}

export function baz() {
  console.log('baz')
}

// webpack.config.js
module.exports = {
  mode: 'development',
  entry: {
    entry1: './src/entry'
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  devtool: false,
  cache: false,
  optimization: {
    usedExports: true, // 注意开启 usedExports
    minimize: false
  }
}
```

对于未使用的 `module2` 的默认导出和 `baz` 函数导出，webpack 均打上了 `/* unused harmony export */` 标记

<!--prettier-ignore-->
```js
/***/ "./src/module2.js":
/*!************************!*\
  !*** ./src/module2.js ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* unused harmony export baz */
/* unused harmony default export */ var __WEBPACK_DEFAULT_EXPORT__ = (() => {
  console.log('module 2')
});

function baz() {
  console.log('baz')
}
/***/ })
```

#### 结合 `optimization.minimize` 配置项

如果手动开启了 `optimization.minimize` 配置项（`production` 下默认开启），`unused` 注释标记的未使用的导出，webpack 内部调用 `terser-webpack-plugin` 去处理，然后它会调用内置的 minify 工具 [terser](https://github.com/terser/terser) 移除这部分代码

> 以上文的例子来看，我们自己定义的**未使用**的 `innerModule1` 函数，也会被移除

#### 一些标记失效场景

在某些场景下，webpack 并不能很好地**标记**未使用的变量、声明等

##### 场景一：导出的对象内部属性

```js
// 入口文件 entry.js
import obj from './module1'
obj.foo()

// module1.js
export default {
  foo() {
    return 'foo'
  },
  bar() {
    return 'bar'
  }
}
```

**webpack 不会标记未使用的对象属性**，结果：

<!--prettier-ignore-->
```js
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
  foo() {
    return 'foo'
  },
  bar() {
    return 'bar'
  }
});
```

##### 场景二：保留对模块内变量的引用

```js
// 入口文件 entry.js
import { foo, bar } from './module1'
console.log(foo)

const unusedBar = bar

// module1.js
export const foo = 'foo'
export const bar = 'bar'
```

结果：

<!--prettier-ignore-->
```js
/***/ "./src/module1.js":

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "bar": () => (/* binding */ bar),
/* harmony export */   "foo": () => (/* binding */ foo)
/* harmony export */ });
const foo = 'foo'
const bar = 'bar'

// ...
```

##### 场景三：`Class` 内未使用的方法

```js
// 入口文件 entry.js
import { A } from './module1'
const newA = new A()
newA.methodA()

// module1.js
export class A {
  methodA() {
    console.log('method a')
  }
  methodB() {
    console.log('method b')
  }
}
```

尽管类 `A` 的 `methodB` 方法没有使用，但是还是会被包含。打包结果：

<!--prettier-ignore-->
```js
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "A": () => (/* binding */ A)
/* harmony export */ });
class A {
  methodA() {
    console.log('method a')
  }
  methodB() {
    console.log('method b')
  }
}
```

#### 标记失效 `!==` 无法 Tree Shaking

上面列举了几种 webpack 无法标记 unused statements 的场景，可以看到这些都是压缩前的代码

而在生产模式 `mode: production` 下，webpack 会调用 terser 对代码进行压缩（minify），语句级别的 tree shaking 也是交由 terser 完成的。事实上不同 terser 版本，对于上文列举的场景处理结果都不同：

<table>
  <tr>
    <th>webpack 版本</th><th>terser 版本</th><th>场景</th><th>mode</th><th>tree shaking 结果</th>
  </tr>
  <tr>
    <td rowspan="3">4.46.0</td><td rowspan="3">4.8.0</td><td>一</td><td>prod</td><td>❎</td>
  </tr>
  <tr>
    <td>二</td><td>prod</td><td>✅</td>
  </tr>
  <tr>
    <td>三</td><td>prod</td><td>❎</td>
  </tr>
  <tr>
    <td rowspan="3">5.73.0</td><td rowspan="3">5.14.1</td><td>一</td><td>prod</td><td>✅</td>
  </tr>
  <tr>
    <td>二</td><td>prod</td><td>✅</td>
  </tr>
  <tr>
    <td>三</td><td>prod</td><td>❎</td>
  </tr>
</table>

随着 terser 的版本升级，tree shaking 功能也在增强。还是以场景一（with webpack 5）为例，如果仅仅在入口文件内调用 `obj.foo()`，而没有继续使用它的返回值，打包出来的文件甚至是空的（符合预期）

> 关于支持类上未使用方法的 tree shaking 的讨论：
>
> 1. [webpack: Tree shaking class methods #13922](https://github.com/webpack/webpack/issues/13922)
> 2. [rollup: Tree shaking class methods #349](https://github.com/rollup/rollup/issues/349)

上面提到的 `concatenateModules` 配置，对 tree shaking 的结果影响也很大，以场景二（with webpack 4）为例，设置 `optimization.concatenateModules` 为 `false`，生产环境打包结果：

![concatenateModules result](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220630152003.png)

可以看到 scope hoisting 对于 tree shaking 也是有益的

### `sideEffects`：整体移除文件和模块

与 `usedExports` 配置标记导出不同，`sideEffects` 配置用于声明模块级别的副作用

> [Side effect (computer science)](<https://en.wikipedia.org/wiki/Side_effect_(computer_science)>)

#### `optimization.sideEffects`

当设置为 `true` 时（生产模式下默认值），开启 `sideEffects` 检测

内部调用 `SideEffectsFlagPlugin` 插件，会查询包的 `package.json` 文件中的 `sideEffects` 字段，如果为 `false`，表明该包已**声明**无副作用，webpack 会给模块打上 `sideEffectFree` 标记，在后续构建模块依赖时，会去掉未使用的导出。示例：

```js
// 入口文件 entry.js
import { foo } from './library'
console.log(foo)

// library/index.js
import { a } from './a'

export const foo = 'foo'
export const bar = 'bar'

// library/a.js
console.log('a')

export const a = 'a'

// library/package.json
{
  "name": "library"
}
```

在 `library` 模块的 `index.js` 下，引入了 `a` 模块的 `a`，虽然没有进行任何后续操作，但是 **`import` 语句是有副作用的**，配置文件：

```js
module.exports = {
  mode: 'development',
  // ...
  optimization: {
    usedExports: true,
    sideEffects: true
  }
}
```

打包结果：

<!--prettier-ignore-->
```js
/***/ "./src/library/a.js":
/*!**************************!*\
  !*** ./src/library/a.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* unused harmony export a */
console.log('a')

const a = 'a'

/***/ }),

/***/ "./src/library/index.js":
/*!******************************!*\
  !*** ./src/library/index.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "foo": () => (/* binding */ foo)
/* harmony export */ });
/* unused harmony export bar */
/* harmony import */ var _a__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./a */ "./src/library/a.js");
const foo = 'foo'
const bar = 'bar'

;
/***/ })
```

在 `package.json` 中加入 `"sideEffects": false` 之后的结果：

<!--prettier-ignore-->
```js
/***/ "./src/library/index.js":
/*!******************************!*\
  !*** ./src/library/index.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "foo": () => (/* binding */ foo)
/* harmony export */ });
/* unused harmony export bar */
const foo = 'foo'
const bar = 'bar'

;

/***/ })
```

可以看到模块 `a` 直接整体被去除。是否声明 `"sideEffects": false` 在生产模式下经过 minify 之后的差异：

<!--prettier-ignore-->
```js
(()=>{"use strict";console.log("a"),console.log("foo")})();

// "sideEffects": false
(()=>{"use strict";console.log("foo")})();
```

事实上，可以将 webpack 的这个字段，理解为声明该包**内部的所有模块**都无副作用，即使它包含 `console.log('a')` 这样的副作用语句，在未使用该模块的导出时，webpack 均可放心整体去除该模块

##### reexport 优化

webpack 针对于**重导出**的情况，也做了优化。将上文的例子改写：

```js
// 入口文件 entry.js
import { a } from './library'
console.log(a)

// library/index.js
export { a } from './a'

export const foo = 'foo'
export const bar = 'bar'

console.log('side effect statement in lib index')

// library/a.js
export const a = 'a'
```

不配置 `"sideEffects": false` 的打包结果会将 `index.js` 模块包含：

<!--prettier-ignore-->
```js
// ...
/***/ "./src/library/index.js":
/*!******************************!*\
  !*** ./src/library/index.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "a": () => (/* reexport safe */ _a__WEBPACK_IMPORTED_MODULE_0__.a)
/* harmony export */ });
/* unused harmony exports foo, bar */
/* harmony import */ var _a__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./a */ "./src/library/a.js");
const foo = 'foo'
const bar = 'bar'

console.log('side effect statement in lib index')

/***/ })

// ...
```

而配置 `"sideEffects": false` 之后 `library/index.js` 模块**会被整体去除掉**

> 扩展阅读：
>
> 1. webpack 成员 Sean 给 Vue.js 提交的关于 `package.json` 声明 `"sideEffects": false` 的 PR：[PR#8099](https://github.com/vuejs/vue/pull/8099)
> 2. Sean 在 stackoverflow 上关于 `sideEffects` 的[回答](https://stackoverflow.com/a/49203452/9548663)

##### with CSS

如果包内部包含 `.css` 文件，如在 `index.js` 中 `import './style.css'`， 则可以配置 `"sideEffects"` 为数组，声明哪部分文件有副作用，避免被 webpack 去除

```json
{
  "name": "library",
  "sideEffects": ["**/*.css"]
}
```

还可以在 `module.rules` 匹配到样式文件时，声明有副作用。比如 Vue 和 React 的默认 webpack 配置中：

```js
// Vue
{
  test: /\.vue$/,
  resourceQuery: /type=style/,
  sideEffects: true
}

// React
{
  test: sassRegex, // for .sass files
  exclude: sassModuleRegex,
  use: getStyleLoaders(
    {
      // ...
    },
    'sass-loader'
  ),
  sideEffects: true
}
```

考虑到引入样式文件对 DOM 的副作用，业务中不推荐对 CSS 文件或模块进行整体单独的 tree shaking，应该始终跟随调用该部分样式文件的组件或者模块一起处理，以免出现样式没有被打包的情况

#### `/*#__PURE__*/` 注释

在函数调用前，使用 `/*#__PURE__*/` 注释，可以让 webpack 知道该调用是无副作用的，进而**在 minify 阶段**去除该语句

在上文示例的 `console.log('a')` 语句前加上该注释：

<!--prettier-ignore-->
```js
// 入口文件 entry.js
import { foo } from './library'
console.log(foo)

// library/index.js
import { a } from './a'

export const foo = 'foo'
export const bar = 'bar'

// library/a.js
/*#__PURE__*/ console.log('a')
console.log("another a")

export const a = 'a'

// library/package.json
{
  "name": "library"
}
```

即使没有在 `package.json` 声明 `"sideEffects": false`，生产环境下打包结果依然不会包含 `a` 中有副作用的该语句（因为你已经注释该调用为 pure）：

<!--prettier-ignore-->
```js
(()=>{"use strict";console.log("another a"),console.log("foo")})();
```

### CSS 的 minify

使用基于 [cssnano](https://cssnano.co/) 的 webpack 插件：[`CssMinimizerWebpackPlugin`](https://webpack.js.org/plugins/css-minimizer-webpack-plugin/)

cssnano 压缩前：

<!--prettier-ignore-->
```css
.box {
  padding: 0;
  margin: 0;
}
.child {
  
}
```

压缩后：

<!--prettier-ignore-->
```css
.box{margin:0;padding:0}
```

生产模式下，压缩由 `MiniCssExtractPlugin` 提取出来的样式文件。插件使用：

```js
// webpack.config.js
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')

module.exports = {
  module: {
    rules: [
      {
        test: /.s?css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader']
      }
    ]
  },
  optimization: {
    // 使用该配置，意味着 minify 工具交由用户配置
    minimizer: [
      // 这里需要使用 ... 将 webpack 的默认 minify 插件如 terser-webpack-plugin 扩展进来，否则可能出现 .js 文件不压缩的情况
      ...new CssMinimizerPlugin()
    ]
  },
  plugins: [new MiniCssExtractPlugin()]
}
```

### With Babel

Babel 配置中影响 tree shaking 的是 `@babel/preset-env` 的 [`modules`](https://babeljs.io/docs/en/babel-preset-env#modules)，即如何转换 ES module 语法

在现在 7.x 版本的 Babel 中，官方文档推荐配置为 `modules: "auto"`，意味着由 `caller` 注入 `data`，决定模块转换方式。在 webpack 中，这个 `caller` 就是 `babel-loader`

而 `babel-loader` 传入的这个 data，是这样的：

```js
// babel-loader/lib/injectCaller.js
caller: Object.assign(
  {
    name: "babel-loader",
    target, // 拿到 webpack 的参数，默认 'web'，用于向目标环境注入 babel 插件
    // 表明支持 ESM
    supportsStaticESM: true,
    // 支持 import()
    supportsDynamicImport: true,
    // 支持 top-level await
    supportsTopLevelAwait: true,
  },
  opts.caller,
),
```

之后在 `preset-env` 中，根据 `modules` 参数以及 `api.caller`，确定是否调用转换 ESM 的插件

```js
// @babel/preset-env/lib/index.js

const modulesPluginNames = getModulesPluginNames({
  // ...
  // 确定是否转换 ESM
  shouldTransformESM: modules !== 'auto' || !(api.caller != null && api.caller(supportsStaticESM))
  // ...
})

// ...

if (modules !== false && transformations[modules]) {
  if (shouldTransformESM) {
    // 转换 ESM 插件
    modulesPluginNames.push(transformations[modules])
  }

  // ...
} else {
  modulesPluginNames.push('syntax-dynamic-import')
}
```

实际示例如下：

```js
// 入口文件 entry.js
import { foo } from './module1'
foo()

// module1.js
export async function foo() {
  console.log('foo')
}

export async function bar() {
  console.log('bar')
}

// webpack.config.js
module.exports = {
  mode: 'development',
  entry: {
    entry1: './src/entry'
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  devtool: false,
  cache: false,
  optimization: {
    usedExports: true
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  },
}

// babel.config.json
{
   "presets": [
      [
        "@babel/preset-env"
      ]
   ]
}
```

打包结果，可以标记未使用导出：

<!--prettier-ignore-->
```js
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "foo": () => (/* binding */ foo)
/* harmony export */ });
/* unused harmony export bar */

// 省略了 babel 添加的 helpers...
```

注意：

1. 注入 `caller` 这个特性是在 `babel-loader` 8.0+ 添加的，[commit of babel-loader](https://github.com/babel/babel-loader/commit/7d8500ced72046d4c5c1dcdc7a9c0016d7e6c15b)，[PR#8485 of Babel](https://github.com/babel/babel/pull/8485/files)
2. `babel-loader@8` 对应 `@babel@7`，而 `babel-loader@7` 对应 `babel@6`
3. babel 6.x 版本下的 `babel-preset-env` 配置，`modules` 值默认为 `"commonjs"`，在需要 tree shaking 功能时需要改为 `modules: false`

除此之外，经过 Babel 转译的 `Class` 语法，随着版本升级也发生了变化：（左：Babel 6 + webpack 4；右：Babel 7 + webpack 5）

> see this PR: [#6209](https://github.com/babel/babel/pull/6209)

![babel version](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220705175520.png)

1. `unused` 标记未使用的导出类
2. 添加 `/*#__PURE__*/` 注释到转译的 IIFE 函数前

这样 minify 工具就可以去掉未使用的函数调用

### CommonJS 的 Tree Shaking

[webpack 5 release](https://webpack.js.org/blog/2020-10-10-webpack-5-release/) 说明支持 [CommonJs Tree Shaking](https://webpack.js.org/blog/2020-10-10-webpack-5-release/#commonjs-tree-shaking)，并列举了支持的导出结构。测试案例：

```js
// 入口文件 entry.js
const foo = require('./module1').foo
foo()

// module1.js
module.exports.foo = function () {
  console.log('foo')
}
module.exports.bar = function () {
  console.log('bar')
}
```

打包结果：

```js
/***/ "./src/module1.js":
/*!************************!*\
  !*** ./src/module1.js ***!
  \************************/
/***/ ((module) => {

var __webpack_unused_export__;
module.exports.foo = function foo() {
  console.log('foo')
}

__webpack_unused_export__ = function bar() {
  console.log('bar')
}

/***/ })
```

生产模式下也可以正常去除 `bar` 函数

但是目前对 CJS 的 tree shaking 支持十分有限，发布文档说明的导出结构，也还没有完全支持。目前的进度：[Projects Card-Finish CJS Tree Shaking](https://github.com/webpack/webpack/projects/5#card-30291446)

### 最佳实践

1. 优化导出粒度与代码结构，结合 IDE 的引用提示，避免无意义赋值与定义操作；
2. 使用 npm 包的 ESM 版本；
3. 升级 webpack 及相关的工具包版本；
4. 灵活使用配置项 `usedExports`、`minimize` 等，结合业务具体排查 tree shaking 效果；
5. 在充分理解你要做什么的前提下，使用一些 hack 的方法比如添加 `/*#__PURE__*/` 注释；
6. 如果模块与功能，与全局环境变量强相关，那么可以使用 `DefinePlugin`，see [this blog](https://devtools.tech/blog/optimizing-your-javascript-bundle-or-defineplugin-webpack---rid---kvP5tP0G6isd86ALJUeh)

### 参考链接

1. [Webpack 中的 sideEffects 到底该怎么用？](https://juejin.cn/post/6844903640533041159)
2. [tree shaking 问题排查指南](https://zhuanlan.zhihu.com/p/491391823)
3. [一篇关于 PURE 注释发展历程的推特](https://twitter.com/iamakulov/status/1353650650438119424)
4. [Deep Dive Into Tree-Shaking](https://javascript.plainenglish.io/deep-dive-into-tree-shaking-ba2e648b8dcb)
5. [「Babel」为你的组件库定制化一款 Tree-Shaking 插件吧](https://zhuanlan.zhihu.com/p/470650490)

## 持久化缓存 Persistent Caching

![v5](https://img.shields.io/badge/%E7%89%88%E6%9C%AC%E5%B7%AE%E5%BC%82-v5-brightgreen)

> webpack5 新增

将缓存写入到磁盘。开发模式下，指定 `cache.type` 为 `filesystem` 手动开启（默认还是缓存到 `memory` 中），增量编译提升**重构建**的效率（生产模式下关闭）

> 写入磁盘的好处是，当前在跑的服务关闭后，缓存文件依然在；下次构建可用

### 构建依赖、缓存版本、缓存名称

```js
// webpack.config.js
module.exports = {
  // ...
  cache: {
    // 开启持久化缓存，放开下面的配置项
    type: 'filesystem',
    // 保存多个缓存文件，如根据 NODE_ENV 变量生成不同的缓存文件
    name: `${process.env.NODE_ENV}-cache`,
    // 缓存版本，即全局环境变量 GIT_REV 有更改，则使缓存失效
    version: `${process.env.GIT_REV}`,
    // 指定构建过程中的代码依赖
    // 可以为文件或者目录
    buildDependencies: {
      // 目录，必须以 / 结尾，
      // 默认值就是 'webpack/lib/'
      // 即：当 webpack/lib 或 webpack 依赖的库有更改，则使缓存失效
      defaultWebpack: ['webpack/lib/'],
      // 当前的配置文件及配置文件中 require() 的包，有更改，则使缓存失效
      config: [__filename]
      // 以 CRA 为例还会加上下面的 tsconfig 和 jsconfig 配置文件（有的话）
      // tsconfig: [paths.appTsConfig, paths.appJsConfig].filter((f) => fs.existsSync(f))
    }
  }
}
```

对于 `node_modules` 目录下的依赖包的变动检测，不会去检测文件变动。而是根据包的 `package.json` 中的 `version` 和 `name` 作为缓存是否需要变动的依据

生成的缓存文件是 `.pack` 结尾的二进制包

![cache file](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220707154115.png)

### watch 模式下的缓存

连续构建 watch 模式下，缓存是分层设计的（文件系统 + 内存）

- 读：内存缓存 -> 文件系统缓存
- 写：同时写入

这种情况下文件系统缓存是在编译器**空闲**时候做的（避免影响编译性能）

### 快照 snapshot

> 这个配置与 `cache` 同级，意为文件系统快照。也用于缓存校验

快照用于和内部 [`fileSystemInfo`](https://webpack.js.org/blog/2020-10-10-webpack-5-release/#compilationfilesysteminfo)比对，来决定是否使用磁盘缓存内容。以解析一个模块（resolve）为例，webpack 内部会经过：

```txt
判断快照是否失效 ? 没有失效返回缓存中的 `resolveData` : 失效则重新 `resolve` 模块
```

基于三种规则生成快照：

- Timestamp： 时间戳，从文件系统读取 meta data（比如在 Node.js 中的 `fs.statSync()`）。捕获速度较快，但是并不完全准确
  - 适用场景：时间戳不会变化，失效成本不高。比如本地开发环境
- Contenthash： 文件内容 hash，由文件内容变更决定 hash 值是否变化。速度较慢，准确性高
  - 适用场景：时间戳会改变，比如 CI 环境下的 `git clone` 代码
- Timestamp + Contenthash：时间戳 + hash，首先比较时间戳，不匹配时比较 hash
  - 适用场景：时间戳部分改变，失效成本高。比如 CI 环境下的 `git pull` 操作

> 1. 文件内容未更改时，时间戳也有可能发生变化。比如：git 操作（clone，change branch）、没有更改的保存；
> 2. 生成快照需要在构建性能和准确性上考虑权衡；
> 3. 失效成本在笔者理解为：缓存失效需要重新构建的成本。一般来说在本地开发时，文件经常有修改，缓存也需要经常重新构建，对于 rebuild 时快照的比对成本相对来说不敏感；而 CI 环境下可能会需要缓存的复用性，失效成本较高，但是可以接受首次构建速度较慢

不同流程创建快照的默认规则不同：

```js
module.exports = {
  // ...
  snapshot: {
    managedPaths: [path.resolve(__dirname, '../node_modules')],
    immutablePaths: [],
    /**
     * 以下配置是对于各流程生成 snapshot 规则的定义
     */
    // 构建依赖
    buildDependencies: {
      hash: true,
      timestamp: true
    },
    // build 构建模块流程时
    // 生成的 snapshot 用于确定下次构建，是否需要 rebuild 模块
    module: {
      timestamp: true
    },
    // 解析模块流程时
    // 生成的 snapshot 用于确定下次构建，是否需要再次 resolve 模块的解析请求
    resolve: {
      timestamp: true
    },
    // 解析构建依赖
    resolveBuildDependencies: {
      hash: true,
      timestamp: true
    }
  }
}
```

### 查看 Log 信息

`stats: 'verbose'` 配置可以暴露内部 `FileSystemInfo` 类的 Log 信息

![log](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220708124650.png)

或者使用：

```js
infrastructureLogging: {
  debug: /webpack\.cache/
}
```

输出内部基础架构的信息

![infrastructure log](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220708221252.png)

### 参考资料

1. [webpack5 持久化缓存](https://github.com/CommanderXL/Biu-blog/issues/55)
2. [从构建进程间缓存设计 谈 Webpack5 优化和工作原理](https://zhuanlan.zhihu.com/p/110995118)
3. [webpack changelog-v5 persistent-caching](https://github.com/webpack/changelog-v5/blob/master/guides/persistent-caching.md)
4. [webpack 官方 example](https://github.com/webpack/webpack/tree/main/examples/persistent-caching)

> TODO: Add More Case

## 模块联邦

`building...`

> TODO: Lack of experience in project

### 参考资料

1. [webpack github module-federation examples](https://github.com/module-federation/module-federation-examples)
2. [探索 webpack5 新特性 Module federation 在腾讯文档的应用](http://www.alloyteam.com/2020/04/14338/)
3. [政采云 ZooTeam：模块联邦浅析](https://www.zoo.team/article/webpack-modular)
