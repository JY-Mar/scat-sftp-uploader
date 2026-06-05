const fs = require('fs')
const path = require('path')

const ctsPath = path.resolve('dist/index.d.cts')
if (!fs.existsSync(ctsPath)) {
  console.warn('[rewritecjs] dist/index.d.cts not found, skip')
  process.exit(0)
}

let content = fs.readFileSync(ctsPath, 'utf-8')

// 1. 找出 default export 对应的变量名（export { ... X as default ... }）
const defaultExportMatch = content.match(/export\s*\{[^}]*?(\w+)\s+as\s+default[^}]*\}/)
if (!defaultExportMatch) {
  console.warn('[rewritecjs] no default export found, skip')
  process.exit(0)
}
const defaultName = defaultExportMatch[1]

// 2. 提取所有顶层的 declare const / declare class（不带缩进，区别于 namespace 内部）
const valueNames = []
const lines = content.split('\n')
for (const line of lines) {
  // 只匹配不以空格/制表符开头的行（排除 namespace 内部的 declare）
  if (/^\s/.test(line)) continue
  const match = line.match(/declare\s+(?:const|class)\s+(\w+)/)
  if (match) valueNames.push(match[1])
}

// 3. 过滤出 named exports（排除 default）
const namedNames = valueNames.filter((n) => n !== defaultName)

// 4. 移除 export { ... } 行
content = content.replace(/export\s*\{[^}]*\};?\s*/g, '')

// 5. 移除顶层的 type 别名行（CJS 运行时无值）
content = content.replace(/^type\s+\w+\s*=\s*[^;]+;\s*$/gm, '')

// 6. 生成 export = 声明，把所有 named exports 作为属性附加到 default 对象上
const namedProps = namedNames
  .map((n) => `  ${n}: typeof ${n};`)
  .join('\n')

const exportBlock = namedProps
  ? `
declare const _default: typeof ${defaultName} & {
  default: typeof ${defaultName};
${namedProps}
};
export = _default;
`
  : `
declare const _default: typeof ${defaultName};
export = _default;
`

content = content.trimEnd() + '\n' + exportBlock

fs.writeFileSync(ctsPath, content)
console.log('[rewritecjs] dist/index.d.cts rewritten successfully')
