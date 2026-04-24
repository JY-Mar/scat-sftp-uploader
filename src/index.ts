import os from 'os'
import fs from 'fs'
import path from 'path'
import glob from 'glob'
import SftpClient from 'ssh2-sftp-client'
import { consoler, progbar } from './utils'
import { type UnpluginInstance, type UnpluginOptions, type WebpackPluginInstance, createUnplugin } from 'unplugin'
import WebDeployer from './type'

const name = 'Deployer'

function unpluginFactory(options: WebDeployer.InputOptions): UnpluginOptions & { execute: WebDeployer.InternalExecute } {
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
    port: Number(options.port || 22),
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
                exError(`开始上传发生错误：${err}`)
                reject(err)
              })
          } else {
            exError(`${name} 正在进行中，不可重复执行`)
            reject(`${name} 正在进行中，不可重复执行`)
          }
        }, uploadConfig.delay || 0)
      } else {
        exError('未检测到上传指令，不执行此次上传')
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
        exError('> 无法上传 SSH ，请检查参数 dir')
        reject('无法上传 SSH ，请检查参数 dir')
      } else {
        timer = Date.now()

        consoler(`> SSH 开始连接`)

        sftp
          .connect(sshConfig)
          .then(() => {
            // 连接服务器
            consoler('> SSH 连接成功', 'success')
            remakeDirAndExecUpload().then(() => {
              sftp.end()
              resolve()
            })
          })
          .catch((err: string) => {
            exError('> SSH 连接失败' + err)
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
      sftp
        .list(uploadConfig.sshPath)
        .then((files: any[]) => {
          // 过滤掉不需要删除的文件
          if (uploadConfig.deleteFilter && typeof uploadConfig.deleteFilter === 'function') {
            files = files.filter((x: any) => uploadConfig.deleteFilter(x))
          }
          removeRemoteFiles(files).then(() => {
            getAllFilepathsInLocalDir().then((paths) => {
              if (paths.length === 0) {
                resolve()
              } else {
                coreUpload(paths).then(() => {
                  resolve()
                })
              }
            })
          })
        })
        .catch(() => {
          consoler('- 找不到文件夹：' + uploadConfig.sshPath + '，尝试创建文件夹')
          sftp
            .mkdir(uploadConfig.sshPath, true)
            .then((res: any) => {
              consoler(`- ${uploadConfig.sshPath}文件夹创建成功`)
              remakeDirAndExecUpload()
            })
            .catch((err: string) => {
              exError('- 文件夹创建失败 ' + err)
              reject(err)
            })
        })
    })
  }

  /**
   * 删除服务器上文件(夹)
   * @param        {any} list
   * @return       {*}
   */
  async function removeRemoteFiles(list: any[]): Promise<void> {
    const total = list.length
    if (total > 0) {
      // 删除服务器上文件(夹)
      const processing = progbar('删除中') // 上传进度条
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
          errors.push(`${fileInfo.type === '-' ? '文件' : '文件夹'} "${filepath}"：${err}`)
        }
      }


      if (!errors.length) {
        processing.stop('删除成功', 'success')
      } else if (errors.length === total) {
        processing.stop('删除失败', 'error')
      } else {
        processing.stop('删除完成', 'warning')
        consoler(`  共 ${errors.length} / ${total} 个失败：${errors.map((v) => `${os.EOL}        ${v}`).join('')}`, 'error')
      }
    }

    return new Promise((resovle) => {
      resovle()
    })
  }

  /**
   * 获取本地目录下所有文件(夹)的路径
   * @return       {*}
   */
  async function getAllFilepathsInLocalDir(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const localDir = `${uploadConfig.pkgDir}${uploadConfig.pkgDir.endsWith('/') ? '**' : '/**'}`.replace(/\\/g, '/').replace(/\/+/g, '/')
      // 获取本地路径所有文件
      glob(localDir, (err: any, paths: string[]) => {
        // 本地目录下所有文件(夹)的路径
        // files.splice(0, 1) // 删除路径../dist/
        if (uploadConfig.uploadFilter && typeof uploadConfig.uploadFilter === 'function') {
          paths = paths.filter((x: any) => uploadConfig.uploadFilter(x))
        }
        if (typeof paths === 'object' && paths instanceof Array && paths.length) {
          resolve(paths)
        } else {
          reject('本地目录下未找到文件或文件夹')
        }
      })
    })
  }

  /**
   * 上传文件（核心逻辑）
   * @param        {string} files
   * @return       {*}
   */
  async function coreUpload(files: string[]): Promise<void> {
    // 传输文件到服务器

    const total: number = files.length
    if (total > 0) {
      const processing = progbar('上传中') // 上传进度条
      let i = 0
      for (let localSrc of files) {
        i++
        localSrc = path.resolve(localSrc).replace(/\\/g, '/').replace(/\/+/g, '/') // 获取完整路径
        let targetSrc = localSrc.replace(uploadConfig.pkgDir, uploadConfig.sshPath)
        targetSrc = targetSrc.replace(/\\/g, '/').replace(/\/+/g, '/')
        processing.update({ completed: i, total })
        try {
          if (fs.lstatSync(localSrc).isDirectory()) {
            // 是文件夹
            await sftp.mkdir(targetSrc)
          } else {
            await sftp.put(localSrc, targetSrc)
          }
        } catch (_) {
          // 上传失败
        }
      }
      processing.stop('上传成功', 'success')

      const cost = Date.now() - timer
      if (cost > 1000) {
        consoler(`- 耗时: ${Math.ceil(cost * 100 / 1000) / 100}s`)
      } else {
        consoler(`- 耗时: ${cost}ms`)
      }
      if (uploadConfig.previewPath) {
        consoler(`- 预览地址: ${uploadConfig.previewPath}`, 'link')
      }
    } else {
      consoler(`- 上传失败，没有文件需要上传`, 'error')
    }

    return new Promise((resovle) => {
      resovle()
    })
  }

  function exError(err: string) {
    sftp.end()
    consoler(`- ${name} Error:${err}`, 'error')
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
      await new Promise(resolve => setTimeout(resolve, 737));
      try {
        await endHandler()
      } catch (err) {
        exError(`- SSH 上传发生错误：${err}`)
      }
    }
  }
}

const Deployer = {
  ...createUnplugin(unpluginFactory as any),
  exec: (options) => unpluginFactory(options).execute()
} as Pick<UnpluginInstance<WebDeployer.InputOptions, boolean>, 'rollup' | 'webpack'> & {
  vite: UnpluginInstance<WebDeployer.InputOptions, boolean>['rollup']
  exec: WebDeployer.Exec
}

export default Deployer
export const RollupPluginDeployer = Deployer.rollup
export const VitePluginDeployer = Deployer.vite
export class DeployerWebpackPlugin {
  private instance: WebpackPluginInstance
  constructor(options?: WebDeployer.InputOptions) {
    this.instance = Deployer.webpack(options)
  }
  apply(compiler: any): void {
    this.instance.apply(compiler)
  }
}
