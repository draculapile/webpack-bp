# 原理分析

## Debug Webpack in VSCode

> webpack: 5.72.0
> VSCode: 1.68.1

分析 webpack 内部流程最好的就是写一个 case 进行 debug。以 VSCode 为例，打开“运行和调试”侧边栏，点击“创建 `launch.json` 文件”，选择 `Node.js`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Webpack",
      "skipFiles": [
        "<node_internals>/**"
      ],
      "cwd": "${workspaceFolder}",
      "program": "${workspaceFolder}/node_modules/.bin/webpack"
    }
  ]
}

// package.json 文件中的 build 命令
"scripts": {
  "build": "webpack"
}
```

这时候执行 `npm run build` 即相当于手动执行 `node ./node_modules/.bin/webpack`，然后就会根据 `program` 的入口，开启调试

之后在 `node_modules/webpack/lib/` 源码下的内部模块里打断点即可进入，比如在 `Compiler.js` 看一下传入的配置文件 `options`：

![debug example](https://raw.githubusercontent.com/draculapile/image-host/master/img/20220709164958.png)

## `/.bin/webpack` 入口命令分析

[`/.bin/webpack` 逻辑注释](./bin-webpack.js)

## 运行时分析

运行时即 webpack 编译生成的一系列工具函数

### 模块加载原理

首先从 webpack 最初支持的 CommonJS 模块来看，因为 ES Modules 的加载都是由它扩展而来

#### CommonJS

```js
// entry.js
const { foo, bar } = require('./module1')
const baz = require('./module2')
foo()
console.log(baz)

// module1.js
function foo() {
  console.log('foo')
}
function bar() {
  console.log('bar')
}
module.exports = {
  foo,
  bar
}

// module2.js
const baz = 'baz'
module.exports = baz
```

打包后产物，整体使用一个 IIFE **立即执行函数**包裹，内部分为三个部分理解

> 为了易读性，删除了 webpack 的结构性注释

第一部分，定义存放模块的对象

<!--prettier-ignore-->
```js
var __webpack_modules__ = {
  // key: 模块 ID，为模块所在的相对路径
  // value: 是一个函数
  './src/module1.js': (module) => {
    function foo() {
      console.log('foo')
    }
    function bar() {
      console.log('bar')
    }
    module.exports = {
      foo,
      bar
    }
  },

  './src/module2.js': (module) => {
    const baz = 'baz'
    module.exports = baz
  }
}
```

第二部分，定义**加载模块的核心函数**：

<!--prettier-ignore-->
```js
// 模块缓存对象
var __webpack_module_cache__ = {}
// 核心 require 函数，根据模块 ID 加载模块
function __webpack_require__(moduleId) {
  // 将使用 require 加载过的模块放入缓存
  var cachedModule = __webpack_module_cache__[moduleId]
  // 有缓存则取缓存结果
  if (cachedModule !== undefined) {
    return cachedModule.exports
  }
  // 创建一个空模块，{ export: {} }，并放入缓存
  var module = (__webpack_module_cache__[moduleId] = {
    exports: {}
  })

  // 执行模块 ID 对应的函数
  __webpack_modules__[moduleId](module, module.exports, __webpack_require__)

  // 执行完后，返回该模块的导出对象
  return module.exports
}
```

第三部分，再次使用 IIFE 包裹入口（作用域隔离），加载这个入口依赖的模块：

<!--prettier-ignore-->
```js
var __webpack_exports__ = {}
;(() => {
  // 执行加载函数 require 加载模块
  const { foo, bar } = __webpack_require__('./src/module1.js')
  const baz = __webpack_require__('./src/module2.js')
  foo()
  console.log(baz)
})()

```

#### ES Modules

```js
// 入口文件 entry.js
import { foo, bar } from './module1'
import { baz } from './module2'
foo()
console.log(baz)

// module1.js
export function foo() {
  console.log('foo')
}
export function bar() {
  console.log('bar')
}

// module2.js
export const baz = 'baz'
```

对于 ES Modules 的加载场景，有些不同。首先是模块对象里每个模块的函数定义，多了两个参数：

<!--prettier-ignore-->
```js
var __webpack_modules__ = {
  './src/module1.js': (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
    // 这里调用的是 __webpack_require__.d
    __webpack_require__.d(__webpack_exports__, {
      foo: () => foo
    })
    // module1 的 foo 和 bar 定义
  },

  // module2 ...
}

```

第二部分，辅助函数部分，为 `_require_` 扩展了两个属性：

1. `__webpack_require__.d`
2. `__webpack_require__.o`

<!--prettier-ignore-->
```js
// 缓存
var __webpack_module_cache__ = {}
// 加载模块的核心：require 函数
function __webpack_require__(moduleId) {
  // require 函数的内部实现相同 ...
}

;(() => {
  __webpack_require__.d = (exports, definition) => {
    for (var key in definition) {
      if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
        // 就是在 module.exports 上附加模块的导出内容
        // 以上文的 module1 为例，将 foo 定义附加到导出对象 exports 上
        // 同时可以延迟取值，直到真正加载模块时才会取值
        Object.defineProperty(exports, key, { enumerable: true, get: definition[key] })
      }
    }
  }
})()
;(() => {
  // 就是 hasOwnProperty 的一层封装，判断对象属性
  __webpack_require__.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop)
})()
```

第三部分，加载模块时的逻辑相同，只是拼接了一些定义

<!--prettier-ignore-->
```js
var __webpack_exports__ = {}
;(() => {
  // 加载模块
  var _module1_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__('./src/module1.js')
  var _module2__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__('./src/module2.js')
  // 执行 entry 内部的逻辑
  ;(0, _module1_js__WEBPACK_IMPORTED_MODULE_0__.foo)()
  console.log(_module2__WEBPACK_IMPORTED_MODULE_1__.baz)
})()
```

在阅读 webpack 产物代码时，我们可能经常发现 `harmony` 和 `non-harmony` 的注释，这里稍微做一下解释：

Harmony 这个词诞生于 ES4（被废弃的一个 ES 版本），但是它的一些提案在 ES6 实现，所以可以将 `harmony exports` 理解为 ES(6) Modules 导出；`non-harmony modules` 自然就是非 ES Modules 模块

> 参考链接：
> [What is harmony and what are harmony exports?](https://stackoverflow.com/questions/52871611/what-is-harmony-and-what-are-harmony-exports) > [4th Edition (abandoned)](<https://en.wikipedia.org/wiki/ECMAScript#4th_Edition_(abandoned)>)

#### ES Modules 和 CommonJS 混用

修改示例代码，分别使用 `require` 加载 ESM，使用 `import` 加载 `module.exports` 的导出

```js
// 入口文件 entry.js
const { foo, bar } = require('./module1')
import { baz } from './module2'
foo()
console.log(baz)

// module1.js
export function foo() {
  console.log('foo')
}
export function bar() {
  console.log('bar')
}

// module2.js
const baz = 'baz'
module.exports = baz
```

第一部分：模块存放的对象，现在是这么定义的：

<!--prettier-ignore-->
```js
var __webpack_modules__ = {
  './src/module1.js': (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
    // 这里有了一个新的  __webpack_require__.r
    __webpack_require__.r(__webpack_exports__)
    __webpack_require__.d(__webpack_exports__, {
      bar: () => bar,
      foo: () => foo
    })
    // module1 的 foo 和 bar 定义
  },

  './src/module2.js': (module) => {
    const baz = 'baz'
    module.exports = baz
  }
}

```

第二部分：辅助函数又为 `_require_` 扩展了几个属性

1. `__webpack_require__.r`
2. `__webpack_require__.n`

<!--prettier-ignore-->
```js
// 省略 .o 和 .d 的定义 ...

;(() => {
  // 分析传入的 module 是否是 ESM，是则返回 module['default'] 否则直接返回该模块
  __webpack_require__.n = (module) => {
    var getter = module && module.__esModule ? () => module['default'] : () => module
    __webpack_require__.d(getter, { a: getter })
    return getter
  }
})()

;(() => {
  __webpack_require__.r = (exports) => {
    if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
      // 为导出对象 exports 扩展了一个 Symbol.toStringTag，值为 'Module'
      // Object.prototype.toString.call(exports) 返回的结果为 [object Module]
      Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    }
    // 为导出的对象 exports 扩展了一个 __esModule 属性，标识它为 ESM 模块
    Object.defineProperty(exports, '__esModule', { value: true })
  }
})()
```

第三部分：加载模块时也有区别

<!--prettier-ignore-->
```js
var __webpack_exports__ = {}
;(() => {
  // 
  var _module2__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__('./src/module2.js')
  var _module2__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/ __webpack_require__.n(
    _module2__WEBPACK_IMPORTED_MODULE_0__
  )
  const { foo, bar } = __webpack_require__('./src/module1.js')
  foo()
  console.log(_module2__WEBPACK_IMPORTED_MODULE_0__.baz)
})()
```

## Tapable 架构与 Hooks 设计

> TODO: building...

## Plugin 机制

插件就是一个类，内部定义 `apply` 方法

```js
// 文件写入需要引入该库
const { RawSource } = require('webpack-sources')

class MyPlugin {
  // 插件名称
  constructor(options) {
    this.options = options // 获取传递的参数

    // 错误处理，参数校验阶段可以直接通过 throw 抛出
    // throw new Error("Error Message")
  }

  apply(compiler) {
    // apply 方法
    compiler.hooks.done.tap('MyPlugin', (stats) => {
      console.log('Hello Plugin')
    }) // 插件的 hooks

    // 文件写入 assets
    compiler.plugin('emit', (compilation, cb) => {
      compilation.assets[name] = new RawSource('demo')
      cb()
    })
  }

  // 错误处理，还可以通过 compilation 的 warnings 和 errors 接收
  // compilation.warnings.push("warnings");
  // compilation.errors.push("errors")
}

module.exports = MyPlugin
```

> TODO: building...

## Loader 机制

webpack 的 loader 是一个导出为函数的 JS 模块

> TODO: building...

## Mini Pack

实现一个简单的 [pack](./mini-webpack)

> TODO: building...
