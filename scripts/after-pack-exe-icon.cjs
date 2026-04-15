'use strict'

/**
 * Con win.signAndEditExecutable: false, el .exe puede quedar con icono por defecto.
 * Aplica Logo.ico al ejecutable empaquetado (misma idea que CyberBistro + icon.ico).
 */
exports.default = async function afterPack (context) {
  if (context.electronPlatformName !== 'win32') return

  const fs = require('node:fs')
  const path = require('node:path')
  const { rcedit } = require('rcedit')

  const projectDir = context.packager.info.projectDir
  const iconPath = path.join(projectDir, 'Logo.ico')
  if (!fs.existsSync(iconPath)) {
    console.warn('[after-pack-exe-icon] No se encontró Logo.ico en la raíz del proyecto.')
    return
  }

  const name = context.packager.appInfo.productFilename
  const exePath = path.join(context.appOutDir, `${name}.exe`)
  if (!fs.existsSync(exePath)) {
    console.warn('[after-pack-exe-icon] No se encontró ejecutable:', exePath)
    return
  }

  await rcedit(exePath, { icon: iconPath })
  console.log('[after-pack-exe-icon] Icono aplicado a', path.basename(exePath))
}
