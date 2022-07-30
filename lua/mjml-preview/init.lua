local loop = vim.loop

local function spawn_server(script_path)
	local channel_id = vim.fn.jobstart({ "node", "--enable-source-maps", script_path }, {
		rpc = true,
		on_exit = function(...)
			print("exiting mjml preview server:")
			vim.pretty_print({ ... })
		end,
		on_stderr = function(...)
			print("stderr:")
			vim.pretty_print({ ... })
		end,
	})
	print("started job with id: ", channel_id)
end

return {
	spawn_server = spawn_server,
}
