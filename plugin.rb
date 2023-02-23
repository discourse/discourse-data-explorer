# frozen_string_literal: true

# name: discourse-data-explorer
# about: Interface for running analysis SQL queries on the live database
# version: 0.3
# authors: Riking
# url: https://github.com/discourse/discourse-data-explorer
# transpile_js: true

enabled_site_setting :data_explorer_enabled

module DiscourseDataExplorer
  class Engine < Rails::Engine
  end
end

register_asset "stylesheets/explorer.scss"

register_svg_icon "caret-down"
register_svg_icon "caret-right"
register_svg_icon "chevron-left"
register_svg_icon "exclamation-circle"
register_svg_icon "info"
register_svg_icon "pencil-alt"
register_svg_icon "upload"

# route: /admin/plugins/explorer
add_admin_route "explorer.title", "explorer"

after_initialize do
  module ::DataExplorer
    PLUGIN_NAME = "discourse-data-explorer"

    # This should always match the max value for the data_explorer_query_result_limit
    # site setting.
    QUERY_RESULT_MAX_LIMIT = 10_000

    class Engine < ::Rails::Engine
      engine_name DataExplorer::PLUGIN_NAME
      isolate_namespace DataExplorer
    end
  end

  require_relative "app/controllers/data_explorer/query_controller.rb"
  require_relative "app/jobs/scheduled/delete_hidden_queries.rb"
  require_relative "app/models/data_explorer/query_group.rb"
  require_relative "app/models/data_explorer/query.rb"
  require_relative "app/serializers/data_explorer/query_group_serializer.rb"
  require_relative "app/serializers/data_explorer/query_serializer.rb"
  require_relative "app/serializers/data_explorer/small_badge_serializer.rb"
  require_relative "app/serializers/data_explorer/small_post_with_excerpt_serializer.rb"
  require_relative "app/serializers/user_data_explorer_query_group_bookmark_serializer.rb"
  require_relative "lib/data_explorer.rb"
  require_relative "lib/data_explorer/parameter.rb"
  require_relative "lib/data_explorer/query_group_bookmarkable.rb"
  require_relative "lib/queries.rb"

  DataExplorer::Engine.routes.draw do
    root to: "query#index"
    get "queries" => "query#index"

    scope "/", defaults: { format: :json } do
      get "schema" => "query#schema"
      get "groups" => "query#groups"
      post "queries" => "query#create"
      get "queries/:id" => "query#show"
      put "queries/:id" => "query#update"
      delete "queries/:id" => "query#destroy"
      post "queries/:id/run" => "query#run", :constraints => { format: /(json|csv)/ }
    end
  end

  Discourse::Application.routes.append do
    get "/g/:group_name/reports" => "data_explorer/query#group_reports_index"
    get "/g/:group_name/reports/:id" => "data_explorer/query#group_reports_show"
    post "/g/:group_name/reports/:id/run" => "data_explorer/query#group_reports_run"

    mount ::DataExplorer::Engine, at: "/admin/plugins/explorer"
  end

  add_to_class(:guardian, :user_is_a_member_of_group?) do |group|
    return false if !current_user
    return true if current_user.admin?
    return current_user.group_ids.include?(group.id)
  end

  add_to_class(:guardian, :user_can_access_query?) do |query|
    return false if !current_user
    return true if current_user.admin?
    query.groups.blank? || query.groups.any? { |group| user_is_a_member_of_group?(group) }
  end

  add_to_class(:guardian, :group_and_user_can_access_query?) do |group, query|
    return false if !current_user
    return true if current_user.admin?
    return user_is_a_member_of_group?(group) && query.groups.exists?(id: group.id)
  end

  add_to_serializer(:group_show, :has_visible_data_explorer_queries, false) do
    DataExplorer::Query.for_group(object).exists?
  end

  add_to_serializer(:group_show, :include_has_visible_data_explorer_queries?, false) do
    SiteSetting.data_explorer_enabled && scope.user_is_a_member_of_group?(object)
  end

  # Making DataExplorer::QueryGroup Bookmarkable.
  Bookmark.register_bookmarkable(DataExplorer::QueryGroupBookmarkable)

  add_api_key_scope(
    :data_explorer,
    { run_queries: { actions: %w[data_explorer/query#run], params: %i[id] } },
  )
end
