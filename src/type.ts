import type { UnpluginInstance, UnpluginOptions } from 'unplugin'

namespace WebDeployer {
  /**
   * Progress bar
   */
  export namespace Progbar {
    /**
     * Progress bar instance
     */
    export interface Instance {
      /**
       * Update progress bar processing
       * @param options Update Options
       */
      update(options: UpdateOptions): void
      /**
       * Pin information to the terminal
       * @param text 内容
       */
      pin(text?: string): void
      /**
       * Stop updating progress bar processing
       * @param text Text to display before stopping
       */
      stop(text?: string, type?: Consoler.MsgType, keepOld?: boolean): void
    }
    /**
     * Progress bar update options
     */
    export interface UpdateOptions {
      completed: number
      total: number
    }
  }

  /**
   * Input Deployer Options
   */
  export interface InputOptions {
    /**
     * 待上传的（本地）目录
     *
     * Local directory to be uploaded
     */
    dir: string
    /**
     * 需上传至的（远程服务器）目录
     *
     * Remote Server directory to upload to
     */
    url: string
    /**
     * （远程服务器） 地址
     *
     * Remote Server Address
     */
    host: string
    /**
     * （远程服务器） 端口
     *
     * Remote Server Port
     * @default 22
     */
    port?: number | string
    /**
     * （远程服务器）登录用户名
     *
     * Remote Server Login username
     */
    username: string
    /**
     * （远程服务器）登录密码
     *
     * Remote Server Login password
     */
    password: string
    /**
     * 上传文件过滤器（可选）
     *
     * File filter for uploading
     * @description Filter files to be uploaded. Returning `false` will skip the upload for that file. (Optional)
     */
    uploadFilter?: Function
    /**
     * 删除文件过滤器（可选）
     *
     * File filter for the files that do not need to be deleted
     * @description Filter files to be deleted. Returning `false` will prevent the file from being deleted. (Optional)
     */
    deleteFilter?: Function
    /**
     * 延迟上传时间（毫秒）
     *
     * Delay the start of the upload (in milliseconds)
     * @default 0
     * @description Resolve the issue where some projects trigger multiple build completion events.
     */
    delay?: number
    /**
     * 预览链接地址（可选）
     *
     * Preview URL (Optional)
     */
    previewPath?: string
  }

  /**
   * Options for create unplugin
   */
  export type OptionsForCreateUnplugin = UnpluginOptions & { execute: () => Promise<void> }

  /**
   * External Executable Function
   */
  export type Exec = (Options: InputOptions) => any

  /**
   * Console
   */
  export namespace Consoler {
    /**
     * Console output type
     */
    export type MsgType = 'success' | 'warning' | 'error' | 'link' | 'info' | 'tip' | 'emphasize' | (string & Record<never, never>)
  }

  /**
   * Instance of WebDeployer
   */
  export type Instance = Pick<UnpluginInstance<InputOptions, boolean>, 'rollup' | 'webpack'> & {
    vite: UnpluginInstance<InputOptions, boolean>['rollup']
    exec: Exec
  }
}

export default WebDeployer
