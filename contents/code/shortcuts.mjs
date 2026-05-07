export class Shortcuts {
  constructor(workspace, config, root, { blocklist, windows, tiles, ui, resize }) {
    root.shortcuts = [
      {
        name: "FluidtileToggleWindowBlocklist",
        text: "流体平铺 | 将窗口加入/移出黑名单",
        sequence: "Meta+F",
        callback: () => {
          ui.hide(3, true);
          const win = workspace.activeWindow;
          const added = blocklist.toggleWindow(win);
          if (added) {
            win.opacity = config.floatingOpacity || 0.82;
            windows.setTilesOnRemove(win);
            win._tileShadow = undefined;

            // Center floating window at 50% of workarea
            const area = workspace.clientArea(workspace.MaximizeArea, workspace.activeScreen, workspace.currentDesktop);
            const fw = Math.round(area.width * 0.5);
            const fh = Math.round(area.height * 0.5);
            win.frameGeometry = Qt.rect(
              area.x + Math.round((area.width - fw) / 2),
              area.y + Math.round((area.height - fh) / 2),
              fw, fh,
            );
          } else {
            win.opacity = 1.0;
            windows.setEmptyTile();
            windows.extendCurrentDesktop(false);
          }
        },
      },
      {
        name: "FluidtileSplitHorizontal",
        text: "流体平铺 | 设置水平分割方向",
        sequence: "Meta+H",
        callback: () => {
          tiles.setSplitDirection(1);
        },
      },
      {
        name: "FluidtileSplitVertical",
        text: "流体平铺 | 设置垂直分割方向",
        sequence: "Meta+V",
        callback: () => {
          tiles.setSplitDirection(2);
        },
      },
      {
        name: "FluidtileToggleResizeMode",
        text: "流体平铺 | 进入/退出窗口大小调整模式",
        sequence: "Meta+R",
        callback: () => resize.toggle(),
      },
    ];
  }
}
