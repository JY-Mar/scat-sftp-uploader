import chalk from 'chalk'
import { stdout } from 'single-line-log'
import WebDeployer from './type'

/**
 * 打印日志
 * @param text 内容
 * @param type 类型
 */
const consoler: WebDeployer.Consoler = (text, type = 'info') => {
  let outputText: string = text

  switch (type) {
    case 'success':
      outputText = chalk.green(outputText)
      break
    case 'warning':
      outputText = chalk.yellow(outputText)
      break
    case 'error':
      outputText = chalk.red(outputText)
      break
    case 'link':
      outputText = chalk.blue(outputText)
      break
    case 'info':
      outputText = chalk.cyanBright(outputText)
      break
    default:
      outputText = chalk.cyanBright(outputText)
  }

  console.info(outputText)
}

/**
 * 进度条
 * @param description 命令行开头的文字信息
 * @param bar_length 进度条的长度(单位：字符)，默认设为 25
 */
const progbar: WebDeployer.Progbar = (description = '进度', bar_length = 25) => {
  // 两个基本参数(属性)
  return {
    update(options: WebDeployer.ProgbarOptions) {
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
      let cmdText = `  - ${description}: ${cell}${empty} ${(100 * percent).toFixed(2)}% (${options.completed}/${options.total})` // 在单行输出文本
      stdout(cmdText)
    },
    destory() {
      stdout.clear()
    }
  }
}

export { consoler, progbar }
