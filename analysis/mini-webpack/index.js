const Compiler = require('./Compiler')

function webpack(options) {
  let shellOptions = process.argv.slice(2).reduce((config, args) => {
    let [key, value] = args.split('=')
    config[key.slice(2)] = value
    return config
  }, {})
  const finalOptions = Object.assign({}, options, shellOptions)
  let compiler = new Compiler(finalOptions)
  if (finalOptions.plugins && Array.isArray(finalOptions.plugins)) {
    for (const plugin of options.plugins) {
      // 加载所有配置的插件
      plugin.apply(compiler)
    }
  }
  return compiler
}

module.exports = webpack
