/**
 * 统一路径分隔符
 * win: \
 * mac: /
 * @param {*} filePath
 * @returns \ => /
 */
function toUnixPath(filePath) {
  return filePath.replace(/\\/g, '/')
}

exports.toUnixPath = toUnixPath
