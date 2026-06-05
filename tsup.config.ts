import { defineConfig, type Options } from 'tsup'

export default defineConfig(() => {
  const entry = ['src/index.ts']
  const shared: Options = {
    entry,
    outDir: 'dist',
    clean: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: ['log']
      },
      mangle: {
        eval: true,
        toplevel: true
      },
      format: {
        comments: false
      }
    },
    external: ['fs', 'path', 'os', 'process', 'unplugin', 'ssh2-sftp-client', 'ssh2', '@scat1995/archiver']
  }
  return [
    {
      ...shared,
      format: ['esm'],
      dts: {
        bundle: true,
        entry,
        out: 'index.d.ts'
      }
    },
    {
      ...shared,
      format: ['cjs'],
      dts: {
        bundle: false,
        entry,
        out: 'index.d.cts'
      },
      footer: {
        js: 'try{var d=module.exports.default;if(d){Object.keys(d).forEach(function(k){if(!(k in module.exports))module.exports[k]=d[k]});module.exports=Object.assign(d,module.exports)}}catch(e){}'
      }
    }
  ]
})
