# create-react-app 的 webpack 配置

> `create-react-app` 提供了 `eject` 命令，`npm run eject`
> 导出配置到 config 目录；将构建命令的细节输出到 scripts 目录

目录结构：

```txt
config
 ├── env.js                                 # 环境变量
 ├── getHttpsConfig.js                      # https 配置
 ├── jest
 │   ├── babelTransform.js
 │   ├── cssTransform.js
 │   └── fileTransform.js
 ├── modules.js                             # 获取模块相关
 ├── paths.js                               # 处理路径相关
 ├── webpack
 │   └── persistentCache
 │       └── createEnvironmentHash.js       # 为环境变量文件创建 hash 值
 ├── webpack.config.js                      # webpack 配置
 └── webpackDevServer.config.js             # webpack 开发服务器的配置

scripts
 ├── build.js
 ├── start.js
 └── test.js
```

## 读取 webpack 配置流程

以 `start.js` 为入口，分析 dev 环境下读取配置的流程：

<!-- prettier-ignore -->
```js
'use strict';

// 定义 NODE_ENV，BABEL_ENV 为开发环境
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

// 监听 unhandledrejection 事件，处理没有 reject handler 处理的 reject 状态的 Promise
// （在 Node.js 里，默认会将没处理的 rejections 输出到 console.log；而抛出错误可以退出进程）
process.on('unhandledRejection', err => {
  throw err;
});

// 加载 config/env 环境变量文件
require('../config/env');

// 加载一系列包

const configFactory = require('../config/webpack.config');
const createDevServerConfig = require('../config/webpackDevServer.config');
const getClientEnvironment = require('../config/env');
// ...

const env = getClientEnvironment(paths.publicUrlOrPath.slice(0, -1));
// 判断是否存在 yarn.lock
const useYarn = fs.existsSync(paths.yarnLockFile);
// 检测是否运行在文本终端（TTY）上下文环境中
const isInteractive = process.stdout.isTTY;

// 检测必要的入口文件，public/index.html 和 src/index.js
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1);
}

// 定义端口与域名
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

if (process.env.HOST) {
  // log something
}

// 会先检测 package.json 中是否定义了 browserslist 配置（推荐定义该值），是则返回该配置
// 没有的话，判断是否终端环境，如果在终端环境下，会询问是否添加；不添加会直接退出；
// 非终端环境，写入默认的 browserslist
const { checkBrowsers } = require('react-dev-utils/browsersHelper');

// 链式调用
// browserslist 检测 -> 端口检测 -> 创建 compiler 对象 -> 创建 proxy -> 启动 devServer 服务 -> 如果在交互模式下清理控制台，再打开浏览器 devServer
checkBrowsers(paths.appPath, isInteractive)
  .then(() => {
    // 选择可用端口
    return choosePort(HOST, DEFAULT_PORT);
  })
  .then(port => {
    if (port == null) {
      // 未找到，return
      return;
    }

    // 传入当前环境参数，拿到 webpack 的配置对象（开发环境）
    const config = configFactory('development');

    const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
    const appName = require(paths.appPackageJson).name;

    const useTypeScript = fs.existsSync(paths.appTsConfig);
    const urls = prepareUrls(
      protocol,
      HOST,
      port,
      paths.publicUrlOrPath.slice(0, -1)
    );

    const compiler = createCompiler({
      appName,
      config,
      urls,
      useYarn,
      useTypeScript,
      webpack,
    });
    // 加载 package.json 中的 proxy 配置
    const proxySetting = require(paths.appPackageJson).proxy;
    // 合并配置
    const proxyConfig = prepareProxy(
      proxySetting,
      paths.appPublic,
      paths.publicUrlOrPath
    );
    // 合并 dev server 配置，具体配置见 config/webpackDevServer.config.js
    const serverConfig = {
      ...createDevServerConfig(proxyConfig, urls.lanUrlForConfig),
      host: HOST,
      port,
    };
    const devServer = new WebpackDevServer(serverConfig, compiler);
    // 启动 WebpackDevServer
    devServer.startCallback(() => {
      if (isInteractive) {
        clearConsole(); // 清理终端
      }

      // 快速刷新，即模块热替换（HMR）方案
      if (env.raw.FAST_REFRESH && semver.lt(react.version, '16.10.0')) {
        // log
      }
      // ...
      // 打开浏览器
      openBrowser(urls.localUrlForBrowser);
    });

    // SIGINT 和 SIGTERM 都是信号的一种
    // （信号用于系统进程之间通信）
    // SIGINT：值为 2，按 Ctrl + C 时触发，终止当前进程；或者 kill -2 <process_id>
    // SIGTERM：值为 15，kill <process_id> 触发，或者 kill -15 <process_id> 触发

    ['SIGINT', 'SIGTERM'].forEach(function (sig) {
      process.on(sig, function () {
        devServer.close();
        process.exit();
      });
    });

    if (process.env.CI !== 'true') {
      // 这里处理非 CI 环境下（CI 环境：如 Jenkins，GitLab CI 等）
      // Readable 标准输入流监听到 'end' 事件时（没有更多数据可供消费）
      // 如：按下 Ctrl + D，就会告诉终端在标准输入上注册一个 EOF，一般会关闭终端，也要退出进程
      process.stdin.on('end', function () {
        devServer.close();
        process.exit();
      });
    }
  })
  .catch(err => {
    // 打印 error 信息，退出进程
  });

```

处理环境变量相关逻辑的 `env.js`

<!-- prettier-ignore -->
```js
'use strict';
// require fs path
// 加载 ./paths 下定义的一系列路径变量
const paths = require('./paths');

/**
 * Node 的 require 会有缓存
 * require.resolve('./paths') 保证路径准确
 * 上面加载了 ./paths，然后这里清除缓存
 * 目的是为了 paths 文件修改了之后，这里再读取，能读到修改后的文件（而不是命中缓存）
 */
delete require.cache[require.resolve('./paths')];

// NODE_ENV 检测
const NODE_ENV = process.env.NODE_ENV;
if (!NODE_ENV) {
  // throw error
}

// 使用 dotenv 从 .env* 文件中加载环境变量
const dotenvFiles = [
  `${paths.dotenv}.${NODE_ENV}.local`,
  NODE_ENV !== 'test' && `${paths.dotenv}.local`,
  `${paths.dotenv}.${NODE_ENV}`,
  paths.dotenv,
].filter(Boolean);

dotenvFiles.forEach(dotenvFile => {
  if (fs.existsSync(dotenvFile)) {
    require('dotenv-expand')(
      require('dotenv').config({
        path: dotenvFile,
      })
    );
  }
});

// 支持根据 NODE_PATH 变量值，定义 node 引入模块（require 和 import）的路径，但是引入路径只能是相对路径
// 因此这里处理一下 NODE_PATH 的值
const appDirectory = fs.realpathSync(process.cwd());
process.env.NODE_PATH = (process.env.NODE_PATH || '')
  .split(path.delimiter)
  .filter(folder => folder && !path.isAbsolute(folder))
  .map(folder => path.resolve(appDirectory, folder))
  .join(path.delimiter);

// 其他的环境变量均需要以 REACT_APP_ 开头
const REACT_APP = /^REACT_APP_/i;

// 返回环境变量
function getClientEnvironment(publicUrl) {
  const raw = Object.keys(process.env)
    .filter(key => REACT_APP.test(key))
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PUBLIC_URL: publicUrl,
        // sockjs 相关
        WDS_SOCKET_HOST: process.env.WDS_SOCKET_HOST,
        WDS_SOCKET_PATH: process.env.WDS_SOCKET_PATH,
        WDS_SOCKET_PORT: process.env.WDS_SOCKET_PORT,

        FAST_REFRESH: process.env.FAST_REFRESH !== 'false',
      }
    );
  // JSON.stringify 处理所有的变量值，为 DefinePlugin 所用
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { raw, stringified };
}

module.exports = getClientEnvironment;
```

处理路径相关 `paths.js`

<!-- prettier-ignore -->
```js
// 项目根目录
const appDirectory = fs.realpathSync(process.cwd())
// 根据相对路径，生成绝对路径
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath)

// 打包后资源的公共路径，
// 三个参数：是否开发环境，package.json 中定义的 homepage 字段，环境变量中的 PUBLIC_URL
// 定义了 PUBLIC_URL 环境变量，则使用处理后的 PUBLIC_URL
// 定义了 package.json 中的 homepage 字段，则使用处理后的 homepage
// 都没有，则返回默认值 '/'
// 处理方式：确保以 '/' 结尾；开发环境下，还会去掉 domain 域名
const publicUrlOrPath = getPublicUrlOrPath(
  process.env.NODE_ENV === 'development',
  require(resolveApp('package.json')).homepage,
  process.env.PUBLIC_URL
)

const buildPath = process.env.BUILD_PATH || 'build'

// 扩展名
const moduleFileExtensions = [
  'web.mjs',
  'mjs',
  'web.js',
  'js',
  'web.ts',
  'ts',
  'web.tsx',
  'tsx',
  'json',
  'web.jsx',
  'jsx'
]

// 根据扩展名，解析模块
const resolveModule = (resolveFn, filePath) => {
  const extension = moduleFileExtensions.find((extension) =>
    fs.existsSync(resolveFn(`${filePath}.${extension}`))
  )

  if (extension) {
    return resolveFn(`${filePath}.${extension}`)
  }

  return resolveFn(`${filePath}.js`)
}

// 解析模块的路径
module.exports = {
  dotenv: resolveApp('.env'),
  appPath: resolveApp('.'),
  // ...
  swSrc: resolveModule(resolveApp, 'src/service-worker'),
  publicUrlOrPath
}

module.exports.moduleFileExtensions = moduleFileExtensions
```

> 1. `modules.js` 主要是封装了一些获取模块的函数，导出一个包含 `alias` 和 `jestAlias` 等路径的对象，给 `webpack.config.js` 使用；
> 2. `devServer` 的配置相对简单，不再展开分析

## 核心 webpack 配置

`configFactory` 是由 `webpack.config.js` 导出

<!-- prettier-ignore -->
```js
'use strict';

// 加载一系列 node 模块和插 webpack 插件 ...

const paths = require('./paths');
const modules = require('./modules');
const getClientEnvironment = require('./env');

const createEnvironmentHash = require('./webpack/persistentCache/createEnvironmentHash');

// GENERATE_SOURCEMAP 定义为 false，则不生成 SourceMap 文件，默认会生成
const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false';

// ...

// 决定是否使用 InlineChunkHtmlPlugin 插件将运行时代码（runtime chunk）嵌入到 index.html 中
const shouldInlineRuntimeChunk = process.env.INLINE_RUNTIME_CHUNK !== 'false';

const emitErrorsAsWarnings = process.env.ESLINT_NO_DEV_ERRORS === 'true';
const disableESLintPlugin = process.env.DISABLE_ESLINT_PLUGIN === 'true';

// 图片内联（打包成 base64） size
const imageInlineSizeLimit = parseInt(
  process.env.IMAGE_INLINE_SIZE_LIMIT || '10000'
);

// 是否存在 tsconfig
const useTypeScript = fs.existsSync(paths.appTsConfig);

// 是否存在 Tailwind 配置文件
const useTailwind = fs.existsSync(
  path.join(paths.appPath, 'tailwind.config.js')
);

// ...

// 定义各种样式文件的正则
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

// React 17 底层引入了新 JSX 转换机制（_jsx），<17 版本需要手动设置 DISABLE_NEW_JSX_TRANSFORM 为 true
// 这里判断是否可以正常引入
const hasJsxRuntime = (() => {
  if (process.env.DISABLE_NEW_JSX_TRANSFORM === 'true') {
    return false;
  }

  try {
    require.resolve('react/jsx-runtime');
    return true;
  } catch (e) {
    return false;
  }
})();

// 导出的是一个函数
module.exports = function (webpackEnv) {
  const isEnvDevelopment = webpackEnv === 'development';
  const isEnvProduction = webpackEnv === 'production';

  // 判断生产环境下是否有性能分析参数 --profile
  const isEnvProductionProfile =
    isEnvProduction && process.argv.includes('--profile');

  // paths 文件中的 publicUrlOrPath 
  const env = getClientEnvironment(paths.publicUrlOrPath.slice(0, -1));

  const shouldUseReactRefresh = env.raw.FAST_REFRESH;

  // 返回处理样式的 loader 数组，['style-loader', 'css-loader', 'postcss-loader']
  const getStyleLoaders = (cssOptions, preProcessor) => {
    // 省略具体代码，大致逻辑是
    // dev: style-loader, prod: MiniCssExtractPlugin.loader（并处理 PUBLIC_URL 为相对路径的情况）
    // css-loader 根据 cssOptions 参数处理
    // postcss-loader 根据是否使用 tailwind 加载不同的配置
    // 如果传入了 preProcessor 预处理器（如：sass-loader），则先使用该预处理器，和 resolve-url-loader 处理 url()
    
    // ...
  };

  return {
    target: ['browserslist'],
    // 打包过程仅输出 error 和 warning 信息
    stats: 'errors-warnings',
    mode: isEnvProduction ? 'production' : isEnvDevelopment && 'development',
    // 生产环境，打包报错会立即停止
    bail: isEnvProduction,
    // prod: 'source-map'; dev: 'cheap-module-source-map'
    devtool: isEnvProduction
      ? shouldUseSourceMap
        ? 'source-map'
        : false
      : isEnvDevelopment && 'cheap-module-source-map',
    entry: paths.appIndexJs,
    output: {
      path: paths.appBuild,
      // 为生成的 require()s 导入添加 /* filename */ 注释，标明源文件
      pathinfo: isEnvDevelopment,
      filename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].js'
        : isEnvDevelopment && 'static/js/bundle.js',
      // code splitting 分割的 chunk name
      chunkFilename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].chunk.js'
        : isEnvDevelopment && 'static/js/[name].chunk.js',
      assetModuleFilename: 'static/media/[name].[hash][ext]',
      publicPath: paths.publicUrlOrPath,
      // 定义 source map 源文件在磁盘上的位置（处理 Win 的 \ -> /，统一格式）
      // 生产环境下：文件的绝对路径
      // 开发环境下：解析成相对路径，如：'../../static/js/bundle.js.map'
      devtoolModuleFilenameTemplate: isEnvProduction
        ? info =>
            path
              .relative(paths.appSrc, info.absoluteResourcePath)
              .replace(/\\/g, '/')
        : isEnvDevelopment &&
          (info => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/')),
    },
    // webpack5 的缓存配置
    cache: {
      type: 'filesystem',                         // 使用该值，开启持久化缓存，并开放下面的配置选项
      version: createEnvironmentHash(env.raw),    // 定义 env 环境变量文件的 hash，env 文件变化，缓存失效
      cacheDirectory: paths.appWebpackCache,      // 缓存目录
      store: 'pack',                              // 将所有缓存项的数据存储在单个文件中
      /**
       * 指定构建过程中的依赖
       * 1. 如果 webpack/lib/ 或 webpack 依赖的库（loader）发生任何变化时，使缓存失效
       * 2. __filename 就是当前 webpack 配置文件的文件名：`webpack.config.js`；
       *    配置该项，将 config.js 中所有的 require 依赖都作为构建依赖，有改动则使缓存失效
       * 3. 同理，将 tsconfig 配置也作为构建依赖
       */
      buildDependencies: {
        defaultWebpack: ['webpack/lib/'],
        config: [__filename],
        tsconfig: [paths.appTsConfig, paths.appJsConfig].filter(f =>
          fs.existsSync(f)
        ),
      },
    },
    infrastructureLogging: {
      level: 'none',
    },
    optimization: {
      // 只在生产环境开启压缩
      minimize: isEnvProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            parse: {
              // 指定 ecma 版本最高到 ES2017
              ecma: 8,
            },
            compress: {
              // 为 ES5 代码指定详细压缩配置
              // 主要是解决一些特定场景下的 bug
              ecma: 5,
              warnings: false,
              comparisons: false,
              inline: 2,
            },
            // 这个配置是指在压缩过程中，针对 terser 的“碾碎”操作，进行 excluded 或者 included
            mangle: {
              // 特定地修复 safari10 下 iterator 的 bug: for (let e of [1, 2, 3]) { / * * / }
              safari10: true,
            },
            // 在生产环境下且 build 时传递了 --profile （性能分析）参数，保留类名和函数名
            keep_classnames: isEnvProductionProfile,
            keep_fnames: isEnvProductionProfile,
            output: {
              ecma: 5,
              comments: false,
              // 避免 emoji and regex 被错误地压缩
              ascii_only: true,
            },
          },
        }),
        new CssMinimizerPlugin(),
      ],
    },
    resolve: {
      modules: ['node_modules', paths.appNodeModules].concat(
        modules.additionalModulePaths || []
      ),
      extensions: paths.moduleFileExtensions
        .map(ext => `.${ext}`)
        .filter(ext => useTypeScript || !ext.includes('ts')),
      alias: {
        'react-native': 'react-native-web',
        ...(isEnvProductionProfile && {
          'react-dom$': 'react-dom/profiling',
          'scheduler/tracing': 'scheduler/tracing-profiling',
        }),
        ...(modules.webpackAliases || {}),
      },
      plugins: [
        // 模块作用域插件，确保用户引入该配置中文件
        // 主要是 src 目录下的文件，以及 package.json 定义的，避免意料之外的错误
        new ModuleScopePlugin(paths.appSrc, [
          paths.appPackageJson,
          reactRefreshRuntimeEntry,
          reactRefreshWebpackPluginRuntimeEntry,
          babelRuntimeEntry,
          babelRuntimeEntryHelpers,
          babelRuntimeRegenerator,
        ]),
      ],
    },
    module: {
      strictExportPresence: true, // 确保丢失导出会报错
      rules: [
        // 使用 source-map-loader 加载 node_modules 包里包含的 source map 文件
        shouldUseSourceMap && {
          enforce: 'pre',
          exclude: /@babel(?:\/|\\{1,2})runtime/,
          test: /\.(js|mjs|jsx|ts|tsx|css)$/,
          loader: require.resolve('source-map-loader'),
        },
        {
          oneOf: [
            {
              / * 使用 asset 处理 image * /
            },
            {
              / * 使用 file-loader 处理 image * /
            },
            // 处理 src 目录下的 js
            {
              test: /\.(js|mjs|jsx|ts|tsx)$/,
              include: paths.appSrc,
              loader: require.resolve('babel-loader'),
              options: {
                customize: require.resolve(
                  'babel-preset-react-app/webpack-overrides'
                ),
                presets: [
                  [
                    require.resolve('babel-preset-react-app'),
                    // for React 17+
                    {
                      runtime: hasJsxRuntime ? 'automatic' : 'classic',
                    },
                  ],
                ],
                
                plugins: [
                  isEnvDevelopment &&
                    shouldUseReactRefresh &&
                    require.resolve('react-refresh/babel'),
                ].filter(Boolean),
                // 开启缓存
                cacheDirectory: true,
                // 关闭缓存压缩
                cacheCompression: false,
                compact: isEnvProduction,
              },
            },
            // 处理非 src 目录下的 js，排除 @babel/runtime
            {
              test: /\.(js|mjs)$/,
              exclude: /@babel(?:\/|\\{1,2})runtime/,
              loader: require.resolve('babel-loader'),
              options: {
                babelrc: false,
                configFile: false,
                compact: false,
                presets: [
                  [
                    require.resolve('babel-preset-react-app/dependencies'),
                    { helpers: true },
                  ],
                ],
                cacheDirectory: true,
                cacheCompression: false,
                
                // 需要生成 Babel source map 文件
                sourceMaps: shouldUseSourceMap,
                inputSourceMap: shouldUseSourceMap,
              },
            },
            // 处理 .css
            // mode 参数与 css modules 相关，传递给 css-loader 
            {
              test: cssRegex,
              exclude: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvProduction
                  ? shouldUseSourceMap
                  : isEnvDevelopment,
                modules: {
                  mode: 'icss',
                },
              }),
              sideEffects: true,
            },
            // 处理 .module.css
            {
              test: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvProduction
                  ? shouldUseSourceMap
                  : isEnvDevelopment,
                modules: {
                  mode: 'local',
                  // 自定义的 hash 规则
                  getLocalIdent: getCSSModuleLocalIdent,
                },
              }),
            },
            // 处理 .scss 或者 .sass
            {
              test: sassRegex,
              exclude: sassModuleRegex,
              use: getStyleLoaders(
                {
                  importLoaders: 3,
                  sourceMap: isEnvProduction
                    ? shouldUseSourceMap
                    : isEnvDevelopment,
                  modules: {
                    mode: 'icss',
                  },
                },
                'sass-loader'
              ),
              sideEffects: true,
            },
            // 处理 .module.scss 或者 .module.sass
            {
              test: sassModuleRegex,
              use: getStyleLoaders(
                {
                  importLoaders: 3,
                  sourceMap: isEnvProduction
                    ? shouldUseSourceMap
                    : isEnvDevelopment,
                  modules: {
                    mode: 'local',
                    getLocalIdent: getCSSModuleLocalIdent,
                  },
                },
                'sass-loader'
              ),
            },
            {
              // 其余的，除了 .js 和 .jsx 等，都使用 webpack asset 资源模块处理
              exclude: [/^$/, /\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
              type: 'asset/resource',
            },
          ],
        },
      ].filter(Boolean),
    },
    plugins: [
      new HtmlWebpackPlugin(
        Object.assign(
          {},
          {
            inject: true,
            template: paths.appHtml,
          },
          isEnvProduction
            ? {
              // 仅生产环境下添加压缩相关的配置
                minify: {
                  removeComments: true,
                  collapseWhitespace: true,
                  removeRedundantAttributes: true,
                  useShortDoctype: true,
                  removeEmptyAttributes: true,
                  removeStyleLinkTypeAttributes: true,
                  keepClosingSlash: true,
                  minifyJS: true,
                  minifyCSS: true,
                  minifyURLs: true,
                },
              }
            : undefined
        )
      ),

      isEnvProduction &&
        shouldInlineRuntimeChunk &&
        new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime-.+[.]js/]),
      // 替换 public/index.html 中定义的 %PUBLIC_URL%
      new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),

      new ModuleNotFoundPlugin(paths.appPath),
      // 定义环境变量
      new webpack.DefinePlugin(env.stringified),
      // HMR
      isEnvDevelopment &&
        shouldUseReactRefresh &&
        new ReactRefreshWebpackPlugin({
          overlay: false,
        }),
      // 开发环境下文件路径大小写敏感
      isEnvDevelopment && new CaseSensitivePathsPlugin(),
      // 生产环境提取 css
      isEnvProduction &&
        new MiniCssExtractPlugin({
          filename: 'static/css/[name].[contenthash:8].css',
          chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
        }),
      // 提取 manifest 数据 -> json，包含模块来源信息
      new WebpackManifestPlugin({
        fileName: 'asset-manifest.json',
        publicPath: paths.publicUrlOrPath,
        generate: (seed, files, entrypoints) => {
          const manifestFiles = files.reduce((manifest, file) => {
            manifest[file.name] = file.path;
            return manifest;
          }, seed);
          const entrypointFiles = entrypoints.main.filter(
            fileName => !fileName.endsWith('.map')
          );

          return {
            files: manifestFiles,
            entrypoints: entrypointFiles,
          };
        },
      }),
      // 忽略 moment.js 语言包
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      }),
      // PWA
      isEnvProduction &&
        fs.existsSync(swSrc) &&
        new WorkboxWebpackPlugin.InjectManifest({
          swSrc,
          dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
          exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        }),
      // 补全 ts 类型检查
      useTypeScript &&
        new ForkTsCheckerWebpackPlugin({
          async: isEnvDevelopment,
          typescript: {
            typescriptPath: resolve.sync('typescript', {
              basedir: paths.appNodeModules,
            }),
            configOverwrite: {
              compilerOptions: {
                sourceMap: isEnvProduction
                  ? shouldUseSourceMap
                  : isEnvDevelopment,
                skipLibCheck: true,
                inlineSourceMap: false,
                declarationMap: false,
                noEmit: true,
                incremental: true,
                tsBuildInfoFile: paths.appTsBuildInfoFile,
              },
            },
            context: paths.appPath,
            diagnosticOptions: {
              syntactic: true,
            },
            mode: 'write-references',
            // profile: true,
          },
          issue: {
            // 给 CI 测试用，使得 micromatch 正确识别 ts 等
            include: [
              { file: '../**/src/**/*.{ts,tsx}' },
              { file: '**/src/**/*.{ts,tsx}' },
            ],
            exclude: [
              { file: '**/src/**/__tests__/**' },
              { file: '**/src/**/?(*.){spec|test}.*' },
              { file: '**/src/setupProxy.*' },
              { file: '**/src/setupTests.*' },
            ],
          },
          logger: {
            infrastructure: 'silent',
          },
        }),
      !disableESLintPlugin &&
        new ESLintPlugin({
          // Plugin options
          extensions: ['js', 'mjs', 'jsx', 'ts', 'tsx'],
          formatter: require.resolve('react-dev-utils/eslintFormatter'),
          eslintPath: require.resolve('eslint'),
          failOnError: !(isEnvDevelopment && emitErrorsAsWarnings),
          context: paths.appSrc,
          cache: true,
          cacheLocation: path.resolve(
            paths.appNodeModules,
            '.cache/.eslintcache'
          ),
          // ESLint class options
          cwd: paths.appPath,
          resolvePluginsRelativeTo: __dirname,
          baseConfig: {
            extends: [require.resolve('eslint-config-react-app/base')],
            rules: {
              ...(!hasJsxRuntime && {
                'react/react-in-jsx-scope': 'error',
              }),
            },
          },
        }),
    ].filter(Boolean),
    // 关闭性能提示
    performance: false,
  };
};
```
