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

  _resizeWidth(delta) {
    const win = this._getActiveWindow();
    if (!win) return;
    const tile = this._getTile(win);

    if (tile) {
      const geo = tile.absoluteGeometry;
      const allTiles = this.tiles.getTilesCurrentDesktop();
      const maxRight = Math.max(...allTiles.map(
        t => t.absoluteGeometry.x + t.absoluteGeometry.width
      ));
      const edge = (geo.x + geo.width >= maxRight - 1) ? Qt.LeftEdge : Qt.RightEdge;
      tile.resizeByPixels(delta, edge);
      this.windows.extendCurrentDesktop(false);
    } else {
      const fg = win.frameGeometry;
      const newWidth = Math.max(200, fg.width + delta);
      win.frameGeometry = Qt.rect(fg.x, fg.y, newWidth, fg.height);
    }
    this._updateOverlay();
  }

  _resizeHeight(delta) {
    const win = this._getActiveWindow();
    if (!win) return;
    const tile = this._getTile(win);

    if (tile) {
      const geo = tile.absoluteGeometry;
      const allTiles = this.tiles.getTilesCurrentDesktop();
      const maxBottom = Math.max(...allTiles.map(
        t => t.absoluteGeometry.y + t.absoluteGeometry.height
      ));
      const edge = (geo.y + geo.height >= maxBottom - 1) ? Qt.TopEdge : Qt.BottomEdge;
      tile.resizeByPixels(delta, edge);
      this.windows.extendCurrentDesktop(false);
    } else {
      const fg = win.frameGeometry;
      const newHeight = Math.max(150, fg.height + delta);
      win.frameGeometry = Qt.rect(fg.x, fg.y, fg.width, newHeight);
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
    this._resizeWidth(this._step());
  }

  decreaseWidth() {
    if (!this.active) return;
    this._resizeWidth(-this._step());
  }

  increaseHeight() {
    if (!this.active) return;
    this._resizeHeight(this._step());
  }

  decreaseHeight() {
    if (!this.active) return;
    this._resizeHeight(-this._step());
  }
}
