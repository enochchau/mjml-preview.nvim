local command = vim.api.nvim_create_user_command
local augroup = vim.api.nvim_create_augroup
local autocmd = vim.api.nvim_create_autocmd

vim.g.mjml_preview_debug = true

local dirname = vim.fs.dirname(vim.fn.expand("<sfile>:p"))
local script_path = vim.fn.resolve(dirname .. "/../app/dist/server.js")

command("MjmlPreviewToggle", function()
	if vim.g.mjml_preview_channel == nil then
		require("mjml-preview").spawn_server(script_path)
	else
		require("mjml-preview").kill_job()
	end
end, {})

command("MjmlPreviewOpen", function()
	require("mjml-preview").spawn_server(script_path)
end, {})

command("MjmlPreviewClose", function()
	require("mjml-preview").kill_job()
end, {})

local mjml_preview_group = augroup("MjmlPreview", {})

autocmd("BufDelete", {
	pattern = "*.mjml",
	callback = function()
		require("mjml-preview").kill_job()
	end,
	group = mjml_preview_group,
})
