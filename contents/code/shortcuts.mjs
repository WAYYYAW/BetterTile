export class Shortcuts {
  constructor(workspace, config, root, { blocklist, windows, tiles, ui, resize }) {
    this.layoutIndex = config.layoutDefault - 1;
    root.shortcuts = [
      {
        name: "FluidtileToggleWindowBlocklist",
        text: "流体平铺 | 将窗口加入/移出黑名单",
        sequence: "Meta+F",
        callback: () => {
          ui.hide(3, true);
          const win = workspace.activeWindow;
          const wasBlocked = blocklist.check(win);
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
        name: "FluidtileChangeTileLayout",
        text: "流体平铺 | 更改平铺布局",
        sequence: "Meta+Alt+F",
        callback: () => {
          const layouts = tiles.getDefaultLayouts();

          tiles.setLayout(
            workspace.currentDesktop,
            layouts[this.layoutIndex],
            false,
          );

          this.layoutIndex =
            this.layoutIndex >= layouts.length - 1 ? 0 : this.layoutIndex + 1;

          ui.show(2);
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
