export class Resize {
  constructor(workspace, config, root, windowResizeMode, { blocklist, tiles, windows }) {
    this.workspace = workspace;
    this.config = config;
    this.root = root;
    this.overlay = windowResizeMode;
    this.blocklist = blocklist;
    this.tiles = tiles;
    this.windows = windows;
    this.active = false;
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
      this.overlay.overlayGeometry = tile.absoluteGeometry;
    } else {
      const geo = win.frameGeometry;
      this.overlay.overlayGeometry = Qt.rect(geo.x, geo.y, geo.width, geo.height);
    }
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
    this.overlay.visible = true;
    this.overlay.resizeObj = this;
    this._updateOverlay();
  }

  deactivate() {
    this.active = false;
    this.overlay.visible = false;
    this.overlay.overlayGeometry = undefined;
    this.overlay.resizeObj = undefined;
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
