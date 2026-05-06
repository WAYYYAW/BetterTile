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
            win.opacity = 0.82;
            windows.extendCurrentDesktop();
          } else {
            win.opacity = 1.0;
            windows.setEmptyTile();
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
