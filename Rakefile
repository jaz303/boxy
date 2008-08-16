task :copy_assets do
  `rm -rf {test-page/{images,javascripts,stylesheets},docs/{images,javascripts,stylesheets}}`
  `cp -R src/* docs`
  `cp -R src/* test-page`
end
