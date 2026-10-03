import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

const virtualPython = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python'
const python = existsSync(virtualPython) ? virtualPython : process.platform === 'win32' ? 'python' : 'python3'
const backendArgs = ['-m', 'uvicorn', 'backend.app:app', '--host', '127.0.0.1', '--port', '8000', '--reload']
if (existsSync('.env')) backendArgs.push('--env-file', '.env')

const children = [
  spawn(python, backendArgs, { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { stdio: 'inherit' }),
]

let closing = false
const shutdown = signal => {
  if (closing) return
  closing = true
  children.forEach(child => child.kill(signal))
  setTimeout(() => process.exit(0), 600)
}

children.forEach(child => child.on('exit', code => {
  if (!closing && code) {
    console.error(`Development process exited with code ${code}`)
    shutdown('SIGTERM')
  }
}))

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
