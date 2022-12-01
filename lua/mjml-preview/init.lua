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

local function notify(method, bufnr)
	vim.rpcnotify(vim.g.mjml_preview_channel, method, bufnr)
end

local function request(method, bufnr)
	return vim.rpcrequest(vim.g.mjml_preview_channel, method, bufnr)
end

M.send_write = function(bufnr)
	bufnr = bufnr or vim.fn.bufnr("%")
	notify("write", bufnr)
end

M.send_open = function(bufnr)
	bufnr = bufnr or vim.fn.bufnr("%")
	notify("open", bufnr)
end

M.send_close = function(bufnr)
	bufnr = bufnr or vim.fn.bufnr("%")
	notify("close", bufnr)
end

M.toggle = function(bufnr)
	bufnr = bufnr or vim.fn.bufnr("%")
	local is_open = request("check_open", bufnr)
	debug(bufnr, "has open state: ", is_open)
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

M.is_active = function()
	return vim.g.mjml_preview_channel
end

return M
