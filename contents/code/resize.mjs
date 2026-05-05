export class Resize {
  constructor(workspace, config, { blocklist, tiles, windows }) {
    this.workspace = workspace;
    this.config = config;
    this.blocklist = blocklist;
    this.tiles = tiles;
    this.windows = windows;
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
      // Floating window fallback
      const geo = win.frameGeometry;
      if (edge === Qt.RightEdge || edge === Qt.LeftEdge) {
        const newWidth = Math.max(200, geo.width + delta);
        win.frameGeometry = Qt.rect(geo.x, geo.y, newWidth, geo.height);
      } else {
        const newHeight = Math.max(150, geo.height + delta);
        win.frameGeometry = Qt.rect(geo.x, geo.y, geo.width, newHeight);
      }
    }
  }

  increaseWidth() {
    this._resizeEdge(Qt.RightEdge, this.config.resizeStep || 50);
  }

  decreaseWidth() {
    this._resizeEdge(Qt.RightEdge, -(this.config.resizeStep || 50));
  }

  increaseHeight() {
    this._resizeEdge(Qt.BottomEdge, this.config.resizeStep || 50);
  }

  decreaseHeight() {
    this._resizeEdge(Qt.BottomEdge, -(this.config.resizeStep || 50));
  }
}
