'use strict'

const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const path = require('path')

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
    publicPath: '/'
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      },
      {
        test: /\.(png|jpe?g|gif|svg|eot|ttf|woff)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name].[hash:8][ext]'
        }
      },
      {
        test: /\.html/i,
        use: 'html-loader'
      }
    ]
  },
  plugins: [
    // 将 main.js 添加到 html 文件
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './src/index.html')
    }),
    new MiniCssExtractPlugin({
      filename: 'assets/[name].css'
    })
  ]
}
