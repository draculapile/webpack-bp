var transform = require('babel-core').transform
var ES6Code = 'const plus = (a, b) => a + b'

var ES5Code = transform(ES6Code, {
  // 放开下面注释，查看打印效果
  // plugins: ['transform-es2015-arrow-functions']
}).code

console.log(ES5Code)
