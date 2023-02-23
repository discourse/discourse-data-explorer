# frozen_string_literal: true

# name: discourse-data-explorer
# about: Interface for running analysis SQL queries on the live database
# version: 0.3
# authors: Riking
# url: https://github.com/discourse/discourse-data-explorer
# transpile_js: true

enabled_site_setting :data_explorer_enabled

register_asset "stylesheets/explorer.scss"

register_svg_icon "caret-down"
register_svg_icon "caret-right"
register_svg_icon "chevron-left"
register_svg_icon "exclamation-circle"
register_svg_icon "info"
register_svg_icon "pencil-alt"
register_svg_icon "upload"

add_admin_route "explorer.title", "explorer"

module ::DiscourseDataExplorer
  PLUGIN_NAME = "discourse-data-explorer"

  # This should always match the max value for the
  # data_explorer_query_result_limit site setting
  QUERY_RESULT_MAX_LIMIT = 10_000
end

require_relative "lib/discourse_data_explorer/engine"

after_initialize do
  require_relative "app/jobs/scheduled/delete_hidden_queries"
  require_relative "lib/discourse_data_explorer/data_explorer"
  require_relative "lib/discourse_data_explorer/parameter"
  require_relative "lib/discourse_data_explorer/queries"
  require_relative "lib/discourse_data_explorer/query_group_bookmarkable"

  add_to_class(:guardian, :user_is_a_member_of_group?) do |group|
    return false if !current_user
    return true if current_user.admin?
    current_user.group_ids.include?(group.id)
  end

  add_to_class(:guardian, :user_can_access_query?) do |query|
    return false if !current_user
    return true if current_user.admin?
    query.groups.blank? || query.groups.any? { |group| user_is_a_member_of_group?(group) }
  end

  add_to_class(:guardian, :group_and_user_can_access_query?) do |group, query|
    return false if !current_user
    return true if current_user.admin?
    user_is_a_member_of_group?(group) && query.groups.exists?(id: group.id)
  end

  add_to_serializer(:group_show, :has_visible_data_explorer_queries, false) do
    DiscourseDataExplorer::Query.for_group(object).exists?
  end

  add_to_serializer(:group_show, :include_has_visible_data_explorer_queries?, false) do
    SiteSetting.data_explorer_enabled && scope.user_is_a_member_of_group?(object)
  end

  register_bookmarkable(DiscourseDataExplorer::QueryGroupBookmarkable)

  add_api_key_scope(
    :discourse_data_explorer,
    { run_queries: { actions: %w[discourse_data_explorer/query#run], params: %i[id] } },
  )
end
