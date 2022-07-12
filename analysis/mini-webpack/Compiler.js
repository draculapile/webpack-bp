const { SyncHook } = require('tapable')

// 这里用 babel 偷懒，实际 webpack 内部调用的是 acorn
const types = require('@babel/types')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generator = require('@babel/generator').default

const path = require('path')
const fs = require('fs')

const { toUnixPath } = require('./utils')

const ROOT_PATH = toUnixPath(process.cwd())

class Compiler {
  constructor(options) {
    this.options = options
    this.hooks = {
      run: new SyncHook(),
      emit: new SyncHook(),
      done: new SyncHook()
    }
    this.entries = new Set()
    this.modules = new Set()
    this.chunks = new Set()
    this.assets = {}
    this.files = new Set()
  }

  run(callback) {
    this.hooks.run.call()
    // 5. 根据配置中的 entry 找出入口文件
    let entry = {}
    if (typeof this.options.entry === 'string') {
      entry.main = this.options.entry
    } else {
      entry = this.options.entry
    }
    // 根路径
    let rootPath = this.options.context || ROOT_PATH
    for (const entryName in entry) {
      // 源码里，多入口文件还会并行处理
      const entryPath = toUnixPath(path.join(rootPath, entry[entryName]))
      // 6. 从入口文件出发，调用所有配置的 loader 对模块进行编译
      const entryModule = this.buildModule(entryName, entryPath)
      this.entries.add(entryModule)
      this.modules.add(entryModule)

      // 根据入口和模块之间的依赖关系，组装包含多模块的 chunk
      let chunk = {
        name: entryName,
        entryModule,
        modules: this.modules.filter((m) => m.name === entryName)
      }
      // 如果不分割，一个 entry 就对应一个 chunk
      this.chunks.add(chunk)
    }

    // 将每个 chunk 转成单独的文件，加入到输出列表 this.assets
    let output = this.options.output
    this.chunks.forEach((chunk) => {
      let filename = path.join(output.path, output.filename.replace('[name]', chunk.name))
      this.assets[filename] = getSource(chunk)
    })

    this.files = Object.keys(this.assets)
    for (const file in this.assets) {
      const filePath = path.join(output.path, file)
      fs.writeFileSync(filePath, this.assets[file])
    }

    this.hooks.done.call()
  }

  buildModule(entryName, modulePath) {
    // 1. 读取模块内容
    const originalSourceCode = fs.readFileSync(modulePath, 'utf-8')
    let targetSourceCode = originalSourceCode
    // 2. 调用所有配置的 loader 对模块进行编译
    let rules = this.options.module.rules
    // 得到本文件模块生效的 loader
    let loaders = []
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].test.test(modulePath)) {
        loaders = [...loaders, ...rules[i].use]
      }
    }
    // 倒序加载 loader，执行
    for (let i = loaders.length - 1; i >= 0; i--) {
      targetSourceCode = require(loaders[i])(targetSourceCode)
    }

    // 7. 找出该模块依赖的模块，递归本步骤
    let moduleId = './' + path.posix.relative(ROOT_PATH, modulePath)
    let module = {
      id: moduleId,
      dependencies: [],
      name: entryName
    }
    let ast = parser.parse(targetSourceCode, { sourceType: 'module' })
    traverse(ast, {
      CallExpression: ({ node }) => {
        if (node.callee.name === 'require') {
          // 引入模块的相对路径
          const moduleName = node.arguments[0].value
          // 获取要加载模块的绝对路径，首先要获得当前模块所在的目录
          const dirName = path.posix.dirname(modulePath)
          let depModulePath = path.posix.join(dirName, moduleName)
          // 加后缀
          const extensions = this.options.resolve.extensions
          depModulePath = tryExtensions(depModulePath, extensions, moduleName, dirName)
          let depModuleId = './' + path.posix.relative(ROOT_PATH, depModulePath)
          node.arguments = [types.stringLiteral(depModuleId)]
          // 判断现有的已经编译过的 modules 里是否有当前模块，有则不添加
          // if (this.modules.has(depModuleId)) {
          //   module.dependencies.add(depModulePath)
          // }

          // 如果已经编译过的模块里不包含这个依赖模块的话才添加（解决循环依赖）
          let alreadyModuleIds = Array.from(this.modules).map((m) => m.id)
          if (!alreadyModuleIds.includes(depModuleId)) {
            module.dependencies.add(depModulePath)
          }
        }
      }
    })
    const { code } = generator(ast)
    module._source = code // 此模块的源代码
    // 编译完当前模块后，找到它所有的依赖，进行递归编译，添加到 this.modules
    module.dependencies.forEach((dep) => {
      const depModule = this.buildModule(entryName, dep)
      this.modules.add(depModule)
    })

    return module
  }
}

/**
 * 获取 chunk 对应的源代码，输出的文件内容
 * @param {*} chunk
 */
function getSource(chunk) {
  return `
    (() => {
      var modules = ({
        ${chunk.modules
          .map(
            (module) => `
            "${module.id}": (module, exports, require) => {
              ${module._source}
            }
          `
          )
          .join(',')}
      });
      var cache = {};
      function require(moduleId) {
        var cachedModule = cache[moduleId];
        if (cachedModule !== undefined) {
          return cachedModule.exports;
        }
        var module = cache[moduleId] = {
          exports: {}
        };
        modules[moduleId](module, module.exports, require);
        return module.exports;
      }
      var exports = {};
      (() => {
        ${chunk.entryModule._source}
      })();
    })();
  `
}

/**
 *
 * @param {*} modulePath 拼接后的模块路径 c:/src/moduleA.js
 * @param {*} extensions ['.js', '.jsx', '.json']
 * @param {*} originModulePath ./moduleA
 * @param {*} moduleContext c:/src
 */
function tryExtensions(modulePath, extensions, originModulePath, moduleContext) {
  extensions.unshift('')
  for (let i = 0; i < extensions.length; i++) {
    if (fs.existsSync(modulePath + extensions[i])) {
      return modulePath + extensions[i]
    }
  }
  throw new Error(`Module not found: Cannot resolve '${originModulePath}' in '${moduleContext}'`)
}

module.exports = Compiler
