function myLoader(source) {
  console.log('my-loader')
  // 模拟源码被修改
  return source + '//myLoader'
}

module.exports = myLoader
