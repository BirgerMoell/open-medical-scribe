// Preload script for Open Medical Scribe Electron app.
// contextIsolation is enabled in the BrowserWindow webPreferences.
// This file is intentionally minimal — no Node.js APIs are exposed to the
// renderer, keeping the web UI sandboxed and secure.

// If you need to expose specific APIs to the renderer in the future,
// use contextBridge here:
//
// const { contextBridge } = require("electron");
// contextBridge.exposeInMainWorld("myApi", { ... });
