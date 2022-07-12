#!/usr/bin/env node

/**
 * 执行命令的函数，接受一个命令和一个参数数组
 * @param {string} command process to run
 * @param {string[]} args command line arguments
 * @returns {Promise<void>} promise
 */
const runCommand = (command, args) => {
  // 开启子进程
  const cp = require('child_process')
  return new Promise((resolve, reject) => {
    const executedCommand = cp.spawn(command, args, {
      stdio: 'inherit',
      shell: true
    })

    executedCommand.on('error', (error) => {
      reject(error)
    })

    executedCommand.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject()
      }
    })
  })
}

/**
 * 查询包是否安装
 * @param {string} packageName name of the package
 * @returns {boolean} is the package installed?
 */
const isInstalled = (packageName) => {
  // 如果使用的是 Yarn 的 Plug'n'Play 机制，即 pnp 模式，Yarn 不会创建 node_modules 目录
  // 取而代之的是一个 .pnp.js 文件，包含了项目的依赖树信息，模块查找算法，也包含了模块查找器的 patch 代码
  // create-react-app 已经集成了 pnp
  // https://yarnpkg.com/advanced/pnpapi
  if (process.versions.pnp) {
    return true
  }

  // 从 node_modules 里查找是否安装包

  const path = require('path')
  const fs = require('graceful-fs')

  let dir = __dirname

  do {
    try {
      if (fs.statSync(path.join(dir, 'node_modules', packageName)).isDirectory()) {
        return true
      }
    } catch (_error) {
      // Nothing
    }
  } while (dir !== (dir = path.dirname(dir)))

  return false
}

/**
 * @param {CliOption} cli options
 * @returns {void}
 */
const runCli = (cli) => {
  const path = require('path')
  const pkgPath = require.resolve(`${cli.package}/package.json`)
  // eslint-disable-next-line node/no-missing-require
  const pkg = require(pkgPath)
  // eslint-disable-next-line node/no-missing-require

  // 使用 require 加载 cli 包并执行
  require(path.resolve(path.dirname(pkgPath), pkg.bin[cli.binName]))
}

/**
 * @typedef {Object} CliOption
 * @property {string} name display name
 * @property {string} package npm package name
 * @property {string} binName name of the executable file
 * @property {boolean} installed currently installed?
 * @property {string} url homepage
 */

/** @type {CliOption} */
const cli = {
  name: 'webpack-cli',
  package: 'webpack-cli',
  binName: 'webpack-cli',
  installed: isInstalled('webpack-cli'),
  url: 'https://github.com/webpack/webpack-cli'
}

// 检查到未安装 cli，提醒安装，且提供快捷安装的询问
if (!cli.installed) {
  const path = require('path')
  const fs = require('graceful-fs')
  const readLine = require('readline')

  const notify = 'CLI for webpack must be installed.\n' + `  ${cli.name} (${cli.url})\n`

  console.error(notify)

  let packageManager

  if (fs.existsSync(path.resolve(process.cwd(), 'yarn.lock'))) {
    packageManager = 'yarn'
  } else if (fs.existsSync(path.resolve(process.cwd(), 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm'
  } else {
    packageManager = 'npm'
  }

  const installOptions = [packageManager === 'yarn' ? 'add' : 'install', '-D']

  console.error(
    `We will use "${packageManager}" to install the CLI via "${packageManager} ${installOptions.join(
      ' '
    )} ${cli.package}".`
  )

  const question = `Do you want to install 'webpack-cli' (yes/no): `

  const questionInterface = readLine.createInterface({
    input: process.stdin,
    output: process.stderr
  })

  // In certain scenarios (e.g. when STDIN is not in terminal mode), the callback function will not be
  // executed. Setting the exit code here to ensure the script exits correctly in those cases. The callback
  // function is responsible for clearing the exit code if the user wishes to install webpack-cli.
  process.exitCode = 1
  questionInterface.question(question, (answer) => {
    questionInterface.close()

    const normalizedAnswer = answer.toLowerCase().startsWith('y')

    if (!normalizedAnswer) {
      console.error(
        "You need to install 'webpack-cli' to use webpack via CLI.\n" +
          'You can also install the CLI manually.'
      )

      return
    }
    process.exitCode = 0

    console.log(
      `Installing '${cli.package}' (running '${packageManager} ${installOptions.join(' ')} ${
        cli.package
      }')...`
    )

    runCommand(packageManager, installOptions.concat(cli.package))
      .then(() => {
        runCli(cli)
      })
      .catch((error) => {
        console.error(error)
        process.exitCode = 1
      })
  })
} else {
  runCli(cli)
}
