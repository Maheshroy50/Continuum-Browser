exports.default = function (context) {
    // Skip if not mac
    if (process.platform !== 'darwin') return

    // VMP sign via EVS (Castlabs Electron Verification Service)
    // This MUST run BEFORE code signing on macOS
    // See: https://github.com/castlabs/electron-releases/wiki/EVS
    const { execSync } = require('child_process')
    const path = require('path')
    const fs = require('fs')

    // Find Python with castlabs_evs installed
    // Priority: venv in project root > .venv in project root > system python3
    const projectRoot = path.resolve(__dirname, '..')
    const venvPython = path.join(projectRoot, 'venv', 'bin', 'python3')
    const dotVenvPython = path.join(projectRoot, '.venv', 'bin', 'python3')

    let pythonCmd = 'python3' // fallback to system
    if (fs.existsSync(venvPython)) {
        pythonCmd = venvPython
    } else if (fs.existsSync(dotVenvPython)) {
        pythonCmd = dotVenvPython
    }

    console.log('VMP macOS signing start (using: ' + pythonCmd + ')')
    execSync(pythonCmd + ' -m castlabs_evs.vmp sign-pkg ' + context.appOutDir, { stdio: 'inherit' })
    console.log('VMP macOS signing complete')
}
