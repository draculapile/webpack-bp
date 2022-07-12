# `output.publicPath`

注意：

1. 需要安装 `html-loader` 以打包 `html` 中 `img` 标签 `src` 属性引入的图片
2. `publicPath` 仅仅是**将路径重写**，实际将资源打包到指定文件夹中还需要进一步配置：
   a. `css-loader` 处理 css 中 `url()` 引入的图片
   b. `MiniCssExtractPlugin` 将 css 从 js 中分离，抽成单独的 `.css` 文件

```js
// index.js 入口文件
import { hello } from './hello'
import './style.css'
console.log(hello())

// 这里请求了一个相对路径的图片，实际可以在控制台看到，打印地址也会被添加上 publicPath 中定义的前缀 /
const EVA = require('./eva.jpeg')
console.log(EVA)
```

```shell
npm run build

# demo 中配置的 publicPath 为 '/'，注意 http server 的启动路径
cd public-path

# 启动 http 服务
live-server
```

打包结果

```txt
dist
  ├── assets
  │   ├── eva.a6d071ca.jpeg
  │   └── main.css
  ├── index.html
  └── main.js
```
