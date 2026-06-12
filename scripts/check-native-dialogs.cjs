const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const allowed = new Set([
    path.join(root, 'components', 'app-dialogs.js'),
    path.join(root, 'scripts', 'check-native-dialogs.cjs')
])
const ignoredDirs = new Set(['.git', 'node_modules', 'release', 'dist', 'out', 'openspec'])
const extensions = new Set(['.js', '.html', '.cjs', '.mjs'])
const checks = [
    { name: 'native alert/confirm/prompt', pattern: /(?<![\w$.])(?:window\.)?(alert|confirm|prompt)\s*\(/ },
    { name: 'native Notification', pattern: /\b(?:new\s+)?Notification\b|\bNotification\s*\./ },
    { name: 'Electron native dialog', pattern: /\bdialog\.(showMessageBox|showOpenDialog|showSaveDialog|showErrorBox)\b|\bshow(MessageBox|OpenDialog|SaveDialog|ErrorBox)\s*\(/ }
]

function walk (dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name), files)
            continue
        }
        const file = path.join(dir, entry.name)
        if (extensions.has(path.extname(entry.name))) files.push(file)
    }
    return files
}

const violations = []
for (const file of walk(root)) {
    if (allowed.has(file)) continue
    const rel = path.relative(root, file)
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
        for (const check of checks) {
            if (check.pattern.test(line)) {
                violations.push(`${rel}:${index + 1} ${check.name}: ${line.trim()}`)
            }
        }
    })
}

if (violations.length) {
    console.error('Forbidden native dialog APIs found:')
    for (const violation of violations) console.error(`- ${violation}`)
    process.exit(1)
}

console.log('No forbidden native dialog APIs found.')
