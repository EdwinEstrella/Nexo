/**
 * Regenera Logo.ico desde Logo.png (varias resoluciones) para que el icono
 * del escritorio / .exe en Windows se vea más grande y nítido.
 * Ejecutar: npm run build:ico
 */
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const toIco = require('to-ico')

async function main () {
    const root = path.join(__dirname, '..')
    const input = path.join(root, 'Logo.png')
    const output = path.join(root, 'Logo.ico')
    if (!fs.existsSync(input)) {
        console.error('No se encontró Logo.png en la raíz del proyecto.')
        process.exit(1)
    }
    let base = sharp(input).ensureAlpha()
    try {
        base = sharp(await base.trim().toBuffer()).ensureAlpha()
    } catch (_) {
        base = sharp(input).ensureAlpha()
    }
    const sizes = [16, 24, 32, 48, 64, 128, 256]
    const bufs = await Promise.all(
        sizes.map((s) =>
            base
                .clone()
                .resize(s, s, {
                    fit: 'contain',
                    position: 'centre',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toBuffer()
        )
    )
    const ico = await toIco(bufs)
    fs.writeFileSync(output, ico)
    console.log('OK:', output, `(${ico.length} bytes)`)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
