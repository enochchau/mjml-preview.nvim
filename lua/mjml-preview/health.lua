local M = {}

M.check = function()
	vim.health.report_start("Checking external dependencies")

	if vim.fn.executable("node") ~= 1 then
		vim.health.report_error("NodeJS is not installed. NodeJS v14 and greater must be installed for this plugin to work.")
		return
	end

	local full_version = vim.fn.trim(vim.fn.system("node --version"))
	vim.health.report_info("Found NodeJS " .. full_version)

	local primary_version = full_version:match("(%d+).(%d+).(%d+)")
	if tonumber(primary_version) < 14 then
		vim.health.report_error("Minimum version not met, this plugin requires v14 and greater")
	end
end

return M
