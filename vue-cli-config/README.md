# @vue/cli 的 webpack 配置

> @vue/cli: 5.0.4

## Vue 2.x

### 暴露配置文件原理

使用如下命令，查看 `@vue/cli` 的 webpack 配置

```shell
# 将开发模式的配置，输出到 webpack.dev.js 中
vue inspect --mode=development > webpack.dev.js
vue inspect --mode=production > webpack.prod.js
```

`@vue/cli` 的 `inspect` 命令，定义在 [vue-cli/packages/@vue/cli/bin/vue.js](https://github.com/vuejs/vue-cli/blob/ca97fc2920a3fc9b0288d5fabef1a97356b8da23/packages/%40vue/cli/bin/vue.js#L89-L100)

会加载 `@vue/cli/lib/inspect.js`：

```js
// vue-cli/packages/@vue/cli/lib/inspect.js

module.exports = function inspect(paths, args) {
  let servicePath
  try {
    servicePath = resolve.sync('@vue/cli-service', { basedir: cwd })
  } catch (e) {
    // ...
  }
  // 1. 获取 @vue/cli-service 的执行文件路径
  const binPath = path.resolve(servicePath, '../../bin/vue-cli-service.js')
  if (fs.existsSync(binPath)) {
    // 2. 执行它的 inspect 命令
    execa(
      'node',
      [
        binPath,
        'inspect',
        ...(args.mode ? ['--mode', args.mode] : []),
        // 其他的一些参数
        ...paths
      ],
      { cwd, stdio: 'inherit' }
    )
  }
}
```

可以看到，实际会调用 `vue-cli-service`，它是用来加载所有其他 CLI 插件的核心服务。这个服务的核心是一个 Service 类

先看一下定义的 `inspect` 命令

```js
// vue-cli/packages/@vue/cli-service/lib/commands/inspect.js

module.exports = (api, options) => {
  api.registerCommand('inspect', {}, (args) => {
    // ...
    const { toString } = require('webpack-chain')
    // resolveWebpackConfig 用于获取整个项目的 webpack 配置
    const config = api.resolveWebpackConfig()

    let res
    // handle res

    // toString 函数，用于生成配置信息
    const output = toString(res, {
      /* */
    })

    // ...
  })
}
```

`Service` 类定义在 `vue-cli/packages/@vue/cli-service/lib/Service.js`：

```js
const Config = require('webpack-chain')

class Service {
  constructor(context, { plugins, pkg, inlineOptions, useBuiltIn } = {}) {
    // ...
    this.plugins = this.resolvePlugins(plugins, useBuiltIn)
  }

  init() {
    // 初始化流程，处理环境变量、用户配置、插件等
    // 这里会将插件通过 `new PluginAPI(id, this)` 挂载进来
    this.webpackChainFns.push(this.projectOptions.chainWebpack)
  }

  resolvePlugins(inlinePlugins, useBuiltIn) {
    // ./commands 下的定义的命令、./config 下定义的配置，都是以插件形式存在
    // 即 built in 内建插件
    // 用户也可以定义符合 @vue/cli-plugin-xxx 规范的插件
    const builtInPlugins = [
      './commands/serve',
      './commands/build',
      './commands/inspect',
      './commands/help',
      // config plugins are order sensitive

      // ↓ ↓ ↓ ↓ ↓ ↓ ↓ 这些就是 cli-service 内部定义的 webpack 配置 ↓ ↓ ↓ ↓ ↓ ↓ ↓
      './config/base',
      './config/assets',
      './config/css',
      './config/prod',
      './config/app'
    ].map((id) => idToPlugin(id))

    return orderedPlugins // 返回处理完成的插件
  }

  resolveChainableWebpackConfig() {
    // new Config() 构造函数
    const chainableConfig = new Config()
    // apply chains
    this.webpackChainFns.forEach((fn) => fn(chainableConfig))
    return chainableConfig
  }

  resolveWebpackConfig(chainableConfig = this.resolveChainableWebpackConfig()) {
    // 生成原始（就是 ./config 下定义的）配置
    let config = chainableConfig.toConfig()
    const original = config
    // 这里还会处理、合并用户的 webpack 配置（如果有的话）

    return config
  }
}
```

截取一段 `./config/base.js` 里配置，如下：

```js
// 配置链，符合 webpack-chain 的写法
webpackConfig.module
  .rule('esm')
  .test(/\.m?jsx?$/)
  .resolve.set('fullySpecified', false)
```

总结：inspect 命令，会执行以插件形式挂载到内部 Service 类上的命令（`Service.run()`），然后返回内部通过 [`webpack-chain`](https://github.com/neutrinojs/webpack-chain) 维护的 webpack 配置

### dev 配置文件分析

导出后的配置是一个对象（可以在文件首行加上 `module.exports =`，防止报错）；另外与路径相关的配置，导出后均是绝对路径，可以使用 `'.'` 进行替换，便于阅读。生成的最终的配置文件

> 这里需要一些前置知识：
> 关于`resourceQuery`
>
> 1. `.vue` 文件首先会交由 `vue-loader` 处理
> 2. `<template>` 标签，`<script>` 标签，`<css>` 标签，分别会被解析为三个新的 `import` 语句；如 css 部分：
>    `import style0 from "./index.vue?vue&type=style&index=0&lang=less&"`
> 3. 接着进入 webpack 处理流程，通过 `import` 语句，分析依赖；
> 4. `resourceQuery` 配置就会命中 `type=style`，再进行下一步处理（如交由指定的 `loader` 处理）
>
> 关于 `function () { /* omitted long function */ }`
>
> 1. 我们使用 inspect 输出配置时，function 如果字符长度太长（>100），@vue/cli 会做省略处理

精简后如下：

```js
module.exports = {
  mode: 'development',
  context: '.',
  output: {
    // 使用 xxhash64（更快的 hash 算法，webpack v5.54.0+）
    hashFunction: 'xxhash64',
    path: './dist',
    // 这里的 filename 和 chunkFilename 可以自己覆盖配置时，按需加上 hash 值
    filename: 'js/[name].js',
    publicPath: '/',
    chunkFilename: 'js/[name].js'
  },
  /**
   * resolve.modules 和下文的 resolveLoader.modules
   * 都是配置解析的索引规则，以缩短 webpack 的解析时间（后者是解析 loader）
   */
  resolve: {
    // 别名配置
    alias: {
      '@': './src',
      // 运行时 vue 包，无法使用编译器，体积更小
      vue$: 'vue/dist/vue.runtime.esm.js'
    },
    extensions: ['.mjs', '.js', '.jsx', '.vue', '.json', '.wasm'],
    modules: ['node_modules', './node_modules', './node_modules/@vue/cli-service/node_modules']
  },
  resolveLoader: {
    modules: [
      './node_modules/@vue/cli-plugin-babel/node_modules',
      './node_modules/@vue/cli-service/lib/config/vue-loader-v15-resolve-compat',
      'node_modules',
      './node_modules',
      './node_modules/@vue/cli-service/node_modules'
    ]
  },
  module: {
    // 配置不需要解析的模块
    noParse: /^(vue|vue-router|vuex|vuex-router-sync)$/,
    rules: [
      /**
       * fullySpecified 设定为 false，代表不完全匹配。解决如下问题：
       * package.json 如果不配置 type: module 字段，.msj 文件默认按照 ESModule 解析，且 import 时必须写后缀，否则会报错
       */
      {
        test: /\.m?jsx?$/,
        resolve: {
          fullySpecified: false
        }
      },
      // 使用 vue-loader 解析 .vue 文件
      // 在之前的版本中会在 vue-loader 之前再配置一个 cache-loader，为解析 .vue 文件做缓存
      // 现在是可选项（因为 cache-loader 在 webpack 5 之后，不再维护）
      {
        test: /\.vue$/,
        use: [
          {
            loader: './node_modules/@vue/vue-loader-v15/lib/index.js',
            options: {
              compilerOptions: {
                whitespace: 'condense'
              }
            }
          }
        ]
      },
      /**
       * 申明带有 type=style 参数的文件有副作用
       * 保证文件不会被 webpack 的 tree shaking 机制删除掉
       */
      {
        test: /\.vue$/,
        resourceQuery: /type=style/,
        sideEffects: true
      },
      // 解析 .pug 文件
      // oneOf 数组中定义的 loader 按顺序匹配，只有一个生效
      {
        test: /\.pug$/,
        oneOf: [
          {
            resourceQuery: /vue/,
            use: [
              {
                loader: 'pug-plain-loader'
              }
            ]
          },
          // 处理 pug-template
          {
            use: [
              {
                loader: 'raw-loader'
              },
              {
                loader: 'pug-plain-loader'
              }
            ]
          }
        ]
      },
      /**
       * 使用 webpack5 的 asset 模块解析 .svg、images、音视频文件、字体文件
       * 使用 hash 做缓存
       */
      {
        // ...
        // 略
        // ...
      },
      /**
       * 解析 css
       * 这里面定义了各种 case 下样式的处理规则，大概从 120 行到 1000 行左右，都是在定义处理各种样式文件的 loader
       */
      {
        test: /\.css$/,
        oneOf: [
          {
            // 处理 <style lang="module"></style>
            // 处理顺序：postcss-loader 兼容性 -> css-loader 处理 url() import 其他模块 -> vue-style-loader 挂载 css
            // 下面处理 .css 模块均类似，做了一些删减
            resourceQuery: /module/,
            use: [
              {
                loader: './node_modules/vue-style-loader/index.js',
                options: {
                  sourceMap: false,
                  shadowMode: false
                }
              },
              {
                loader: './node_modules/css-loader/dist/cjs.js',
                options: {
                  sourceMap: false,
                  importLoaders: 2,
                  modules: {
                    localIdentName: '[name]_[local]_[hash:base64:5]',
                    auto: () => true
                  }
                }
              },
              {
                loader: './node_modules/postcss-loader/dist/cjs.js',
                options: {
                  sourceMap: false,
                  /**
                   * 其实这里是 postcss-loader 的默认配置，导入自动添加前缀
                   * postcssOptions: {
                   *   plugins: [
                   *     require('autoprefixer')
                   *   ]
                   * }
                   * 下同
                   */
                  postcssOptions: {
                    plugins: [
                      function () {
                        /* omitted long function */
                      }
                    ]
                  }
                }
              }
            ]
          },
          // 处理 <style></style>
          {
            resourceQuery: /\?vue/,
            use: [
              // 略
            ]
          },
          // 使用 test 精确匹配 .module.xx 样式文件
          {
            test: /\.module\.\w+$/,
            use: [
              // 略
            ]
          },
          /** normal .css */
          {
            use: [
              // 略
            ]
          }
        ]
      },
      // 解析 postcss 规则
      {
        test: /\.p(ost)?css$/,
        oneOf: [
          /**
           * 与上面类似，依次是: resourceQuery: /module/, resourceQuery: /\?vue/, test: /\.module\.\w+$/, normal
           */
          // ...
        ]
      },
      /* 解析 scss 规则 */
      {
        test: /\.scss$/,
        oneOf: [
          {
            resourceQuery: /module/,
            use: [
              // ...
              // 当然先要使用 sass-loader 解析，之后的流程也是 postcss-loader -> css-loader -> vue-style-loader
              {
                loader: 'sass-loader',
                options: {
                  sourceMap: false
                }
              }
            ]
          }
          // ...
        ]
      },
      /* 解析 sass 规则 */
      {
        test: /\.sass$/,
        oneOf: [
          {
            resourceQuery: /module/,
            use: [
              // ... 同 scss
              /* 注意：sass-loader version >= 8，处理基于缩进的 sass 语法 */
              {
                loader: 'sass-loader',
                options: {
                  sourceMap: false,
                  sassOptions: {
                    indentedSyntax: true
                  }
                }
              }
            ]
          }
          // ...
        ]
      },
      /* 解析 less */
      {
        test: /\.less$/,
        oneOf: [
          {
            resourceQuery: /module/,
            use: [
              // ...
              /* 先使用 less-loader 解析，之后的流程也是 postcss-loader -> css-loader -> vue-style-loader */
              {
                loader: 'less-loader',
                options: {
                  sourceMap: false
                }
              }
            ]
          }
          // ...
        ]
      },
      /* 解析 stylus */
      {
        test: /\.styl(us)?$/,
        oneOf: [
          {
            resourceQuery: /module/,
            use: [
              // ...
              /* 先使用 stylus-loader 解析，之后的流程也是 postcss-loader -> css-loader -> vue-style-loader */
              {
                loader: 'stylus-loader',
                options: {
                  sourceMap: false
                }
              }
            ]
          }
          // ...
        ]
      },
      /**
       * 处理 .js 文件
       * 使用 babel-loader 处理，并开启 babel-loader 缓存
       * 1. 提高二次打包构建速度
       * 2. 这里关闭了缓存压缩，在项目文件多时，可以节省时间（开启压缩则可以减少缓存目录的体积）
       * 3. exclude 排除项是一个函数，定义在 https://github.com/vuejs/vue-cli/blob/v5.0.4/packages/%40vue/cli-plugin-babel/index.js#L39
       *    内部详细定义了应该转译（如：.vue 文件的 js 代码）和需要排除的文件（如：node_modules）
       */
      {
        test: /\.m?jsx?$/,
        exclude: [
          function () {
            /* omitted long function */
          }
        ],
        use: [
          {
            loader: './node_modules/babel-loader/lib/index.js',
            options: {
              cacheCompression: false,
              cacheDirectory: './node_modules/.cache/babel-loader',
              cacheIdentifier: '1f79d556'
            }
          }
        ]
      }
    ]
  },
  optimization: {
    realContentHash: false,
    /**
     * 代码分割
     * 1. node_modules 打包到 chunk-vendors.js，-10 优先级最高
     * 2. 被引用到 2 次及以上的模块，打包到 chunk-common.js，-20 优先级次之
     */
    splitChunks: {
      cacheGroups: {
        defaultVendors: {
          name: 'chunk-vendors',
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: 'initial'
        },
        common: {
          name: 'chunk-common',
          minChunks: 2,
          priority: -20,
          chunks: 'initial',
          reuseExistingChunk: true
        }
      }
    },
    // 使用 terser 压缩 js
    minimizer: [
      new TerserPlugin({
        /** options */
      })
    ]
  },
  plugins: [
    // vue-loader 插件
    new VueLoaderPlugin(),
    // 环境变量插件
    new DefinePlugin({
      'process.env': {
        NODE_ENV: '"development"',
        BASE_URL: '"/"'
      }
    }),
    // 大小写敏感插件
    new CaseSensitivePathsPlugin(),
    // 友好错误提示插件
    new FriendlyErrorsWebpackPlugin({
      additionalTransformers: [
        function () {
          /* omitted long function */
        }
      ],
      additionalFormatters: [
        function () {
          /* omitted long function */
        }
      ]
    }),
    // 以 public/index.html 为模板，生成入口 html 文件，并自动引入打包后的 js
    new HtmlWebpackPlugin({
      title: 'workdir', // 项目名称
      scriptLoading: 'defer',
      templateParameters: function () {
        /* omitted long function */
      },
      template: './public/index.html'
    }),
    /**
     * 复制插件
     * 将 public 目录下，除了 .DS_Store 和 index.html 以外的其余文件，复制到 dist 目录下
     * 因为 HtmlWebpackPlugin 已经处理了 index.html
     */
    new CopyPlugin({
      patterns: [
        {
          from: './public',
          to: './dist',
          toType: 'dir',
          noErrorOnMissing: true,
          globOptions: {
            ignore: ['**/.DS_Store', './public/index.html']
          },
          info: {
            minimized: true
          }
        }
      ]
    }),
    // ESLint 插件，开启缓存
    new ESLintWebpackPlugin({
      extensions: ['.js', '.jsx', '.vue'],
      cwd: '.',
      cache: true,
      cacheLocation: './node_modules/.cache/eslint/4ea6a822.json',
      context: '.',
      failOnWarning: false,
      failOnError: true,
      eslintPath: './node_modules/eslint',
      formatter: 'stylish'
    })
  ],
  entry: {
    app: ['./src/main.js']
  }
}
```

> 另外，相比 4.x 的 `@vue/cli`：（暂时）取消了 `preload` 和 `prefetch` 插件；webpack 版本也升级到了 5

### prod 配置文件分析

生产环境配置主要区别有：

- 开启 sourcemap
- 使用 `mini-css-extract-plugin`
- js 文件开启 `thread-loader` 多进程打包
- 压缩 css

```js
module.exports = {
  devtool: 'source-map',
  rules: [
    {
      test: /\.m?jsx?$/,
      use: [
        {
          loader: './workdir/node_modules/thread-loader/dist/cjs.js'
        }
        // ...
      ]
    }
  ],
  optimization: {
    minimizer: [
      // ...
      new CssMinimizerPlugin({
        parallel: true,
        minimizerOptions: {
          preset: [
            'default',
            {
              mergeLonghand: false,
              cssDeclarationSorter: false
            }
          ]
        }
      })
    ]
  },
  // 提取 css 插件
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
      chunkFilename: 'css/[name].[contenthash:8].css'
    })
  ]
}
```

## Vue 3.x

在使用 `@vue/cli` 创建应用时，已经将 vue3 默认的 vue 版本，依然是使用 webpack 作为构建工具，导出的配置文件主要增加了对 `.ts` 文件的解析

> `@vue/cli` 内部，定义 webpack 配置（比如 `cli-service/lib/config/base.js`）时，判断是 vue 3 的项目则会进行一些处理。具体代码可以看：[for Vue 3 projects](https://github.com/vuejs/vue-cli/blob/v5.0.4/packages/%40vue/cli-service/lib/config/base.js#L112)

<!-- prettier-ignore -->
```js
module.exports = {
  resolve: {
    extensions: ['.tsx', '.ts' /* ... */]
  },
  // ...
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: [
          {
            loader: './workdir/node_modules/vue-loader/dist/index.js',
            options: {
              cacheDirectory: './workdir/node_modules/.cache/vue-loader',
              cacheIdentifier: '11b05df6',
              // 添加 @babel/parser 的插件，处理相关语法
              // 见：https://babeljs.io/docs/en/babel-parser#plugins
              babelParserPlugins: ['jsx', 'classProperties', 'decorators-legacy']
            }
          }
        ]
      },
      // ...
      /**
       * 解析 .ts 和 .tsx 文件，均使用 ts-loader -> babel-loader
       * ts-loader：读取 tsconfig 配置，解析 ts -> es6+
       * babel-loader：读取 babel.config.js，将 es6+ 转为向后兼容的 es5，实现按需 polyfill
       */
      {
        test: /\.ts$/,
        use: [
          {
            loader: './workdir/node_modules/babel-loader/lib/index.js'
          },
          {
            loader: './workdir/node_modules/ts-loader/index.js',
            options: {
              transpileOnly: true,              // 只做语言转换，不做类型检查，提升编译速度
              appendTsSuffixTo: ['\\.vue$'],    // .vue -> .vue.ts 保证 .vue 文件中 ts 代码能被处理
              /**
               * 这个配置是 ts-loader 的默认配置
               * 与是否开启 thread-loader 保持一致（生产模式时开启了 thread-loader，这个值也会设置为 true）
               * 见：https://github.com/TypeStrong/ts-loader#happypackmode
               */
              // 
              happyPackMode: false
            }
          }
        ]
      }
    ],
    plugins: [
      // ...
      /**
       * 补全类型检查的插件
       * 因为上面的 ts-loader 没有做类型检查
       * 原理这个插件会开启一个单独的线程去执行类型检查
       */
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          extensions: {
            vue: {
              enabled: true,
              compiler: './workdir/node_modules/vue/compiler-sfc/index.js'
            }
          },
          // 检查语义错误，不检查语法错误（ts-loader 设置 transpileOnly: true，依然会做语法检查）
          diagnosticOptions: {
            semantic: true,
            syntactic: false
          }
        }
      })
    ]
  }
}
```

ts-loader 有打包速度问题？（待验证）

```js
// vue.config.js

module.exports = {
  chainWebpack: (config) => {
    config.module.rule('ts').uses.delete('ts-loader')
    config.module.rule('tsx').uses.delete('ts-loader')
  }
}

// babel.config.js
module.exports = {
  presets: [
    '@vue/app',
    [
      '@babel/preset-typescript',
      {
        allExtensions: true,
        isTSX: true
      }
    ]
  ],
  plugins: ['@babel/plugin-transform-typescript']
}
```
