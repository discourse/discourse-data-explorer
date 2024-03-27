# frozen_string_literal: true

# name: discourse-data-explorer
# about: Allows you to make SQL queries against your live database, allowing for up-to-the-minute stats reporting.
# meta_topic_id: 32566
# version: 0.3
# authors: Riking
# url: https://github.com/discourse/discourse-data-explorer

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

  GlobalSetting.add_default(:max_data_explorer_api_reqs_per_10_seconds, 2)

  # Available options:
  #   - warn
  #   - warn+block
  #   - block
  GlobalSetting.add_default(:max_data_explorer_api_req_mode, "warn")

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

  add_to_serializer(
    :group_show,
    :has_visible_data_explorer_queries,
    include_condition: -> { scope.user_is_a_member_of_group?(object) },
  ) { DiscourseDataExplorer::Query.for_group(object).exists? }

  register_bookmarkable(DiscourseDataExplorer::QueryGroupBookmarkable)

  add_api_key_scope(
    :discourse_data_explorer,
    { run_queries: { actions: %w[discourse_data_explorer/query#run], params: %i[id] } },
  )

  require_relative "lib/report_generator"
  require_relative "lib/result_to_markdown"
  reloadable_patch do
    if defined?(DiscourseAutomation)
      add_automation_scriptable("recurring_data_explorer_result_pm") do
        queries =
          DiscourseDataExplorer::Query
            .where(hidden: false)
            .map { |q| { id: q.id, translated_name: q.name } }
        field :recipients, component: :email_group_user, required: true
        field :query_id, component: :choices, required: true, extra: { content: queries }
        field :query_params, component: :"key-value", accepts_placeholders: true

        version 1
        triggerables [:recurring]

        script do |_, fields, automation|
          recipients = Array(fields.dig("recipients", "value")).uniq
          query_id = fields.dig("query_id", "value")
          query_params = fields.dig("query_params", "value") || {}

          unless SiteSetting.data_explorer_enabled
            Rails.logger.warn "#{DiscourseDataExplorer::PLUGIN_NAME} - plugin must be enabled to run automation #{automation.id}"
            next
          end

          unless recipients.present?
            Rails.logger.warn "#{DiscourseDataExplorer::PLUGIN_NAME} - couldn't find any recipients for automation #{automation.id}"
            next
          end

          DiscourseDataExplorer::ReportGenerator
            .generate(query_id, query_params, recipients)
            .each do |pm|
              begin
                utils.send_pm(pm, automation_id: automation.id, prefers_encrypt: false)
              rescue ActiveRecord::RecordNotSaved => e
                Rails.logger.warn "#{DiscourseDataExplorer::PLUGIN_NAME} - couldn't send PM for automation #{automation.id}: #{e.message}"
              end
            end
        end
      end
    end
  end
end
