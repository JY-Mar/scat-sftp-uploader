import os from 'os'
import chalk from 'chalk'
import { createLogUpdate } from 'log-update'
import WebDeployer from './type'

const pkgname = '@scat1995/deployer'

/**
 * 日志的 chalk 包装
 * @param        {string} text
 * @param        {WebDeployer} type
 * @return       {*}
 */
export function colorful(text: string, type: WebDeployer.Consoler.MsgType = 'info'): string {
  let color = '#00ffff'
  switch (type) {
    case 'success':
      color = '#52c414'
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
export function colorfulWithTitle(text: string, type: WebDeployer.Consoler.MsgType = 'info'): string {
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
    default:
      icon = type ? type : ' '
      break
  }
  const pkg = colorful(`[${pkgname} ${icon}]`, 'emphasize')
  outputText = `${pkg} ${outputText}`
  return colorful(outputText, type)
}

/**
 * 打印日志
 * @param text 内容
 * @param type 类型
 */
export function consoler(text: string, type: WebDeployer.Consoler.MsgType = 'info'): void {
  let outputText: string = colorfulWithTitle(text, type)
  if (!outputText.startsWith(os.EOL)) {
    outputText = os.EOL + outputText
  }
  if (outputText.endsWith(os.EOL)) {
    outputText = outputText.slice(0, -os.EOL.length)
  }
  console.info(outputText)
}

/**
 * 进度条
 * @param description 命令行开头的文字信息
 * @param bar_length 进度条的长度(单位：字符)，默认设为 25
 */
function progbar(description: string = 'Progress', bar_length: number = 25): WebDeployer.Progbar.Instance {
  process.stdout.isTTY = true;    // 强制开启终端模式

  // 两个基本参数(属性)
  const logger = createLogUpdate(process.stdout)

  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let index = 0

  return {
    update(options) {
      let percent: any = (options.completed / options.total).toFixed(4) // 计算进度(子任务的 完成数 除以 总数)
      let cell_num = Math.floor(percent * bar_length) // 计算需要多少个 █ 符号来拼凑图案 // 拼接黑色条
      let cell = ''
      for (let i = 0; i < cell_num; i++) {
        cell += '█'
      } // 拼接灰色条
      let empty = ''
      for (let i = 0; i < bar_length - cell_num; i++) {
        empty += '░'
      } // 拼接最终文本
      const spinchar = spinner[index % spinner.length]
      const processing = `${cell}${empty} ${(100 * percent).toFixed(2)}% (${options.completed}/${options.total})`
      logger((index === 0 ? os.EOL : '') + colorful(colorfulWithTitle('', colorful(` ${spinchar}`, 'warning')) + `- ${description}: ${processing}`, 'link'))
      index++
    },

    pin(text) {
      if (text) {
        logger.persist(text)
      }
    },
    stop(text, type = 'success', keepOld = true) {
      if (text) {
        if (keepOld) {
          logger.persist(colorful(colorfulWithTitle('') + `- ${text}`, type))
        } else {
          logger(colorful(colorfulWithTitle('') + `- ${text}`, type))
        }
      }
      logger.done()
    }
  }
}

export { progbar }
