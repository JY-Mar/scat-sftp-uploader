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
      stop(text?: string, msgType?: Consoler.MsgInputType, keepOld?: boolean, stop_noprogress?: boolean): void
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
    /**
     * 上传模式
     *
     * Upload mode
     * @default 'archive'
     * @description `'archive'` — package the local directory into a compressed archive and upload as a single file, then extract on the remote server (fast, low bandwidth). `'sftp'` — upload individual files one by one via SFTP (original behavior).
     */
    mode?: UploadMode
    /**
     * 压缩包格式（mode='archive' 时生效）
     *
     * Archive format (effective when mode='archive')
     * @default 'tgz'
     * @description `'tgz'` uses tar.gz format, relying on the `tar` command on the remote server. `'zip'` uses zip format, the server must have the `unzip` command installed; a capability check will be performed before compression.
     */
    archiveFormat?: ArchiveFormat
    /**
     * 是否删除远程压缩包（mode='archive' 时生效）
     *
     * Whether to delete the remote archive after extraction (effective when mode='archive')
     * @default true
     */
    removeRemoteArchive?: boolean
  }

  /**
   * Upload mode
   */
  export type UploadMode = 'archive' | 'sftp'

  /**
   * Archive format
   */
  export type ArchiveFormat = 'zip' | 'tgz'

  /**
   * Options for create unplugin
   */
  export type OptionsForCreateUnplugin = UnpluginOptions & { execute: Execute }

  /**
   * Internal Execute function
   * @return       {Promise<void>}
   */
  export type Execute = () => Promise<void>

  /**
   * Console
   */
  export namespace Consoler {
    /**
     * All Console output types
     */
    export const MSG_TYPES = ['success', 'warn', 'warning', 'error', 'link', 'info', 'tip', 'emphasize', 'debug'] as const
    /**
     * Console output type
     */
    export type MsgType = (typeof MSG_TYPES)[number]
    /**
     * Console output type
     */
    export type MsgInputType = MsgType | (string & Record<never, never>)
    /**
     * Console instance
     */
    export type Instance = {
      [K in MsgType]: (text: string, eol?: 'start' | 'end' | 'both' | 'none') => void
    }
  }

  /**
   * Instance of WebDeployer
   */
  export type Instance = Pick<UnpluginInstance<InputOptions, boolean>, 'rollup' | 'webpack'> & {
    vite: UnpluginInstance<InputOptions, boolean>['rollup']
    /**
     * External Executable Function
     * @param        {InputOptions} options Input Archiver Options
     * @return       {*}
     */
    exec: (options: InputOptions) => Promise<void>
  }
}

export default WebDeployer
