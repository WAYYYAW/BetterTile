export class Windows {
  constructor(workspace, config, { blocklist, tiles, userspace, timer }) {
    this.workspace = workspace;
    this.config = config;
    this.blocklist = blocklist;
    this.tiles = tiles;
    this.userspace = userspace;
    this.timer = timer;
  }

  // Get all windows from the virtual desktop except the given window
  getAll(
    windowIgnore,
    desktop = this.workspace.currentDesktop,
    screen = this.workspace.activeScreen,
  ) {
    var windows = [];

    for (var i = 0; i < this.workspace.stackingOrder.length; i++) {
      var w = this.workspace.stackingOrder[i];
      if (
        w !== windowIgnore &&
        w.output === screen &&
        w.desktops.includes(desktop) === true &&
        this.blocklist.check(w) === false
      ) {
        windows.push(w);
      }
    }

    return windows;
  }

  // Dynamic split-tree: place new window by splitting the focused tile
  setTilesOnAdd(windowMain, desktop, screen) {
    this.workspace.currentDesktop = desktop;
    windowMain.desktops = [desktop];

    var windowsExisting = this.getAll(windowMain, desktop, screen);

    // First window: manage by root tile, 75% centering via extend
    if (windowsExisting.length === 0) {
      var rootTile = this.tiles.getRootTile(desktop, screen);
      if (rootTile) {
        windowMain._avoidMaximizeTrigger = true;
        windowMain._tileShadow = rootTile;
        rootTile.manage(windowMain);
      }
      return;
    }

    // Try to find an empty leaf tile first
    var leaves = this.tiles.getLeafTiles(desktop, screen);
    var emptyTile = null;
    for (var i = 0; i < leaves.length; i++) {
      var occupied = false;
      for (var j = 0; j < windowsExisting.length; j++) {
        if (windowsExisting[j].tile === leaves[i] || windowsExisting[j]._tileShadow === leaves[i]) {
          occupied = true;
          break;
        }
      }
      if (!occupied) {
        emptyTile = leaves[i];
        break;
      }
    }

    if (emptyTile) {
      windowMain._avoidMaximizeTrigger = true;
      windowMain._tileShadow = emptyTile;
      emptyTile.manage(windowMain);
      return;
    }

    // No empty tile: split the focused window's leaf tile
    var focusedTile = this.tiles.getFocusedLeafTile();
    if (!focusedTile) {
      // Fallback: use any existing window's tile
      for (var k = 0; k < windowsExisting.length; k++) {
        var ft = windowsExisting[k].tile || windowsExisting[k]._tileShadow;
        if (ft && (!ft.tiles || ft.tiles.length === 0)) {
          focusedTile = ft;
          break;
        }
      }
    }

    if (!focusedTile) return;

    var direction = this.tiles.getSplitDirection();
    var children = this.tiles.splitTileForWindow(focusedTile, direction);
    if (!children) return;

    // child[0] already has the existing window managed
    // child[1] gets the new window
    windowMain._avoidMaximizeTrigger = true;
    windowMain._tileShadow = children[1];
    children[1].manage(windowMain);
  }

  // Dynamic split-tree: remove window's tile, KWin expands sibling
  setTilesOnRemove(windowMain) {
    var tile = windowMain.tile || windowMain._tileShadow;
    if (tile) {
      // Avoid signal cascades
      if (tile.parent) {
        tile.parent._avoidChildTilesChanged = true;
      }
      tile.remove();
    }

    var windowsOther = this.getAll(windowMain, undefined, windowMain.output);

    if (windowsOther.length === 0) {
      return true; // No windows left
    }

    this.extend(windowsOther, this.userspace.getPanelsSize(undefined, windowMain.output));
    return false;
  }

  // Extend windows to fill tile bounds
  extend(windows, panelsSize, skipSingleMargin = false) {
    // Count visible (non-minimized) windows
    var visibleCount = 0;
    var lastVisible = null;
    for (var vi = 0; vi < windows.length; vi++) {
      if (!windows[vi].minimized) { visibleCount++; lastVisible = windows[vi]; }
    }

    // Single visible window: size to configured percentage of desktop
    if (
      skipSingleMargin !== true &&
      visibleCount === 1 &&
      lastVisible !== null
    ) {
      var sizePct = (this.config.singleWindowSize || 75) / 100;
      var win = lastVisible;
      win._avoidMaximizeTrigger = true;
      win.setMaximize(false, false);
      var wa = panelsSize.workarea;
      var sw = wa.right - wa.left;
      var sh = wa.bottom - wa.top;
      var marginX = Math.round(sw * (1 - sizePct) / 2);
      var marginY = Math.round(sh * (1 - sizePct) / 2);
      win.frameGeometry = Qt.rect(
        wa.left + marginX, wa.top + marginY,
        sw - marginX * 2, sh - marginY * 2,
      );
      return;
    }

    // Single visible window + maximizeExtend fallback
    if (
      this.config.maximizeExtend === true &&
      visibleCount === 1 &&
      lastVisible !== null &&
      lastVisible._avoidMaximizeExtend !== true
    ) {
      lastVisible._avoidMaximizeTrigger = true;
      lastVisible._avoidMaximizeExtend = false;
      lastVisible.setMaximize(true, true);
      return;
    }

    // Multi-window: clip tile geometry to workarea (avoid panels)
    var wa = panelsSize.workarea;
    for (var i = 0; i < windows.length; i++) {
      var w = windows[i];
      w._avoidMaximizeExtend = false;

      if (w.minimized === true) continue;

      var tileRef = w.tile !== null ? w.tile : w._tileShadow;
      if (!tileRef) continue;

      w.setMaximize(false, false);

      var geo = tileRef.absoluteGeometry;
      var pad = tileRef.padding || 0;
      var left = Math.max(geo.x + pad, wa.left);
      var top = Math.max(geo.y + pad, wa.top);
      var right = Math.min(geo.x + geo.width - pad, wa.right);
      var bottom = Math.min(geo.y + geo.height - pad, wa.bottom);
      w.frameGeometry = Qt.rect(left, top, right - left, bottom - top);
    }
  }

  //Get geometry from tiles
  getRealGeometry(window) {
    if (window._tileVirtual !== undefined) {
      return window._tileVirtual;
    }

    var tileResult = window._tileShadow ? window._tileShadow.absoluteGeometry : undefined;

    if (window.tile !== null) {
      tileResult = window.tile.absoluteGeometry;
    }

    if (tileResult === undefined) {
      tileResult = window.absoluteGeometry;
    }

    return {
      top: tileResult.y,
      left: tileResult.x,
      right: tileResult.x + tileResult.width,
      bottom: tileResult.y + tileResult.height,
      height: tileResult.height,
      width: tileResult.width,
    };
  }

  //Set window size and return virtual tile
  setGeometry(window, geometry, panelsSize) {
    var tileRef = window.tile !== null ? window.tile : window._tileShadow;
    var tileRefGeometry = this.getRealGeometry(window);

    var left = geometry.left !== undefined ? geometry.left : tileRefGeometry.left;
    var top = geometry.top !== undefined ? geometry.top : tileRefGeometry.top;

    var width = geometry.right !== undefined
      ? geometry.right - left
      : tileRefGeometry.width;
    var height = geometry.bottom !== undefined
      ? geometry.bottom - top
      : tileRefGeometry.height;

    var offsetX = tileRef.padding;
    var offsetY = tileRef.padding;

    if (left === panelsSize.left) {
      offsetX += tileRef.padding;
    }

    if (top === panelsSize.top) {
      offsetY += tileRef.padding;
    }

    if (left + width === panelsSize.workarea.right + panelsSize.right) {
      offsetX += panelsSize.right;
    }

    if (top + height === panelsSize.workarea.bottom + panelsSize.bottom) {
      offsetY += panelsSize.bottom;
    }

    window.frameGeometry = {
      x: left + (left === panelsSize.left ? tileRef.padding : 0),
      y: top + (top === panelsSize.top ? tileRef.padding : 0),
      width: width - offsetX,
      height: height - offsetY,
    };

    return {
      width, height, left, top,
      right: left + width,
      bottom: top + height,
    };
  }

  //Focus window in the workspace
  focus(window) {
    if (window === undefined || window === null) {
      var windows = this.getAll();

      if (windows.length === 0) {
        return null;
      }

      if (windows[windows.length - 1].minimized === true) {
        return null;
      }

      this.workspace.activeWindow = windows[windows.length - 1];
    } else {
      this.workspace.activeWindow = window;
    }
  }

  checkSameColumn(windowGeometry, windowGeometryOther) {
    return (
      (windowGeometry.left >= windowGeometryOther.left &&
        windowGeometry.left < windowGeometryOther.right) ||
      (windowGeometry.right <= windowGeometryOther.right &&
        windowGeometry.right > windowGeometryOther.left)
    );
  }

  //Extend all windows in the current desktop
  extendCurrentDesktop(screenAll = false, skipSingleMargin = false) {
    var screens = [this.workspace.activeScreen];

    if (screenAll === true) {
      screens = this.workspace.screens;
    }

    for (var si = 0; si < screens.length; si++) {
      var windows = this.getAll(undefined, undefined, screens[si]);

      if (windows.length === 0) {
        continue;
      }

      this.extend(windows, this.userspace.getPanelsSize(undefined, screens[si]), skipSingleMargin);
    }
  }

  //Check if the window has changed its desktop
  checkDesktopChanged(window) {
    if (window === undefined) window = this.workspace.activeWindow;
    if (window === null) {
      return false;
    }

    return !(
      this.blocklist.check(window) === true ||
      window._tileShadow === undefined ||
      (window._tileShadow && window._tileShadow._desktop === this.workspace.currentDesktop)
    );
  }

  //Search empty tile and set to the window
  setEmptyTile(window) {
    if (window === undefined) window = this.workspace.activeWindow;
    var windowsOther = this.getAll(window);
    var leaves = this.tiles.getLeafTiles();

    var tileEmpty = null;
    for (var i = 0; i < leaves.length; i++) {
      var occupied = false;
      for (var j = 0; j < windowsOther.length; j++) {
        if (windowsOther[j].tile === leaves[i] || windowsOther[j]._tileShadow === leaves[i]) {
          occupied = true;
          break;
        }
      }
      if (!occupied) {
        tileEmpty = leaves[i];
        break;
      }
    }

    if (!tileEmpty) {
      // No empty tile: split the focused tile to make room
      var focusedTile = this.tiles.getFocusedLeafTile();
      if (focusedTile) {
        var direction = this.tiles.getSplitDirection();
        var children = this.tiles.splitTileForWindow(focusedTile, direction);
        if (children) {
          tileEmpty = children[1];
        }
      }
    }

    if (!tileEmpty) {
      // Ultimate fallback: use any leaf tile
      if (leaves.length > 0) {
        tileEmpty = leaves[0];
      }
    }

    if (tileEmpty) {
      window.desktops = [tileEmpty._desktop];

      if (window._maximized === true) {
        window._avoidMaximizeTrigger = true;
        window.setMaximize(false, false);
      }

      window._avoidTileChangedTrigger = true;
      window._tileShadow = tileEmpty;
      tileEmpty.manage(window);
      return true;
    }

    return false;
  }

  // Reset: rebuild dynamic tree from existing windows
  resetAll(screenAll = false) {
    var screens = [this.workspace.activeScreen];

    if (screenAll === true) {
      screens = this.workspace.screens;
    }

    for (var si = 0; si < screens.length; si++) {
      var windows = this.getAll(undefined, undefined, screens[si]);

      if (windows.length === 0) continue;

      // Delete existing children from root
      var rootTile = this.tiles.getRootTile(undefined, screens[si]);
      if (!rootTile) continue;

      rootTile._avoidChildTilesChanged = true;
      var rootChildren = rootTile.tiles;
      for (var ci = rootChildren.length - 1; ci >= 0; ci--) {
        rootChildren[ci].remove();
      }

      if (windows.length === 1) {
        // Single window: manage by root
        windows[0]._avoidMaximizeTrigger = true;
        windows[0]._tileShadow = rootTile;
        rootTile.manage(windows[0]);
      } else {
        // Multiple windows: build chain of horizontal splits
        // First window in root
        windows[0]._avoidMaximizeTrigger = true;
        windows[0]._tileShadow = rootTile;
        rootTile.manage(windows[0]);

        var currentTile = rootTile;
        for (var wi = 1; wi < windows.length; wi++) {
          var direction = this.tiles.getSplitDirection();
          var children = this.tiles.splitTileForWindow(currentTile, direction);
          if (!children) break;

          // child[0] already has previous window
          // child[1] gets next window
          windows[wi]._avoidMaximizeTrigger = true;
          windows[wi]._tileShadow = children[1];
          children[1].manage(windows[wi]);

          // Next split will be on the tile that just got the new window
          currentTile = children[1];
        }
      }
    }

    this.extendCurrentDesktop(screenAll);
  }

  //Disconnect all signals
  disconnectSignals(screenAll = true) {
    var screens = this.workspace.screens;

    if (screenAll === false) {
      screens = [this.workspace.activeScreen];
    }

    for (var si = 0; si < screens.length; si++) {
      var windows = this.getAll(undefined, undefined, screens[si]);
      for (var wi = 0; wi < windows.length; wi++) {
        var w = windows[wi];
        if (w._signals) {
          for (var key in w._signals) {
            w[key].disconnect(w._signals[key]);
          }
        }
      }
    }
  }

  //Connect all signals
  reconnectSignals(screenAll = true) {
    var screens = this.workspace.screens;

    if (screenAll === false) {
      screens = [this.workspace.activeScreen];
    }

    for (var si = 0; si < screens.length; si++) {
      var windows = this.getAll(undefined, undefined, screens[si]);
      for (var wi = 0; wi < windows.length; wi++) {
        var w = windows[wi];
        if (w._signals) {
          for (var key in w._signals) {
            w[key].connect(w._signals[key]);
          }
        }
      }
    }
  }

  //Set tile to window
  setTile(
    window,
    tile,
    {
      checkDifferentScreen = true,
      unmaximizeOthers = true,
      rearrangeOthers = false,
      setShadow = false,
      windowsOtherCached,
      tilesOrderedCached,
    },
  ) {
    if (checkDifferentScreen === true && tile._screen !== window.output) {
      this.workspace.sendClientToScreen(window, tile._screen);
    }

    var windowsOther =
      windowsOtherCached ?? this.getAll(window, tile._desktop, tile._screen);

    if (unmaximizeOthers === true) {
      for (var i = 0; i < windowsOther.length; i++) {
        var wo = windowsOther[i];
        if (wo._maximized === true) {
          wo._avoidMaximizeTrigger = true;
          wo._avoidTileChangedTrigger = true;
          wo.setMaximize(false, false);
          wo._tileShadow.manage(wo);
        }
      }
    }

    if (rearrangeOthers === true) {
      var tilesOrdered = (
        tilesOrderedCached ??
        this.tiles.getOrderedTiles(tile._desktop, tile._screen)
      ).filter(function (t) { return t !== tile; });

      for (var x = 0; x < windowsOther.length; x++) {
        windowsOther[x]._avoidMaximizeTrigger = true;
        windowsOther[x]._avoidTileChangedTrigger = true;
        windowsOther[x].setMaximize(false, false);
        tilesOrdered[x].manage(windowsOther[x]);
        windowsOther[x]._tileShadow = windowsOther[x].tile;
      }
    }

    if (setShadow === true) {
      window._tileShadow = tile;
    }

    tile.manage(window);
  }
}
