local M = {}

M.check = function()
	vim.health.report_start("Checking external dependencies")

	if vim.fn.executable("node") ~= 1 then
		vim.health.report_error("NodeJS is not installed. NodeJS 14 must be installed for this plugin to work.")
		return
	end

	local handle = io.popen("node --version")

	if handle ~= nil then
		local binary_version = handle:read("*a")
		handle:close()
		binary_version = binary_version:gsub("%s+", "")

		vim.health.report_info("Found NodeJS " .. binary_version)
	end
end

return M
