#!/usr/bin/env node
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distIndexPath = path.join(rootDir, 'dist', 'index.html')

function parseDotEnv(filePath) {
  const result = {}
  if (!fs.existsSync(filePath)) return result
  const content = fs.readFileSync(filePath, 'utf-8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue
    const key = line.slice(0, eqIndex).trim()
    let val = line.slice(eqIndex + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }
  return result
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const dotEnv = parseDotEnv(path.join(rootDir, '.env'))
const apiBase = (process.env.API_BASE ?? dotEnv.API_BASE ?? '').trim()
const title = (process.env.TITLE ?? dotEnv.TITLE ?? '').trim()
const bgImage = (process.env.BACKGROUND_IMAGE ?? dotEnv.BACKGROUND_IMAGE ?? '').trim()
const cspApi = (process.env.CSP_API ?? dotEnv.CSP_API ?? '').trim()
const cspStatic = (process.env.CSP_STATIC ?? dotEnv.CSP_STATIC ?? '').trim()

execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' })

if (fs.existsSync(distIndexPath)) {
  let html = fs.readFileSync(distIndexPath, 'utf-8')

  if (apiBase) {
    html = html.replace(
      /<meta\s+name="apiBase"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="apiBase" content="${escapeAttr(apiBase)}" />`
    )
  }

  if (title) {
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeAttr(title)}</title>`)
    html = html.replace(
      '</head>',
      `  <meta name="siteTitle" content="${escapeAttr(title)}" />\n</head>`
    )
  }

  if (bgImage) {
    html = html.replace(
      '</head>',
      `  <style>body { background-image: url("${escapeAttr(bgImage)}"); background-size: cover; background-position: center; background-attachment: fixed; }</style>\n</head>`
    )
  }

  if (cspApi || cspStatic) {
    const connectExtra = cspApi ? ' ' + cspApi.split(',').map(s => s.trim()).filter(Boolean).join(' ') : ''
    const staticExtra = cspStatic ? ' ' + cspStatic.split(',').map(s => s.trim()).filter(Boolean).join(' ') : ''
    const cspContent = `default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${staticExtra}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com${staticExtra}; img-src 'self' data: https:${staticExtra}; font-src 'self' data: https://fonts.gstatic.com${staticExtra}; connect-src 'self' https://challenges.cloudflare.com${connectExtra}; frame-src https://challenges.cloudflare.com;`
    html = html.replace(
      '</head>',
      `  <meta http-equiv="Content-Security-Policy" content="${escapeAttr(cspContent)}" />\n</head>`
    )
  }

  fs.writeFileSync(distIndexPath, html, 'utf-8')
  console.log('Static runtime configuration injected into dist/index.html')
}
