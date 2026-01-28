console.log("In electron main process"); const { app } = require("electron"); console.log("app:", app); app.whenReady().then(() => { console.log("Electron ready!"); app.quit(); });
