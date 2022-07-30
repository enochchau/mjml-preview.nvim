const http = require("http");
const mjml2html = require("mjml");

/**
 * @param {import('neovim').NvimPlugin} plugin
 */
const plugin = (plugin) => {
  plugin.registerCommand(
    "MjmlPreview",
    async () => {
      try {
        let b = await plugin.nvim.buffer;
        const l = await b.lines;
        const m = l.join("\n");
        let o = mjml2html(m);
        console.log(o);
        http
          .createServer((req, res) => {
            res.write(o);
            res.end();
          })
          .listen(8080, "localhost");
      } catch (err) {
        console.error(err);
      }
    },
    { sync: false }
  );
};

module.exports = plugin;
