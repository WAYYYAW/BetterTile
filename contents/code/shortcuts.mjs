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
          const added = blocklist.toggleWindow(workspace.activeWindow);
          if (added === false) {
            windows.setEmptyTile();
          } else {
            windows.extendCurrentDesktop();
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
        name: "FluidtileIncreaseWidth",
        text: "流体平铺 | 增大窗口宽度",
        sequence: "Meta+Shift+Right",
        callback: () => resize.increaseWidth(),
      },
      {
        name: "FluidtileDecreaseWidth",
        text: "流体平铺 | 减小窗口宽度",
        sequence: "Meta+Shift+Left",
        callback: () => resize.decreaseWidth(),
      },
      {
        name: "FluidtileIncreaseHeight",
        text: "流体平铺 | 增大窗口高度",
        sequence: "Meta+Shift+Up",
        callback: () => resize.increaseHeight(),
      },
      {
        name: "FluidtileDecreaseHeight",
        text: "流体平铺 | 减小窗口高度",
        sequence: "Meta+Shift+Down",
        callback: () => resize.decreaseHeight(),
      },
      {
        name: "FluidtileToggleResizeMode",
        text: "流体平铺 | 显示/隐藏调整大小指示器",
        sequence: "Meta+R",
        callback: () => resize.toggle(),
      },
    ];
  }
}
