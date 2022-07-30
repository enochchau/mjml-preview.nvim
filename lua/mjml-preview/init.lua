local loop = vim.loop

local function spawn_server(script_path)
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
end

return {
	spawn_server = spawn_server,
}
