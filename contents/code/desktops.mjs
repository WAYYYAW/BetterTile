import { Queue } from "./queue.mjs";

export class Desktops {
  constructor(workspace, config, { windows, tiles, timer }) {
    this.workspace = workspace;
    this.config = config;
    this.windows = windows;
    this.tiles = tiles;
    this.timer = timer;
    this.avoidDesktopChanged = false;
    this.desktopsExtend = new Queue();
  }

  // Dynamic split-tree: no auto desktop creation
  create(focus = false, forceLast = false) {
    return this.workspace.currentDesktop;
  }

  // Dynamic split-tree: no auto desktop removal
  remove(info) {
    // User manages desktops manually
  }

  // Dynamic split-tree: no extra desktop buffer
  checkDesktopExtra() {
    return;
  }

  onDesktopsChanged() {
    if (this.avoidDesktopChanged === true) {
      this.avoidDesktopChanged = false;
      return;
    }

    for (var di = 0; di < this.workspace.desktops.length; di++) {
      var desktop = this.workspace.desktops[di];
      var extendDesktop = false;

      for (var si = 0; si < this.workspace.screens.length; si++) {
        var screen = this.workspace.screens[si];
        var windows = this.windows.getAll(undefined, desktop, screen);
        var tiles = this.tiles.getLeafTiles(desktop, screen);

        if (windows.length === tiles.length || windows.length === 0) {
          continue;
        }

        extendDesktop = true;
      }

      if (extendDesktop === false) {
        continue;
      }

      if (desktop === this.workspace.currentDesktop) {
        this.windows.extendCurrentDesktop(true);
        continue;
      }

      this.desktopsExtend.add(desktop);
    }
  }

  onTimerCurrentDesktopChangedFinished(uiVisible) {
    var moved = this.windows.checkDesktopChanged();

    // Moved by shortcut
    if (moved === true && uiVisible === false) {
      var activeWin = this.workspace.activeWindow;
      if (activeWin && activeWin._tileShadow !== undefined) {
        this.desktopsExtend.add(activeWin._tileShadow._desktop);
      }

      this.desktopsExtend.remove(this.workspace.currentDesktop);
      this.windows.setEmptyTile();
    } else {
      this.windows.focus();
    }

    if (this.desktopsExtend.exists(this.workspace.currentDesktop) === true) {
      this.windows.extendCurrentDesktop(true);
      this.desktopsExtend.remove(this.workspace.currentDesktop);
    }
  }

  // Dynamic split-tree: always return current desktop
  checkEmptySpace(windowIgnore) {
    return {
      desktop: this.workspace.currentDesktop,
      screen: this.workspace.activeScreen,
    };
  }
}
