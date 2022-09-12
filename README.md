# mjml-preview.nvim

Preview [mjml](https://mjml.io/) files in the browser with Neovim.
Mjml is hot reloaded so you'll always see the most updated render.

## Installation

A minimum version of NodeJs 14 is required to run this plugin.

```lua
use { "ec965/mjml-preview.nvim", ft = { "mjml" }, run = "cd app && npm install" }
```

## Commands

```
MjmlPreviewToggle - toggle the mjml preview
MjmlPreviewOpen - Preview mjml for the current buffer
MjmlPreviewClose - Close the mjml preview
```

## Screen shots

MJML is rendered in an iframe.

![Example](./assets/example.png)

Error messages are also displayed in the window.
![Error](./assets/error.png)

## Related Projects

- [vim-mjml](https://github.com/amadeus/vim-mjml)
- [markdown-preview.nvim](https://github.com/iamcco/markdown-preview.nvim)
