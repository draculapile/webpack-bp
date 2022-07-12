# webpack-bp

webpack(5.x) **be...tter** practice and some notes

重要知识点请查看具体目录下的配置文件，build 依赖的包版本：

> webpack@5.72.0 webpack-cli@4.9.2

Tips：

> 1. v4.x 版本 webpack 打包结果请自行尝试
> 2. 可以将 `webpack` 和 `webpack-cli` 等依赖安装到根目录（如本项目），每个文件夹下建立 `package.json`，单独执行 `build` 命令，共享依赖（默认会向上层目录寻找）
>    a. 或者使用软链接命令 `ls`

```shell
ls -s dir1/node_modules dir2/node_modules
```

大纲

- [webpack-bp](#webpack-bp)
  - [基础](./basic-config/README.MD)
    - [基本概念](#基本概念)
      - [module、chunk、asset](./basic-config/README.MD#module、chunk、asset)
    - [基础配置](./basic-config/README.MD#基础配置)
      - [module](./basic-config/README.MD#module)
      - [target](./basic-config/README.MD#target)
      - [entry](./basic-config/README.MD#entry)
      - [output](./basic-config/README.MD#output)
      - [mode](./basic-config/README.MD#mode)
      - [resolve](./basic-config/README.MD#resolve)
      - [loaders](./basic-config/README.MD#loaders)
      - [plugins](./basic-config/README.MD#plugins)
      - [文件指纹](./basic-config/README.MD#文件指纹)
      - [环境变量](./basic-config/README.MD#环境变量)
      - [devServer](./basic-config/README.MD#devserver)
      - [polyfill](./basic-config/README.MD#polyfill)
  - [进阶和优化](./advanced-optimization/README.md)
    - [CSS](./advanced-optimization/README.md#css)
      - [`css-loader` 的 `importLoaders` 参数](./advanced-optimization/README.md#css-loader-的-importloaders-参数)
    - [资源内联](./advanced-optimization/README.md#资源内联)
      - [场景一：公共 HTML 嵌入入口文件](./advanced-optimization/README.md#场景一公共-html-嵌入入口文件)
      - [场景二：CSS 内联](./advanced-optimization/README.md#场景二css-内联)
    - [自动清理构建目录](./advanced-optimization/README.md#自动清理构建目录)
    - [代码分割 Code Splitting](./advanced-optimization/README.md#代码分割-code-splitting)
      - [动态引入 Dynamic Imports](./advanced-optimization/README.md#动态引入-dynamic-imports)
      - [splitChunks](./advanced-optimization/README.md#splitchunks)
        - `reuseExistingChunk`
        - `maxAsyncRequests` 和 `maxInitialRequests`
        - 样式文件分包
        - 最佳实践
    - [Scope Hoisting](./advanced-optimization/README.md#scope-hoisting)
      - [注意事项](./advanced-optimization/README.md#注意事项)
    - [Tree Shaking](./advanced-optimization/README.md#tree-shaking)
      - [标记 `unused` 导出](./advanced-optimization/README.md#标记-unused-导出)
        - 结合 `optimization.minimize` 配置项
        - 一些标记失效场景
          - 场景一：导出的对象内部属性
          - 场景二：保留对模块内变量的引用
          - 场景三：`Class` 内未使用的方法
        - 标记失效 `!==` 无法 Tree Shaking
      - [`sideEffects`：整体移除文件和模块](./advanced-optimization/README.md#sideeffects整体移除文件和模块)
        - `optimization.sideEffects`
          - reexport 优化
          - with CSS
        - `/*#__PURE__*/` 注释
      - [CSS 的 minify](./advanced-optimization/README.md#css-的-minify)
      - [With Babel](./advanced-optimization/README.md#with-babel)
      - [CommonJS 的 Tree Shaking](./advanced-optimization/README.md#commonjs-的-tree-shaking)
      - [最佳实践](./advanced-optimization/README.md#最佳实践)
    - [持久化缓存 Persistent Caching](./advanced-optimization/README.md#持久化缓存-persistent-caching)
      - [构建依赖、缓存版本、缓存名称](./advanced-optimization/README.md#构建依赖、缓存版本、缓存名称)
      - [watch 模式下的缓存](./advanced-optimization/README.md#watch-模式下的缓存)
      - [快照 snapshot](./advanced-optimization/README.md#快照-snapshot)
      - [查看 Log 信息](./advanced-optimization/README.md#查看-log-信息)
    - [模块联邦](./advanced-optimization/README.md#模块联邦)
  - [Babel 配置详解](./babel/README.MD)
  - [Vue 配置文件解析](./vue-cli-config/README.md)
  - [React 配置文件解析](./react-cli-config/README.md)
  - [Source Map](./source-map/README.md)
  - [原理与源码分析](./analysis/README.md)
    - [Debug Webpack in VSCode](./analysis/README.md#debug-webpack-in-vscode)
    - [`/.bin/webpack` 入口命令分析](./analysis/README.md#binwebpack-入口命令分析)
    - [运行时分析](./analysis/README.md#运行时分析)
      - [模块加载原理](./analysis/README.md#模块加载原理)
        - [CommonJS](./analysis/README.md#commonjs)
        - [ES Modules](./analysis/README.md#es-modules)
        - [ES Modules 和 CommonJS 混用](./analysis/README.md#es-modules-和-commonjs-混用)
    - [Tapable 架构与 Hooks 设计](./analysis/README.md#tapable-架构与-hooks-设计)
    - [Plugin 机制](./analysis/README.md#plugin-机制)
    - [Loader 机制](./analysis/README.md#loader-机制)
    - [Mini Pack](./analysis/README.md#mini-pack)

> continuous building...
