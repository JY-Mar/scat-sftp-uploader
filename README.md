# @scat1995/deployer

> `@scat1995/deployer` 是一款基于 `ssh2-sftp-client`、`ssh2`、`@scat1995/archiver` 封装的文件上传插件，支持 `webpack`、 `vite` 及 `rollup`，可以实现将打包好的项目文件一键上传到指定的sftp服务器目录，支持集成为`webpack`、 `vite` 或 `rollup` 插件或`单独`使用，支持自动创建上传目录。

## Install

![NPM](https://nodei.co/npm/@scat1995/deployer.png)

```sh
yarn add @scat1995/deployer --save-dev
npm install @scat1995/deployer --save-dev
```

## Configuration

### Basic

```javascript
{
  dir: path.join(__dirname, 'dist/'), // 需要上传文件的目录
  url: '******', // 上传到的目录
  host: '*****', // sftp地址
  port: '*****', // sftp端口
  username: '*****', // 账号
  password: '*****', // 密码
  // 延迟上传时间（毫秒），解决部分项目会触发多次打包完成的问题
  delay: 0,
  // 上传文件过滤器，可以过滤掉不需要的文件，返回false将不会上传该文件（可选）
  uploadFilter(file) => file.name.endsWith(.gz),
  // 删除文件过滤器，可以过滤掉不需要删除的文件，返回false将不会删除该文件（可选）
  deleteFilter(file) => file.name.endsWith(.gz),
  // 预览链接接地址（可选）
  previewPath: 'https://www.baidu.com'
}
```

### Advanced: Upload Mode (For 2.0.0+)

#### 'archiver' Mode

Will package the local directory into a compressed archive and upload as a single file, then extract on the remote server (fast, low bandwidth)

```javascript
{
  ...
  mode: 'archiver',
  archiveFormat: 'tar',
  removeRemoteArchive: true
  ...
}
```

#### 'sftp' Mode

Will upload individual files one by one via SFTP (original behavior)

```javascript
{
  ...
  mode: 'sftp'
  ...
}
```

## Usage

### package.json

```json
{
  // package.json
  // 1. window
  "scripts": {
    "build": "vue-cli-service build --mode development",
    "deploy": "set UPLOAD=true && yarn build"
  },
  // 2. liunx or macos
  "scripts": {
    "build": "vue-cli-service build --mode development",
    "deploy": "export UPLOAD=true && yarn build"
  }
}
```

### Webpack

```javascript
// vue.config.js
const DeployerWebpackPlugin = require('@scat1995/deployer')

module.exports = {
  configureWebpack: config => {
    return {
      plugins: [
        new DeployerWebpackPlugin({ ... })
      ]
    }
  }
}
```

### Vite

```javascript
//vite.config.js
import VitePluginDeployer from '@scat1995/deployer'

export default defineConfig({
  plugins: [
    VitePluginDeployer({ ... })
  ]
})
```

### NodeJs

```javascript
// 1. 在项目中创建uploader.js
// 2、配置和webpack插件模式相同

// For 1.0.0 ~ 2.0.0
const Deployer = require('@scat1995/deployer').default
// For 2.1.0
const Deployer = require('@scat1995/deployer')
Deployer.exec({ ... })
// 然后在项目根目录终端下运行如下命令
node uploader.js
```
