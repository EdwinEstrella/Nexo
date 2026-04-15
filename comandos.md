# Comandos del proyecto Nexo

Este archivo resume los comandos principales para desarrollo, empaquetado y release.

## Requisitos previos

- Instalar dependencias:
  - `npm install`
- Para publicar release en GitHub (script `release:win`):
  - Configurar `GH_TOKEN` con permisos de `repo`.
  - En PowerShell (sesion actual): ``$env:GH_TOKEN="tu_token"``

## Scripts npm

- Ejecutar app en desarrollo (Electron Forge):
  - `npm run start`
- Empaquetar app con Forge (sin instalador):
  - `npm run package`
- Generar artefactos con Forge:
  - `npm run make`
- Regenerar icono Windows (`Logo.ico`) desde `Logo.png`:
  - `npm run build:ico`
- Crear instalador Windows NSIS con electron-builder (sin publicar):
  - `npm run dist:win`
- Crear instalador Windows NSIS y publicar automaticamente en GitHub Release:
  - `npm run release:win`

## Comandos directos (equivalentes)

- Build local Windows:
  - `npx electron-builder --win`
- Build + publicar:
  - `npx electron-builder --win --publish always`

## Salidas esperadas

- Los artefactos de Windows se generan en:
  - `release/`
- Ejemplos:
  - `release/Nexo Setup 1.0.0.exe`
  - `release/Nexo Setup 1.0.0.exe.blockmap`

## Flujo recomendado de release

1. Actualizar version en `package.json`.
2. Commit y tag (formato `vX.Y.Z`).
3. Ejecutar:
   - `npm run release:win`
