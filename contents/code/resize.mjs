export class Resize {
  constructor(workspace, config, root, { blocklist, tiles, windows }) {
    this.workspace = workspace;
    this.config = config;
    this.root = root;
    this.blocklist = blocklist;
    this.tiles = tiles;
    this.windows = windows;
    this.active = false;
    this._savedRootVisible = false;
    this._dynamicObjects = [];
    this._shortcutDefs = [
      { name: "FluidtileResizeRight",  text: "流体平铺 | 调整模式：增大宽度", sequence: "Right" },
      { name: "FluidtileResizeLeft",   text: "流体平铺 | 调整模式：减小宽度", sequence: "Left" },
      { name: "FluidtileResizeUp",     text: "流体平铺 | 调整模式：增大高度", sequence: "Up" },
      { name: "FluidtileResizeDown",   text: "流体平鋪 | 调整模式：减小高度", sequence: "Down" },
      { name: "FluidtileResizeExitEsc",  text: "流体平鋪 | 调整模式：退出", sequence: "Escape" },
      { name: "FluidtileResizeExitEnter", text: "流体平鋪 | 调整模式：退出", sequence: "Return" },
    ];
  }

  _step() {
    return this.config.resizeStep || 50;
  }

  _getActiveWindow() {
    const win = this.workspace.activeWindow;
    if (!win) return null;
    if (this.blocklist.check(win) === true) return null;
    if (win._maximized === true) return null;
    return win;
  }

  _getTile(win) {
    return win.tile || win._tileShadow || null;
  }

  _resizeEdge(edge, delta) {
    const win = this._getActiveWindow();
    if (!win) return;
    const tile = this._getTile(win);

    if (tile) {
      tile.resizeByPixels(delta, edge);
      this.windows.extendCurrentDesktop(false);
    } else {
      const geo = win.frameGeometry;
      if (edge === Qt.RightEdge || edge === Qt.LeftEdge) {
        const newWidth = Math.max(200, geo.width + delta);
        win.frameGeometry = Qt.rect(geo.x, geo.y, newWidth, geo.height);
      } else {
        const newHeight = Math.max(150, geo.height + delta);
        win.frameGeometry = Qt.rect(geo.x, geo.y, geo.width, newHeight);
      }
    }
    this._updateOverlay();
  }

  _updateOverlay() {
    const win = this._getActiveWindow();
    if (!win) return;
    const tile = this._getTile(win);
    if (tile) {
      this.root.resizeOverlayGeometry = tile.absoluteGeometry;
    } else {
      const geo = win.frameGeometry;
      this.root.resizeOverlayGeometry = Qt.rect(geo.x, geo.y, geo.width, geo.height);
    }
  }

  _createDynamicShortcuts() {
    this._dynamicObjects = [];
    for (const def of this._shortcutDefs) {
      let callback;
      switch (def.name) {
        case "FluidtileResizeRight":  callback = () => this.increaseWidth(); break;
        case "FluidtileResizeLeft":   callback = () => this.decreaseWidth(); break;
        case "FluidtileResizeUp":     callback = () => this.increaseHeight(); break;
        case "FluidtileResizeDown":   callback = () => this.decreaseHeight(); break;
        default:                      callback = () => this.deactivate(); break;
      }

      const qml = `
import QtQuick
import org.kde.kwin
Item {
  property var cb
  ShortcutHandler {
    name: "${def.name}"
    text: "${def.text}"
    sequence: "${def.sequence}"
    onActivated: { cb() }
  }
}`;
      const obj = Qt.createQmlObject(qml, this.root, "resizeShortcut");
      if (obj) {
        obj.cb = callback;
        this._dynamicObjects.push(obj);
      }
    }
  }

  _destroyDynamicShortcuts() {
    for (const obj of this._dynamicObjects) {
      if (obj && typeof obj.destroy === "function") {
        obj.destroy();
      }
    }
    this._dynamicObjects = [];
  }

  toggle() {
    if (this.active) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  activate() {
    const win = this._getActiveWindow();
    if (!win) return;

    this.active = true;
    this._createDynamicShortcuts();

    this._savedRootVisible = this.root.visible;
    this.root.visible = true;
    this.root.resizeModeActive = true;
    this._updateOverlay();
  }

  deactivate() {
    this.active = false;
    this._destroyDynamicShortcuts();
    this.root.resizeModeActive = false;
    this.root.resizeOverlayGeometry = undefined;
    this.root.visible = this._savedRootVisible;
  }

  increaseWidth() {
    if (!this.active) return;
    this._resizeEdge(Qt.RightEdge, this._step());
  }

  decreaseWidth() {
    if (!this.active) return;
    this._resizeEdge(Qt.RightEdge, -this._step());
  }

  increaseHeight() {
    if (!this.active) return;
    this._resizeEdge(Qt.BottomEdge, this._step());
  }

  decreaseHeight() {
    if (!this.active) return;
    this._resizeEdge(Qt.BottomEdge, -this._step());
  }
}
