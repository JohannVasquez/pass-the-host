# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file para Pass the host!
Genera ejecutable sin incluir java_runtime, rclone ni server
"""

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('config.example.json', '.'),  # Incluir config de ejemplo
    ],
    hiddenimports=[
        'PySide6.QtCore',
        'PySide6.QtWidgets',
        'PySide6.QtGui',
        'asyncio',
        'requests',
        'boto3',
        'botocore',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'java_runtime',  # Excluir Java Runtime
        'rclone',        # Excluir Rclone (se descarga automáticamente)
        'server',        # Excluir carpeta del servidor
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PassTheHost',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Sin ventana de consola
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Puedes agregar un icono aquí: icon='app_icon.ico'
)
