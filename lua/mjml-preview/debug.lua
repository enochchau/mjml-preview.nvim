local DEBUG = vim.g.mjml_preview_debug

return function(...)
	if DEBUG then
		print(...)
	end
end
