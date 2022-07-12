# Source Map

在 Chrome 控制台输出以下代码，查看简单的 source map 效果

```js
//# sourceURL=simple
console.log('test')
```

![simple](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220612235130.png)

点击右侧的 simple 即可以打开 sources 选项卡，定位到第二行

![sources tab](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220612235718.png)

在 webpack 配置文件中，指定 devtool 的值，开启不同的 source map 选项

可以通过以下配置文件，对比打包效果

```js
// index.js
import { foo } from './foo.js'
function bar() {}
foo()
bar()

// foo.js
export function foo() {}

// webpack.config.js
module.exports = [
  'eval',
  'eval-cheap-source-map',
  'eval-cheap-module-source-map',
  'eval-source-map',
  'cheap-source-map',
  'cheap-module-source-map',
  'inline-cheap-source-map',
  'inline-cheap-module-source-map',
  'source-map',
  'inline-source-map',
  'hidden-source-map',
  'nosources-source-map'
].map((devtool) => ({
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: `[name]-${devtool}.js`,
    clean: true
  },
  devtool
}))
```

> 官方文档中所有支持的配置值见：[devtool](https://webpack.js.org/configuration/devtool/#devtool)

## 关键字含义

`[inline-|hidden-|eval-][nosources-][cheap-[module-]]source-map`

根据关键字内部会调用三个不同的 plugin 处理，传入不同的参数：

- 包含 `source-map` 和 `eval`：调用 `EvalSourceMapDevToolPlugin`
- 包含 `source-map`：调用 `SourceMapDevToolPlugin`
- 包含 `eval`：调用 `EvalDevToolModulePlugin`

### `eval`

使用 eval 包裹每个模块 bundle 的代码，包含了 `sourceURL` 信息。像这样：

<!-- prettier-ignore-->
```js
((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("/* code here ... */ \n\n\n//# sourceURL=webpack://workdir/./src/index.js?");

})
```

可以看到，并没有生成 `.map` 文件，打开 sources 面板可以查看文件目录，`debugger` 也可以进入到文件中，报错的话会光标可以定位到报错位置：

![eval](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220614000612.png)

webpack 文档说明，使用 `eval`，性能是最好的

原理是：打包时会检查每个模块，只需要为**改动的模块**重新生成打包后的代码，每个模块后跟的 `//# sourceURL` 部分事实上就是这个模块本身；如果没有发生改动，webpack 会直接复用缓存

> 1. 省时的直接原因就是不用生成 `.map` 文件（见下面部分）；
> 2. 并不能定位到真实的行号；

文档说明的“Windows Defender 问题，由于病毒扫描，这个问题会导致速度大幅下降”（有待笔者验证）

### `source-map`

生成 `*.map` 文件，在打包的代码底部指明 source map 来源。以 `devtool: 'source-map'` 为例：

```js
// ...
//# sourceMappingURL=main-source-map.js.map
```

`.map` 文件构成：

```map
{
  "version": 3,
  "file": "",
  "mappings": "",           // 原始代码到编译后代码映射的位置信息
  "sources": [],            // 原始文件名数组
  "sourcesContent": [],     // 原始文件内容（代码）数组，与 sources 顺序一致
  "names": [],              // 可选项，源代码的变量名和属性名
  "sourceRoot": ""          // 可选项，资源路径，默认空（与源文件路径相同）
}
```

其中最重要的位置信息 `mappings`，是一个 Base64 VLQ 格式的字符串。生成这个字符串大致的过程是：

1. 分析原始文件和编译后的文件中，对应变量所在的行、列位置信息；
2. 根据两对行、列信息及原始文件名，组成一个变量对应的映射信息，可能是：`0|4|src/index.js|0|4`，再加上这个变量对应的索引，得到：`0|4|src/index.js|0|4|0`
3. 对这个信息进行优化：
   a. 省去（编译后文件的）行号，用 `;` 标识换行；
   b. 用 sources 数组的索引，代替原始文件名
   c. 列的位置，使用相对值代替绝对值（防止数值过大）
4. 得到 `4|0|0|4|0`，使用 VLQ 编码规则去掉分隔符 `|`，然后再转为 Base64 编码，即得到一个变量的映射信息

因此你可以看到一个简单的 `mappings` 的结构可能是：`"mappings": "A,AAAB;;ABCDE;"`

> - 一个将整数转换为 Base64 VLQ 字符串的库：[`vlq.js`](https://github.com/Rich-Harris/vlq)
> - webpack 使用的是 Mozilla 的 [source-map](https://github.com/mozilla/source-map) 库，生成的 SourceMap，该库中处理 Base64 VLQ 的部分：[base64-vlq.js](https://github.com/mozilla/source-map/blob/master/lib/base64-vlq.js)
> - 在线的 [BASE64 VLQ CODEC](https://www.murzwin.com/base64vlq.html)

#### Source Map 标准

[Source Map Revision 3 Proposal](https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#)

### `inline`

将 `.map` 文件内容转为 Base64 字符串，作为 DataURI 内联到打包后的文件中，如：

```js
//# sourceMappingURL=data:application/json;charset=utf-8;base64,...
```

### `cheap`

不包含列的映射信息，即调试时只能定位到行

### `module`

代码如果经过 loader 处理的话，会包含 loader 的 source map 信息，可以定位到 loader 转换前的代码。以 `css-loader` 为例，在 sources 面板里可以看到源 `.css` 文件：

![css file](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220616114900.png)

`devtool` 配置里并不会单独配置 `module` 关键字（因为 `devtool: 'source-map'` 会默认包含 loader 的 source map），它通常与 `cheap` 搭配使用，如 `cheap-module-source-map`

可以看 [webpack 源码](https://github.com/webpack/webpack/blob/main/lib/WebpackOptionsApply.js#L226) 中对 devtool 配置的处部分：

```js
// ...
const cheap = options.devtool.includes('cheap')
const moduleMaps = options.devtool.includes('module')
// ...
const Plugin = evalWrapped
  ? require('./EvalSourceMapDevToolPlugin')
  : require('./SourceMapDevToolPlugin')
new Plugin({
  // 有 module 关键字，则为 loader 生成 source map
  // 否则，看是否有 cheap 关键字，有则不生成
  // 都没有，默认生成
  module: moduleMaps ? true : cheap ? false : true,
  // 有 cheap 关键字就不生成列信息
  columns: cheap ? false : true
  // ...
}).apply(compiler)
```

对于是否包含 loader 的 source map，`.map` 文件加载的 `sources` 会有不同：

```json
"sources": [/* ... */, "webpack://workdir/node_modules/css-loader/dist/runtime/sourceMaps.js", /* ... */]

// 不包含
"sources": [/* ... */, "webpack://workdir/node_modules/css-loader/dist/runtime/noSourceMaps.js", /* ... */]
```

### `hidden`

生成 `.map` 文件，但是在打包后的文件中不添加对 `.map` 文件的引用，也就是说没有 `//# sourceMappingURL` 的部分

### `nosources`

`.map` 文件中，不包含 `sourcesContent` 内容，可以在看到报错位置的同时，不暴露源代码

## 最佳实践

### 开发环境

推荐配置 `devtool: cheap-module-eval-source-map`

保证速度，需要定位到源代码，不需要行号

### 生产环境

推荐配置 `devtool: hidden-source-map`

一般情况下，不希望暴露项目源码，但是可能会需要 source map 定位错误信息

#### 生产环境调试 `.map`

可在 Sources 面板中，打开打包后的文件，鼠标右键调出菜单，点击 `Add source map`

![Add source map](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220617162747.png)

输入本地 `.map` 的文件地址（`file:// 或者 /User/...`），即可手动添加

![URL](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220617163238.png)

> 也可以添加绝对路径，比如 `.map` 文件在 source map 服务器上的地址

在源文件中，按下 `CMD` + `O`，即可以打开命令面板，输入 `:line:column` 行号与列号，跳转到指定位置

![Go to:line:column](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220617154222.png)

#### 结合监控工具

以 Sentry 为例，生成的 source map 一般需要上传一份给 Sentry，Sentry Server 会基于错误堆栈和 `.map` 文件反解出原始的 stack 行列信息，它的 source map 解析功能也是依赖 `source-map` 库的。模拟基本流程：

```js
const fs = require('fs')
const path = require('path')
const sourceMap = require('source-map')

// MAP 文件
const MAP = path.join('.', 'app.min.js.map')

// bundle 后的代码报错位置
const GENERATED_LINE_AND_COLUMN = { line: 1, column: 1000 }

// 读取 .map 文件
const rawSourceMap = fs.readFileSync(MAP).toString()

new sourceMap.SourceMapConsumer(rawSourceMap).then(function (smc) {
  let pos = smc.originalPositionFor(GENERATED_LINE_AND_COLUMN)

  // 输出在源文件中的行列信息以及源文件名和变量名
  // { source: 'index.js', line: 6, column: 4, name: 'foo' }
  console.log(pos)
})
```

## 参考链接

[Building Source Maps](https://survivejs.com/webpack/building/source-maps/#-sourcemapdevtoolplugin-and-evalsourcemapdevtoolplugin-)

[ByteDance Web Infra：SourceMap 与前端异常监控](https://mp.weixin.qq.com/s/BbvJ-OfcS7Sa-e0Zq6iF1w)

[mappings 生成详解](https://juejin.cn/post/7008039749747212319#:~:text=mappings%E5%AD%97%E6%AE%B5%E3%80%82-,mappings,-%E6%98%AF%E5%A6%82%E4%BD%95%E8%AE%B0%E5%BD%95)

[Sentry Docs: Verify your source maps work locally](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-your-source-maps-work-locally)
