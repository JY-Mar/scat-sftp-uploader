import WebDeployer from './type'

export const DEFAULT_OPTIONS: Pick<WebDeployer.InputOptions, 'mode' | 'archiveFormat' | 'removeRemoteArchive' | 'delay' | 'port'> = {
  port: 22,
  delay: 0,
  mode: 'archive',
  archiveFormat: 'tgz',
  removeRemoteArchive: true
}
