# frozen_string_literal: true

module ::DiscourseDataExplorer
  class Engine < ::Rails::Engine
    engine_name PLUGIN_NAME
    isolate_namespace DiscourseDataExplorer
  end
end
