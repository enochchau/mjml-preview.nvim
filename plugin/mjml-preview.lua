local command = vim.api.nvim_create_user_command

vim.g.mjml_preview_debug = true

local dirname = vim.fs.dirname(vim.fn.expand("<sfile>:p"))

command("MjmlPreviewOpen", function()
	if vim.g.mjml_preview_channel == nil then
		local script_path = vim.fn.resolve(dirname .. "/../app/dist/server.js")
		require("mjml-preview").spawn_server(script_path)
	end
	require("mjml-preview").send_open()
end, {})

command("MjmlPreviewClose", function()
	require("mjml-preview").send_close()
end, {})

local mjml_preview_group = vim.api.nvim_create_augroup("MjmlPreview", {})
local function autocmd(events, callback)
	vim.api.nvim_create_autocmd(events, {
		pattern = "*.mjml",
		callback = callback,
		group = mjml_preview_group,
	})
end

autocmd("BufDelete", function()
	require("mjml-preview").send_close()
end)

autocmd({ "TextChanged", "TextChangedI" }, function()
	require("mjml-preview").send_write()
end)