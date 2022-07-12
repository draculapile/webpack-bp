class MyPlugin {
  apply(compiler) {
    // register run hook
    compiler.hooks.run.tap('MyPlugin', () => {
      console.log('MyPlugin run')
    })
    console.log('my-plugin')
  }
}

module.exports = MyPlugin
