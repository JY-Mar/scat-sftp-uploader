export interface PointLog {
  (text: string, type?: string): void
}
export interface ProgressBar {
  (description: string, bar_length?: number): Function
}
export interface ProgressOpt {
  completed: number
  total: number
}

export interface SftpUploaderOptions {
  /**
   * 需要上传文件的目录
   */
  dir: string
  /**
   * 上传到（远程服务器）的目录
   */
  url: string
  /**
   * sftp 地址
   */
  host: string
  /**
   * sftp 端口，默认 22
   */
  port?: number | string
  /**
   * 账号
   */
  username: string
  /**
   * 密码
   */
  password: string
  /**
   * 上传文件过滤器
   * @description 可以过滤掉不需要的文件，返回false将不会上传该文件（可选）
   */
  uploadFilter: Function
  /**
   * 删除文件过滤器
   * @description 可以过滤掉不需要删除的文件，返回false将不会删除该文件（可选）
   */
  deleteFilter: Function
  /**
   * 延迟上传时间（毫秒），默认 0
   * @description 解决部分项目会触发多次打包完成的问题
   */
  delay?: number
  /**
   * 预览链接接地址（可选）
   */
  previewPath?: string
}
