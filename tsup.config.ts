import { defineConfig, type Options } from 'tsup'

export default defineConfig(() => {
  const shared: Options = {
    /**
     * 入口
     */
    entry: ['src/index.ts'],
    /**
     * 输出目录
     */
    outDir: 'dist',
    /**
     * 输出文件扩展名
     */
    outExtension({ format }) {
      return {
        js: `.${format}.js`
      }
    },
    /**
     * 构建前清空 dist
     */
    clean: true,
    /**
     * 生成 sourcemap
     */
    sourcemap: false,
    /**
     * 压缩代码
     */
    minify: true
  }
  return [
    {
      ...shared,
      /**
       * 输出格式
       */
      format: ['cjs'],
      /**
       * 生成 .d.ts
       */
      dts: true
    },
    {
      ...shared,
      /**
       * 输出格式
       */
      format: ['esm'],
      /**
       * 保证只生成一份声明文件
       */
      dts: false
    }
  ]
})
