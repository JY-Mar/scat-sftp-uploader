import os from 'os'
import fs from 'fs'
import chalk from 'chalk'
import { createLogUpdate } from 'log-update'
import archiver from 'archiver'
import { Client } from 'ssh2'
import type { ConnectConfig } from 'ssh2'
import WebDeployer from './type'

const pkgname = '@scat1995/deployer'

// ===================== 路径处理工具函数 =====================

/**
 * 标准化路径：替换反斜杠为斜杠，合并连续斜杠
 * @param p 路径字符串
 * @returns 标准化后的路径
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/')
}

/**
 * Windows 路径盘符大写（如 c:/ → C:/）
 * @param p 路径字符串
 * @returns 处理后的路径
 */
export function capitalizeWindowsDrive(p: string): string {
  if (/^[a-z]:\//.test(p)) {
    return p.charAt(0).toUpperCase() + p.slice(1)
  }
  return p
}

/**
 * 确保路径以斜杠结尾
 * @param p 路径字符串
 * @returns 以斜杠结尾的路径
 */
export function ensureTrailingSlash(p: string): string {
  return p.endsWith('/') ? p : p + '/'
}

/**
 * 移除路径末尾斜杠
 * @param p 路径字符串
 * @returns 无尾部斜杠的路径
 */
export function removeTrailingSlash(p: string): string {
  return p.replace(/\/$/, '')
}

/**
 * 判断字符串是否以斜杠结尾
 * @param p 路径字符串
 * @returns 是否以斜杠结尾
 */
export function isPathEndWithSlash(p?: string): boolean {
  return typeof p === 'string' && !!p && p.endsWith('/')
}

/**
 * 格式化耗时显示
 * @param ms 毫秒数
 * @returns 格式化后的耗时字符串
 */
export function formatCost(ms: number): string {
  if (ms > 1000) {
    return `${Math.ceil((ms * 100) / 1000) / 100}s`
  }
  return `${ms}ms`
}

/**
 * 日志的 chalk 包装
 * @param        {string} text
 * @param        {WebDeployer} type
 * @return       {*}
 */
export function colorful(text: string, type: WebDeployer.Consoler.MsgInputType = 'info'): string {
  let color = '#00ffff'
  switch (type) {
    case 'success':
      color = '#7fff58'
      break
    case 'warning':
      color = '#faad14'
      break
    case 'error':
      color = '#ff4d4f'
      break
    case 'link':
      color = '#1677ff'
      break
    case 'info':
      color = '#00ffff'
      break
    case 'tip':
      color = '#757575'
      break
    case 'emphasize':
      color = '#ff16e0'
      break
    case 'debug':
      color = '#ff5e00'
      break
    default:
      color = '#00ffff'
      break
  }
  return chalk.hex(color)(text)
}

/**
 * 日志包装后的文字
 * @param        {string} text
 * @param        {WebDeployer} type
 * @return       {*}
 */
export function colorfulWithTitle(text: string, type: WebDeployer.Consoler.MsgInputType = 'info'): string {
  let outputText: string = text
  let icon = ''

  switch (type) {
    case 'success':
      icon = '✅'
      break
    case 'warning':
      icon = '⚠️'
      break
    case 'error':
      icon = '‼️'
      break
    case 'link':
      icon = '🔗'
      break
    case 'info':
      icon = '🧾'
      break
    case 'tip':
      icon = '🍰'
      break
    case 'emphasize':
      icon = '✨'
      break
    case 'debug':
      icon = '🔧'
      break
    default:
      icon = type ? type : ' '
      break
  }
  const pkg = colorful(`[${pkgname} ${icon}]`, 'emphasize')
  outputText = `${pkg} ${outputText}`
  return colorful(outputText, type)
}

function _consolerOut(text: string, type: WebDeployer.Consoler.MsgType, eol: 'start' | 'end' | 'both' | 'none' = 'start'): void {
  let outputText: string = colorfulWithTitle(text, type)
  if (!outputText.startsWith(os.EOL) && eol === 'start') {
    outputText = os.EOL + outputText
  }
  if (outputText.endsWith(os.EOL) && (eol !== 'end' && eol !== 'both')) {
    outputText = outputText.slice(0, -os.EOL.length)
  }

  console.info(outputText)
}

/**
 * 打印日志
 * @param text 内容
 * @param type 类型
 */
export const consoler = Object.fromEntries(WebDeployer.Consoler.MSG_TYPES.map((type) => [type, (text: string, eol: 'start' | 'end' | 'both' | 'none' = 'start') => _consolerOut(text, type, eol)])) as WebDeployer.Consoler.Instance

/**
 * 进度条
 * @param description 命令行开头的文字信息
 * @param bar_length 进度条的长度(单位：字符)，默认设为 25
 * @param noprogress 是否隐藏进度条，默认不隐藏
 */
export function progbar(description: string = 'Progress', bar_length: number = 25, noprogress: boolean = false): WebDeployer.Progbar.Instance {
  process.stdout.isTTY = true // 强制开启终端模式

  // 两个基本参数(属性)
  const logger = createLogUpdate(process.stdout)

  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let index = 0

  const drawPercent = (completed: number, total: number, draw_noprogress: boolean = false, prefix: string = '') => {
    if (draw_noprogress || noprogress) {
      return ''
    }
    let percent: any = (completed / total).toFixed(4) // 计算进度(子任务的 完成数 除以 总数)
    let cell_num = Math.floor(percent * bar_length) // 计算需要多少个 █ 符号来拼凑图案 // 拼接黑色条
    let cell = ''
    // 拼接灰色条
    for (let i = 0; i < cell_num; i++) {
      cell += '█'
    }
    let empty = ''
    // 拼接最终文本
    for (let i = 0; i < bar_length - cell_num; i++) {
      empty += '░'
    }
    const processing = `${cell}${empty} ${(100 * percent).toFixed(2)}% (${completed}/${total})`
    return prefix + processing
  }

  return {
    update(options) {
      const processing = drawPercent(options.completed, options.total, noprogress, ': ')
      const spinchar = spinner[index % spinner.length]
      logger((index === 0 ? os.EOL : '') + colorful(colorfulWithTitle('', colorful(` ${spinchar}`, 'warning')) + `- ${description}${processing}`, 'link'))
      index++
    },

    pin(text) {
      if (text) {
        logger.persist(text)
      }
    },
    stop(text, type = 'success', keepOld = true, stop_noprogress = true) {
      if (text) {
        const finalIndex = index <= 0 ? 1 : index
        const processing = drawPercent(finalIndex, finalIndex, stop_noprogress || noprogress, ': ')
        if (keepOld) {
          logger.persist(colorful(colorfulWithTitle('', type) + `- ${text}${processing}`, type))
        } else {
          logger(colorful(colorfulWithTitle('', type) + `- ${text}${processing}`, type))
        }
      }
      logger.done()
    }
  }
}

/**
 * 创建本地压缩包
 * @param        {string} sourceDir 源目录
 * @param        {string} outputPath 输出压缩包路径
 * @param        {WebDeployer.ArchiveFormat} format 压缩格式
 * @return       {*}
 */
export async function createLocalArchive(sourceDir: string, outputPath: string, format: WebDeployer.ArchiveFormat): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath)
    const archive =
      format === 'zip'
        ? archiver('zip', { zlib: { level: 9 } })
        : archiver('tar', { gzip: true })

    output.on('close', () => resolve())
    archive.on('error', (err) => reject(err))
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        consoler.warning(`- 压缩警告: ${err.message}`)
      } else {
        reject(err)
      }
    })

    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

/**
 * 通过 SSH 执行远程命令
 * @param        {string} command 命令
 * @param        {ConnectConfig} sshConfig SSH 连接配置
 * @return       {*}
 */
export async function execRemoteCommand(command: string, sshConfig: ConnectConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    let stdout = ''
    let stderr = ''
    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end()
            reject(err)
            return
          }
          stream
            .on('close', (code: number, _signal: string) => {
              conn.end()
              if (code === 0) {
                resolve(stdout)
              } else {
                reject(new Error(`命令退出码: ${code}, 错误输出: ${stderr || stdout}`))
              }
            })
            .on('data', (data: Buffer) => {
              stdout += data.toString()
            })
            .stderr.on('data', (data: Buffer) => {
              stderr += data.toString()
            })
        })
      })
      .on('error', (err) => {
        reject(err)
      })
      .connect(sshConfig)
  })
}

/**
 * 检测远程服务器是否支持指定命令
 * @param        {string} command 命令名
 * @param        {ConnectConfig} sshConfig SSH 连接配置
 * @return       {*}
 */
export async function checkRemoteCommand(command: string, sshConfig: ConnectConfig): Promise<boolean> {
  try {
    await execRemoteCommand(`which ${command}`, sshConfig)
    return true
  } catch {
    return false
  }
}
