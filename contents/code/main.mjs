import { Blocklist } from "./blocklist.mjs";
import { Resize } from "./resize.mjs";
import { Shortcuts } from "./shortcuts.mjs";
import { Tiles } from "./tiles.mjs";
import { UI } from "./ui.mjs";
import { Userspace } from "./userspace.mjs";
import { Windows } from "./windows.mjs";
import { Desktops } from "./desktops.mjs";
import { Timer } from "./timer.mjs";

export class Engine {
  constructor(
    workspace,
    config,
    { root, timerInstantiator, windowFullscreen, windowCompact, windowPopup },
  ) {
    this.state = {
      avoidChildChanged: false,
    };
    this.workspace = workspace;
    this.config = config;
    this.root = root;
    this.windowsUI = {
      windowFullscreen,
      windowCompact,
      windowPopup,
    };
    this.classes = {
      timer: new Timer(root, timerInstantiator),
      blocklist: new Blocklist(config),
      userspace: new Userspace(workspace),
      tiles: new Tiles(workspace, config),
    };
    this.classes.windows = new Windows(workspace, config, this.classes);
    this.classes.desktops = new Desktops(workspace, config, this.classes);
    this.classes.ui = new UI(
      workspace,
      config,
      root,
      this.classes,
      this.windowsUI.windowFullscreen,
      this.windowsUI.windowCompact,
      this.windowsUI.windowPopup,
    );
    this.classes.resize = new Resize(workspace, config, root, this.classes);
    this.classes.shortcuts = new Shortcuts(
      workspace,
      config,
      root,
      this.classes,
    );
  }

  // Dynamic split-tree: place window on current desktop, split if needed
  onWindowAdded(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    this.state.avoidChildChanged = true;
    this.classes.windows.setTilesOnAdd(
      window,
      this.workspace.currentDesktop,
      this.workspace.activeScreen,
    );
    this.setTilesSignals();
    this.classes.windows.extendCurrentDesktop(false);
    this.classes.timer.start("onWindowAdded", () => {
      this.state.avoidChildChanged = false;
    });
  }

  // Dynamic split-tree: remove tile, KWin expands sibling
  onWindowRemoved(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    this.classes.blocklist.removeWindow(window);
    var noWindows = this.classes.windows.setTilesOnRemove(window);

    if (!noWindows) {
      this.classes.windows.focus();
    }
  }

  //Set signals to all Windows
  setWindowsSignals() {
    for (var i = 0; i < this.workspace.stackingOrder.length; i++) {
      this.setSignalsToWindow(this.workspace.stackingOrder[i]);
    }
  }

  //Set signals to window
  setSignalsToWindow(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    if (window._signals !== undefined) {
      for (var key in window._signals) {
        window[key].disconnect(window._signals[key]);
      }
    }

    window._signals = {
      maximizedAboutToChange: this.onMaximizeAboutToChanged.bind(this, window),
      maximizedChanged: this.onMaximizeChanged.bind(this, window),
      minimizedChanged: this.onMinimizedChanged.bind(this, window),
      interactiveMoveResizeStarted: this.classes.ui.onUserMoveStart.bind(
        this.classes.ui, window,
      ),
      interactiveMoveResizeStepped: this.classes.ui.onUserMoveStepped.bind(
        this.classes.ui, window,
      ),
      interactiveMoveResizeFinished: this.classes.ui.onUserMoveFinished.bind(
        this.classes.ui, window,
      ),
    };

    for (var key in window._signals) {
      window[key].connect(window._signals[key]);
    }
  }

  //When a window tile is changed, exchange windows and extend
  onWindowAddedToTile(tile, window) {
    if (
      this.classes.blocklist.check(window) === true ||
      this.classes.ui.checkIfUIVisible() === true ||
      window._avoidTileChangedTrigger === true ||
      window._tileShadow === undefined
    ) {
      window._avoidTileChangedTrigger =
        window._avoidTileChangedTrigger === true ? false : window._avoidTileChangedTrigger;
      window._tileShadow = tile;
      return;
    }

    var windowsOther = this.classes.windows
      .getAll(window)
      .filter(function (w) {
        return w.minimized === false && (w.tile === tile || w._tileShadow === tile);
      });

    if (windowsOther.length > 0) {
      this.classes.tiles.exchangeTiles(windowsOther, window._tileShadow);
    }

    if (this.workspace.currentDesktop !== window._tileShadow._desktop) {
      this.classes.desktops.desktopsExtend.add(window._tileShadow._desktop);
    }

    if (window._tileShadow._screen !== this.workspace.activeScreen) {
      this.classes.timer.start(
        "extendCurrentDesktop",
        this.classes.windows.extendCurrentDesktop.bind(this.classes.windows, true),
        this.config.windowsExtendTileChangedDelay,
      );
    } else if (
      this.classes.tiles.getTilesCurrentDesktop().length >= windowsOther.length + 1 ||
      window._maximized === false
    ) {
      this.classes.timer.start(
        "extendCurrentDesktop",
        this.classes.windows.extendCurrentDesktop.bind(this.classes.windows, true),
      );
    }

    window._tileShadow = tile;
  }

  //When window is not maximized, set a previous tile
  onMaximizeChanged(window) {
    if (
      this.classes.blocklist.check(window) === true ||
      this.classes.ui.checkIfUIVisible() === true ||
      window._maximized === true ||
      window._avoidMaximizeTrigger === true ||
      window._tileShadow === undefined ||
      window.tile !== null
    ) {
      window._avoidMaximizeTrigger =
        window._avoidMaximizeTrigger === true ? false : window._avoidMaximizeTrigger;
      return;
    }

    if (window.tile !== window._tileShadow) {
      window._avoidTileChangedTrigger = false;
      window._avoidMaximizeExtend = true;
      window._tileShadow.manage(window);
    }
  }

  //Set maximized variable to window
  onMaximizeAboutToChanged(window, mode) {
    window._maximized = mode === 3;
  }

  //When a window is minimized, extend windows
  onMinimizedChanged(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    if (window.desktops.includes(this.workspace.currentDesktop) === false) {
      this.classes.desktops.desktopsExtend.add(window.desktops[0]);
      return;
    }

    window._avoidMaximizeTrigger = true;
    window.setMaximize(false, false);
    this.classes.windows.extendCurrentDesktop(true);
  }

  // Focus window when a current desktop is changed
  onCurrentDesktopChanged() {
    this.classes.ui.resetLayout();
    this.setTilesSignals();
    this.classes.timer.start(
      "currentDesktopChanged",
      this.classes.desktops.onTimerCurrentDesktopChangedFinished.bind(
        this.classes.desktops,
        this.classes.ui.checkIfUIVisible(),
      ),
    );
  }

  //Reextend window when desktop is added or removed
  onDesktopsChanged() {
    this.classes.desktops.onDesktopsChanged();
  }

  //Set signal to tiles
  setTilesSignals(screenAll = true) {
    var screens = this.workspace.screens;

    if (screenAll === false) {
      screens = [this.workspace.activeScreen];
    }

    for (var si = 0; si < screens.length; si++) {
      var rootTile = this.classes.tiles.getRootTile(undefined, screens[si]);

      if (rootTile === null) {
        continue;
      }

      if (rootTile._signals !== undefined) {
        for (var key in rootTile._signals) {
          rootTile[key].disconnect(rootTile._signals[key]);
        }
      }

      rootTile._signals = {
        childTilesChanged: this.onChildTilesChanged.bind(this),
        windowAdded: this.onWindowAddedToTile.bind(this, rootTile),
      };

      for (var key in rootTile._signals) {
        rootTile[key].connect(rootTile._signals[key]);
      }
    }

    var tiles = this.classes.tiles.getTilesCurrentDesktop(true, screenAll);

    for (var ti = 0; ti < tiles.length; ti++) {
      var tile = tiles[ti];
      if (tile._signals !== undefined) {
        for (var key in tile._signals) {
          tile[key].disconnect(tile._signals[key]);
        }
      }

      tile._signals = {
        childTilesChanged: this.onChildTilesChanged.bind(this),
        windowAdded: this.onWindowAddedToTile.bind(this, tile),
      };

      for (var key in tile._signals) {
        // Skip windowAdded on container tiles (they have children)
        if (key === "windowAdded" && tile.tiles && tile.tiles.length > 0) {
          continue;
        }
        tile[key].connect(tile._signals[key]);
      }
    }
  }

  //When a tile is added or removed manually (KWin tile editor)
  onChildTilesChanged() {
    if (this.state.avoidChildChanged === true) {
      return;
    }
    // In dynamic mode, just reconnect signals without full reset
    this.state.avoidChildChanged = true;
    this.classes.timer.start("childTilesChanged", () => {
      this.setTilesSignals(false);
      this.classes.windows.extendCurrentDesktop(false);
      this.state.avoidChildChanged = false;
    });
  }

  onStart() {
    this.classes.windows.resetAll(true);
    this.setWindowsSignals();
    this.setTilesSignals();
  }
}
