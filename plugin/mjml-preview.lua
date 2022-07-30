local dirname = vim.fs.dirname(vim.fn.expand("<sfile>:p"))

vim.api.nvim_create_user_command("MjmlPreview", function()
	local script_path = vim.fn.resolve(dirname .. "/../app/dist/server.js")
	require("mjml-preview").spawn_server(script_path)
end, {})
