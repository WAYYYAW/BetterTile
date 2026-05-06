export class Tiles {
  constructor(workspace, config) {
    this.workspace = workspace;
    this.config = config;
    this.splitDirection = config.splitDirection || 1; // 1=Horizontal, 2=Vertical
  }

  setSplitDirection(direction) {
    this.splitDirection = direction;
  }

  getSplitDirection() {
    return this.splitDirection;
  }

  //Get root tile
  getRootTile(
    desktop = this.workspace.currentDesktop,
    screen = this.workspace.activeScreen,
  ) {
    return this.workspace.rootTile(screen, desktop);
  }

  // Split a leaf tile, return [existingWindowTile, newWindowTile]
  splitTileForWindow(tile, direction) {
    if (tile.tiles && tile.tiles.length > 0) {
      return null; // Not a leaf tile
    }

    var hasManagedWindow = false;
    var managedWin = null;
    var st = this.workspace.stackingOrder;
    for (var i = 0; i < st.length; i++) {
      if (st[i].tile === tile || st[i]._tileShadow === tile) {
        hasManagedWindow = true;
        managedWin = st[i];
        break;
      }
    }

    if (!hasManagedWindow || !managedWin) {
      return null; // No window to split for
    }

    // Split the tile
    tile.layoutDirection = direction;
    var children = tile.split(direction);
    if (!children || children.length < 2) {
      return null;
    }

    var child0 = children[0];
    var child1 = children[1];

    // Manage existing window into child0
    managedWin._avoidMaximizeTrigger = true;
    managedWin._avoidTileChangedTrigger = true;
    managedWin.setMaximize(false, false);
    managedWin._tileShadow = child0;
    child0.manage(managedWin);

    return [child0, child1];
  }

  // Get the leaf tile of the currently focused window
  getFocusedLeafTile() {
    var win = this.workspace.activeWindow;
    if (!win) return null;
    var t = win.tile || win._tileShadow;
    if (!t) return null;
    // Navigate to leaf (should already be a leaf)
    while (t.tiles && t.tiles.length > 0) {
      t = t.tiles[0];
    }
    return t;
  }

  // Get all leaf tiles (no children) for a desktop/screen
  getLeafTiles(
    desktop = this.workspace.currentDesktop,
    screen = this.workspace.activeScreen,
  ) {
    var root = this.getRootTile(desktop, screen);
    if (!root) return [];
    var leaves = [];
    var stack = root.tiles.length > 0 ? root.tiles.slice() : [root];
    while (stack.length > 0) {
      var t = stack.pop();
      if (t.tiles && t.tiles.length > 0) {
        for (var i = 0; i < t.tiles.length; i++) {
          stack.push(t.tiles[i]);
        }
      } else {
        t._screen = screen;
        t._desktop = desktop;
        leaves.push(t);
      }
    }
    return leaves;
  }

  //Get tiles from the screen and virtual desktop (ordered)
  getOrderedTiles(
    desktop = this.workspace.currentDesktop,
    screen = this.workspace.activeScreen,
    parentTiles = false,
  ) {
    var tileRoot = this.workspace.rootTile(screen, desktop);

    if (tileRoot === null) {
      return [];
    }

    var tiles = this.orderTiles(
      tileRoot.tiles.length !== 0 ? tileRoot.tiles : [tileRoot],
      parentTiles,
    );

    for (var i = 0; i < tiles.length; i++) {
      tiles[i]._screen = screen;
      tiles[i]._desktop = desktop;
    }

    return tiles;
  }

  //Get tiles, ordered by tilesPriority
  orderTiles(tiles, parentTiles) {
    var tilesOrdered = [];

    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      if (tile.tiles.length !== 0) {
        if (parentTiles === true) {
          tile._parent = true;
          tilesOrdered.push(tile);
        }

        tilesOrdered = tilesOrdered.concat(
          this.orderTiles(tile.tiles, parentTiles),
        );
      } else {
        tilesOrdered.push(tile);
      }
    }

    return tilesOrdered.sort(function (a, b) {
      for (var j = 0; j < this.config.tilesPriority.length; j++) {
        var priority = this.config.tilesPriority[j];
        var comparison = 0;
        switch (priority) {
          case "宽度":
            comparison = b.absoluteGeometry.width - a.absoluteGeometry.width;
            break;
          case "高度":
            comparison = b.absoluteGeometry.height - a.absoluteGeometry.height;
            break;
          case "顶部":
            comparison = a.absoluteGeometry.y - b.absoluteGeometry.y;
            break;
          case "右侧":
            comparison = b.absoluteGeometry.x - a.absoluteGeometry.x;
            break;
          case "左侧":
            comparison = a.absoluteGeometry.x - b.absoluteGeometry.x;
            break;
          case "底部":
            comparison = b.absoluteGeometry.y - a.absoluteGeometry.y;
            break;
        }
        if (comparison !== 0) {
          return comparison;
        }
      }
      return 0;
    }.bind(this));
  }

  //Get all tiles from the actual desktop with all screens
  getTilesCurrentDesktop(parentTiles = false, screenAll = true) {
    var screens = this.workspace.screens;

    if (screenAll === false) {
      screens = [this.workspace.activeScreen];
    }

    var tiles = [];
    for (var i = 0; i < screens.length; i++) {
      tiles = tiles.concat(
        this.getOrderedTiles(undefined, screens[i], parentTiles),
      );
    }
    return tiles;
  }

  //Exchange windows between tiles
  exchangeTiles(windowsExchange, tile) {
    // Skip if tile is a container (has children)
    if (tile.tiles && tile.tiles.length > 0) return;

    for (var i = 0; i < windowsExchange.length; i++) {
      var window = windowsExchange[i];
      window._avoidMaximizeTrigger = true;
      window.setMaximize(false, false);

      if (tile._screen !== window.output) {
        this.workspace.sendClientToScreen(window, tile._screen);
      }

      if (tile._desktop !== this.workspace.currentDesktop) {
        window.desktops = [tile._desktop];
      }

      window._avoidTileChangedTrigger = true;
      window._tileShadow = tile;

      tile.manage(window);
    }
  }

  //Return the tile before maximize window
  getShadowTile(window) {
    if (window.tile !== null && window.tile !== undefined) {
      return window.tile;
    }

    if (window._tileShadow !== undefined) {
      return window._tileShadow;
    }

    return null;
  }

  //Disconnect all signals
  disconnectSignals(screenAll = true) {
    var screens = this.workspace.screens;

    if (screenAll === false) {
      screens = [this.workspace.activeScreen];
    }

    for (var si = 0; si < screens.length; si++) {
      var rootTile = this.getRootTile(undefined, screens[si]);

      if (rootTile._signals) {
        for (var key in rootTile._signals) {
          rootTile[key].disconnect(rootTile._signals[key]);
        }
      }
      rootTile._signals = undefined;
    }

    var tiles = this.getTilesCurrentDesktop(true, screenAll);

    for (var ti = 0; ti < tiles.length; ti++) {
      var tile = tiles[ti];
      if (tile._signals) {
        for (var key in tile._signals) {
          tile[key].disconnect(tile._signals[key]);
        }
      }
      tile._signals = undefined;
    }
  }
}
