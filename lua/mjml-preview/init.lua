local M = {}
local debug = require("mjml-preview.debug")

M.spawn_server = function(script_path)
	if vim.g.mjml_preview_channel ~= nil then
		debug("preview channel is already open")
		return
	end

	vim.g.mjml_preview_channel = vim.fn.jobstart({ "node", "--enable-source-maps", script_path }, {
		rpc = true,
		on_exit = function(...)
			debug("exiting:")
			debug(vim.inspect({ ... }))

			vim.g.mjml_preview_channel = nil
		end,
		on_stderr = function(channel, message, type)
			debug(channel, type, vim.inspect(message))
		end,
	})
end

local function notify(method)
	vim.rpcnotify(vim.g.mjml_preview_channel, method, vim.fn.bufnr("%"))
end

local function request(method)
	return vim.rpcrequest(vim.g.mjml_preview_channel, method, vim.fn.bufnr("%"))
end

M.send_write = function()
	notify("write")
end

M.send_open = function()
	notify("open")
end

M.send_close = function()
	notify("close")
end

M.toggle = function()
	local is_open = request("check_open")
	if is_open == "true" then
		M.send_close()
	else
		M.send_open()
	end
end

M.kill_job = function()
	vim.fn.jobstop(vim.g.mjml_preview_channel)
	vim.g.mjml_preview_channel = nil
end

return M
