import os from 'os'
import fs from 'fs'
import path from 'path'
import { glob } from 'glob'
import SftpClient from 'ssh2-sftp-client'
import { consoler, progbar } from './utils'
import { type WebpackPluginInstance, createUnplugin } from 'unplugin'
import WebDeployer from './type'

const name = 'Deployer'

function unpluginFactory(options: WebDeployer.InputOptions): WebDeployer.OptionsForCreateUnplugin {
  const sftp = new SftpClient()
  let trim: any = null,
    isFirst: boolean = true, // 防止多次调用
    timer: number = 0

  const uploadConfig = {
    pkgDir: typeof options.dir === 'string' ? options.dir : '',
    sshPath: typeof options.url === 'string' ? options.url : '',
    previewPath: typeof options.previewPath === 'string' ? options.previewPath : '',
    delay: typeof options.delay === 'number' ? options.delay : 0,
    uploadFilter: options.uploadFilter && typeof options?.uploadFilter === 'function' ? options.uploadFilter : undefined,
    deleteFilter: options.deleteFilter && typeof options?.deleteFilter === 'function' ? options.deleteFilter : undefined
  }
  if (uploadConfig?.pkgDir) {
    uploadConfig.pkgDir = uploadConfig.pkgDir.replace(/\\/g, '/').replace(/\/+/g, '/')
    if (/^[a-z]:\//.test(uploadConfig.pkgDir)) {
      // 如果是 Windows 路径，将第一个字母（盘符）大写
      uploadConfig.pkgDir = uploadConfig.pkgDir.charAt(0).toUpperCase() + uploadConfig.pkgDir.slice(1)
    }
    if (!uploadConfig.pkgDir.endsWith('/')) {
      uploadConfig.pkgDir = uploadConfig.pkgDir + '/' // 如果本地目录没有以 / 结尾，自动加上，以与 sshPath 保持一致
    }
  }
  if (uploadConfig?.sshPath) {
    uploadConfig.sshPath = uploadConfig.sshPath.replace(/\\/g, '/').replace(/\/+/g, '/')
    if (!uploadConfig.sshPath.endsWith('/')) {
      uploadConfig.sshPath = uploadConfig.sshPath + '/' // 如果上传目录没有以 / 结尾，自动加上，否则找不到文件
    }
  }

  /**
   * SSH 连接配置
   */
  const sshConfig: SftpClient.ConnectOptions = {
    host: options.host, // 服务器地址
    port: Number(options.port ?? 22),
    username: options.username,
    password: options.password
  }

  // 判断环境，查看是否可以上传
  async function endHandler(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ARGV_DEPLOY = process.argv.some((_) => _.includes('deploy')) || false // 从命令中获取deploy
      // 低版本npm不支持
      // const IS_DEPLOY = process.env.npm_sshConfig_argv?.includes('deploy') || false // 读取命令判断

      const UPLOAD = !!process.env.UPLOAD // 手动设置UPLOAD
      if (ARGV_DEPLOY || UPLOAD) {
        clearTimeout(trim)
        trim = setTimeout(() => {
          if (isFirst) {
            // 开始上传逻辑
            startUpload()
              .then(() => {
                sftp.end()
                resolve()
              })
              .catch((err) => {
                sftp.end()
                consoler.error(`> 开始上传发生错误：${err}`)
                reject(err)
              })
          } else {
            sftp.end()
            consoler.error(`> 正在进行中，不可重复执行`)
            reject(`正在进行中，不可重复执行`)
          }
        }, uploadConfig.delay || 0)
      } else {
        sftp.end()
        consoler.error('> 未检测到上传指令，不执行此次上传')
        reject('未检测到上传指令，不执行此次上传')
      }
    })
  }

  /**
   * 开始上传逻辑
   * @return       {*}
   */
  async function startUpload(): Promise<void> {
    return new Promise((resolve, reject) => {
      isFirst = false
      // 自动上传到FTP服务器
      if (!uploadConfig.pkgDir) {
        sftp.end()
        consoler.error('> SSH 无法上传，请检查参数 dir')
        reject('SSH 无法上传，请检查参数 dir')
      } else {
        timer = Date.now()

        consoler.info(`> SSH 开始连接`)

        sftp
          .connect(sshConfig)
          .then(() => {
            // 连接服务器
            consoler.success('> SSH 连接成功')
            remakeDirAndExecUpload()
              .then(() => {
                sftp.end()
                resolve()
              })
              .catch((e) => {
                sftp.end()
                reject(e)
              })
          })
          .catch((err: string) => {
            sftp.end()
            consoler.error(`> SSH 连接失败：` + err)
            reject(err)
          })
      }
    })
  }

  /**
   * 删除服务器上目录并创建同名新目录
   * @return       {*}
   */
  async function remakeDirAndExecUpload(): Promise<void> {
    return new Promise((resolve, reject) => {
      const recursive = (callback: (...o: any[]) => any): void => {
        sftp
          .list(uploadConfig.sshPath)
          .then((files: any[]) => {
            // 过滤掉不需要删除的文件
            if (uploadConfig.deleteFilter && typeof uploadConfig.deleteFilter === 'function') {
              files = files.filter((x: any) => uploadConfig.deleteFilter(x))
            }
            removeRemoteFiles(files).then(() => {
              globFiles(uploadConfig.pkgDir).then((paths) => {
                const _paths = (paths || []).map((v) =>
                  String(v || '')
                    .replace(/\\/g, '/')
                    .replace(/\/+/g, '/')
                )
                if (_paths.length === 0) {
                  consoler.warning(`- 本地目录"${uploadConfig.pkgDir}"为空，无需上传`)
                  reject(`本地目录"${uploadConfig.pkgDir}"为空，无需上传`)
                } else {
                  coreUpload(_paths).then(() => {
                    resolve()
                  })
                }
              })
            })
          })
          .catch(() => {
            consoler.info(`- 远程目录"${sshConfig.host}:${sshConfig.port}${uploadConfig.sshPath}"未找到，尝试创建目录`)
            sftp
              .mkdir(uploadConfig.sshPath, true)
              .then((res: any) => {
                consoler.info(`- 远程目录"${sshConfig.host}:${sshConfig.port}${uploadConfig.sshPath}"创建成功`)
                recursive(callback)
              })
              .catch((err: string) => {
                consoler.error(`- Error：远程目录"${sshConfig.host}:${sshConfig.port}${uploadConfig.sshPath}"创建失败：${err}`)
                reject(`- Error：远程目录"${sshConfig.host}:${sshConfig.port}${uploadConfig.sshPath}"创建失败：${err}`)
              })
          })
      }
      recursive(recursive)
    })
  }

  /**
   * 删除服务器上文件(夹)
   * @description  resolve only
   * @param        {any} list
   * @return       {*}
   */
  async function removeRemoteFiles(list: any[]): Promise<void> {
    const total = list.length
    if (total > 0) {
      // 删除服务器上文件(夹)
      const processing = progbar('删除进度') // 上传进度条
      let i = 0
      const errors: string[] = []
      for (const fileInfo of list) {
        i++
        processing.update({ completed: i, total })
        const filepath = path.join(uploadConfig.sshPath, fileInfo.name).replace(/\\/g, '/').replace(/\/+/g, '/')
        try {
          if (fileInfo.type === '-') {
            await sftp.delete(filepath)
          } else {
            await sftp.rmdir(filepath, true)
          }
        } catch (err) {
          errors.push(`${fileInfo.type === '-' ? '文件' : '目录'} "${filepath}"：${err}`)
        }
      }

      if (!errors.length) {
        processing.stop('删除成功', 'success', true)
      } else if (errors.length === total) {
        processing.stop('删除失败', 'error')
      } else {
        processing.stop('删除完成', 'warning')
        consoler.info(`  共 ${errors.length} / ${total} 个失败：${errors.map((v) => `${os.EOL}        ${v}`).join('')}`)
      }
    }

    return Promise.resolve()
  }

  /**
   * 获取本地目录下所有文件(夹)的路径
   * @return       {*}
   */
  async function globFiles(dir: string, ignoreBase: boolean = false): Promise<string[]> {
    return new Promise((resolve) => {
      if (typeof dir !== 'string' || dir === '') {
        consoler.error(`- 本地目录路径参数不能为空`)
        resolve([])
        return
      }
      const pattern = `${dir}${dir.endsWith('/') ? '**' : '/**'}`.replace(/\\/g, '/').replace(/\/+/g, '/')
      // 获取本地路径所有文件
      glob(pattern, { ignore: ignoreBase ? ['.'] : undefined })
        .then((paths: string[]) => {
          // 本地目录下所有文件(夹)的路径
          if (uploadConfig.uploadFilter && typeof uploadConfig.uploadFilter === 'function') {
            paths = paths.filter((x: any) => uploadConfig.uploadFilter(x))
          }
          if (typeof paths === 'object' && paths instanceof Array && paths.length) {
            resolve(paths)
          } else {
            resolve([])
          }
        })
        .catch(() => {
          resolve([])
        })
    })
  }

  /**
   * 上传文件（核心逻辑）
   * @description  resolve only
   * @param        {string} files
   * @return       {*}
   */
  async function coreUpload(files: string[]): Promise<void> {
    // 传输文件到服务器

    const total: number = files.length
    if (total > 0) {
      const processing = progbar('上传进度') // 上传进度条
      let i = 0
      processing.update({ completed: i, total })

      for (let localSrc of files) {
        i++
        localSrc = path.resolve(localSrc).replace(/\\/g, '/').replace(/\/+/g, '/') // 获取完整路径
        if (/^[a-z]:\//.test(localSrc)) {
          // 与 uploadConfig.pkgDir 路径格式一致，将第一个字母（盘符）大写
          localSrc = localSrc.charAt(0).toUpperCase() + localSrc.slice(1)
        }
        if (!localSrc.endsWith('/')) {
          localSrc = localSrc + '/'
        }
        if (!localSrc.startsWith(uploadConfig.pkgDir)) {
          continue
        }
        if (total === 1 && fs.lstatSync(localSrc).isDirectory()) {
          const filepaths = await globFiles(localSrc, true)
          if (!filepaths.length) {
            continue
          }
        }
        let targetSrc = localSrc.replace(uploadConfig.pkgDir, uploadConfig.sshPath)
        targetSrc = targetSrc.replace(/\\/g, '/').replace(/\/+/g, '/')
        if (!targetSrc.endsWith('/')) {
          targetSrc = targetSrc + '/'
        }
        try {
          if (fs.lstatSync(localSrc).isDirectory()) {
            // 是目录
            // consoler.info(`- 上传目录: ${localSrc} → ${targetSrc}`)
            await sftp.mkdir(targetSrc, true)
          } else {
            const isEnd = (path?: string) => {
              return typeof path === 'string' && path && path.endsWith('/')
            }
            const recursive = () => {
              const localSrcIsEnd = isEnd(localSrc)
              const targetSrcIsEnd = isEnd(targetSrc)
              if (localSrcIsEnd) {
                // 文件，必须去掉 localSrc 最后一个斜杠
                localSrc = localSrc.substring(0, localSrc.length - 1)
              }
              if (targetSrcIsEnd) {
                // 文件，必须去掉 targetSrc 最后一个斜杠
                targetSrc = targetSrc.substring(0, targetSrc.length - 1)
              }
              if (localSrcIsEnd || targetSrcIsEnd) {
                recursive()
              } else {
                return Promise.resolve()
              }
            }
            await recursive()
            // consoler.info(`- 上传文件: ${localSrc} → ${targetSrc}`)
            await sftp.put(localSrc, targetSrc)
          }
        } catch (_) {
          // 上传失败
        } finally {
          processing.update({ completed: i, total })
        }
      }
      processing.stop('上传成功', 'success')

      const cost = Date.now() - timer
      if (cost > 1000) {
        consoler.info(`- 上传耗时: ${Math.ceil((cost * 100) / 1000) / 100}s`)
      } else {
        consoler.info(`- 上传耗时: ${cost}ms`)
      }
      if (uploadConfig.previewPath) {
        consoler.link(`- 预览地址: ${uploadConfig.previewPath}`)
      }
    } else {
      consoler.error(`- 上传失败，没有文件需要上传`)
    }

    return Promise.resolve()
  }

  return {
    name,
    // @ts-ignore
    execute: startUpload,
    async writeBundle() {
      // 判断 Vue CLI 的多编译器模式
      if (process.env.VUE_CLI_MODERN_MODE && !process.env.VUE_CLI_MODERN_BUILD) {
        // !!! 跳过 !!! Modern Mode 第一轮 (Legacy Bundle)：生成兼容旧浏览器的 JS 文件
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 737))
      try {
        await endHandler()
      } catch (err) {
        sftp.end()
        consoler.error(`- ${name} Error：SSH 上传发生错误：${err}`)
      }
    }
  }
}

const Instance: WebDeployer.Instance = {
  ...createUnplugin(unpluginFactory as any),
  exec: (options) => unpluginFactory(options).execute()
}
const RollupPluginDeployer = Instance.rollup
const VitePluginDeployer = Instance.vite
class DeployerWebpackPlugin {
  private instance: WebpackPluginInstance
  constructor(options?: WebDeployer.InputOptions) {
    this.instance = Instance.webpack(options)
  }
  apply(compiler: any): void {
    this.instance.apply(compiler)
  }
}
type DeployerInputOptions = WebDeployer.InputOptions

export { Instance as default, RollupPluginDeployer, VitePluginDeployer, DeployerWebpackPlugin, DeployerInputOptions }
