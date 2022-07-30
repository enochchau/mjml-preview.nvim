local M = {}
local debug = require("mjml-preview.debug")

M.spawn_server = function(script_path)
	if vim.g.mjml_preview_channel ~= nil then
		return
	end

	vim.g.mjml_preview_channel = vim.fn.jobstart({ "node", "--enable-source-maps", script_path }, {
		rpc = true,
		on_exit = function(...)
			debug("exiting mjml preview server:")
			debug(vim.inspect({ ... }))
			vim.g.mjml_preview_channel = nil
		end,
		on_stderr = function(channel, message, type)
			print(channel, type, vim.inspect(message))
		end,
	})
end

M.send_write = function()
	vim.rpcnotify(vim.g.mjml_preview_channel, "write")
end

M.send_close = function()
	vim.rpcnotify(vim.g.mjml_preview_channel, "close")
end

M.kill_job = function()
	vim.fn.jobstop(vim.g.mjml_preview_channel)
end

return M
