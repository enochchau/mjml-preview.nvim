local loop = vim.loop

local dirname = vim.fs.dirname(vim.fn.expand("<sfile>:p"))

vim.api.nvim_create_user_command("MjmlPreview", function()
	local script_path = vim.fn.resolve(dirname .. "/../app/dist/server.js")

	local handle, pid
	local stdout = loop.new_pipe()
	local stderr = loop.new_pipe()
	local stdin = loop.new_pipe()

	handle, pid = loop.spawn("node", {
		args = { script_path },
		stdio = { stdin, stdout, stderr },
	}, function(code, signal)
		stdout:read_stop()
		stdin:read_stop()
		stderr:read_stop()

		stderr:close()
		stdout:close()
		stdin:close()

		handle:close()
	end)
end, {})
