# name: discourse-data-explorer
# about: Interface for running analysis SQL queries on the live database
# version: 0.1
# authors: Riking
# url: https://github.com/discourse/discourse-data-explorer

enabled_site_setting :data_explorer_enabled
register_asset 'stylesheets/tagging.scss'

# route: /admin/plugins/explorer
add_admin_route 'explorer.title', 'explorer'

module ::DataExplorer
  def self.plugin_name
    'data-explorer'.freeze
  end

  def self.pstore_get(key)
    PluginStore.get(DataExplorer.plugin_name, key)
  end

  def self.pstore_set(key, value)
    PluginStore.set(DataExplorer.plugin_name, key, value)
  end

  def self.pstore_delete(key)
    PluginStore.remove(DataExplorer.plugin_name, key)
  end
end


after_initialize do

  module ::DataExplorer
    class Engine < ::Rails::Engine
      engine_name "data_explorer"
      isolate_namespace DataExplorer
    end

    def self.run_query(query)

    end

    def self.clean_tag(tag)
      tag.downcase.strip[0...SiteSetting.max_tag_length].gsub(TAGS_FILTER_REGEXP, '')
    end

    def self.tags_for_saving(tags, guardian)
      return unless tags

      tags.map! {|t| clean_tag(t) }
      tags.delete_if {|t| t.blank? }
      tags.uniq!

      # If the user can't create tags, remove any tags that don't already exist
      unless guardian.can_create_tag?
        tag_count = TopicCustomField.where(name: TAGS_FIELD_NAME, value: tags).group(:value).count
        tags.delete_if {|t| !tag_count.has_key?(t) }
      end

      return tags[0...SiteSetting.max_tags_per_topic]
    end

    def self.notification_key(tag_id)
      "tags_notification:#{tag_id}"
    end

    def self.auto_notify_for(tags, topic)

      key_names = tags.map {|t| notification_key(t) }
      key_names_sql = ActiveRecord::Base.sql_fragment("(#{tags.map { "'%s'" }.join(', ')})", *key_names)

      sql = <<-SQL
         INSERT INTO topic_users(user_id, topic_id, notification_level, notifications_reason_id)
         SELECT ucf.user_id,
                #{topic.id.to_i},
                CAST(ucf.value AS INTEGER),
                #{TopicUser.notification_reasons[:plugin_changed]}
         FROM user_custom_fields AS ucf
         WHERE ucf.name IN #{key_names_sql}
           AND NOT EXISTS(SELECT 1 FROM topic_users WHERE topic_id = #{topic.id.to_i} AND user_id = ucf.user_id)
           AND CAST(ucf.value AS INTEGER) <> #{TopicUser.notification_levels[:regular]}
      SQL

      ActiveRecord::Base.exec_sql(sql)
    end
  end

  # Reimplement a couple ActiveRecord methods, but use PluginStore for storage instead
  class DataExplorer::Query
    attr_accessor :id, :name, :query, :params

    def self.alloc_id
      DistributedMutex.synchronize('data-explorer_query-id') do
        max_id = DataExplorer.pstore_get("q:_id")
        max_id = 0 unless max_id
        DataExplorer.pstore_set("q:_id", max_id + 1)
        max_id
      end
    end

    def self.from_hash(h)
      query = DataExplorer::Query.new
      [:id, :name, :query].each do |sym|
        query.send("#{sym}=", h[sym])
      end
      #query.params = h[:params] # TODO - what format are the params
      query
    end

    def to_hash
      {
        id: @id,
        name: @name,
        query: @query,
        #params: @params, # TODO - what format are the params
      }
    end

    def self.find(id)
      from_hash DataExplorer.pstore_get("q:#{id}")
    end

    def save
      unless @id
        @id = self.class.alloc_id
      end
      DataExplorer.pstore_set "q:#{id}", to_hash
    end

    def destroy
      DataExplorer.pstore_delete "q:#{id}"
    end

    def self.all
      PluginStoreRow.where(plugin_name: DataExplorer.plugin_name).where("key LIKE 'q:%'").map do |psr|
        DataExplorer::Query.from_hash PluginStore.cast_value(psr.type_name, psr.value)
      end
    end
  end

  require_dependency 'application_controller'
  class DataExplorer::ExplorerController < ::ApplicationController
    include ::TopicListResponder

    requires_plugin 'discourse-tagging'
    skip_before_filter :check_xhr, only: [:tag_feed, :show]
    before_filter :ensure_logged_in, only: [:notifications, :update_notifications]

    def cloud
      cloud = self.class.tags_by_count(guardian, limit: 300).count
      result, max_count, min_count = [], 0, nil
      cloud.each do |t, c|
        result << { id: t, count: c }
        max_count = c if c > max_count
        min_count = c if min_count.nil? || c < min_count
      end

      result.sort_by! {|r| r[:id]}

      render json: { cloud: result, max_count: max_count, min_count: min_count }
    end

    def show
      tag_id = ::DiscourseTagging.clean_tag(params[:tag_id])
      topics_tagged = TopicCustomField.where(name: TAGS_FIELD_NAME, value: tag_id).pluck(:topic_id)

      page = params[:page].to_i

      query = TopicQuery.new(current_user, page: page)
      latest_results = query.latest_results.where(id: topics_tagged)
      @list = query.create_list(:by_tag, {}, latest_results)
      @list.more_topics_url = list_by_tag_path(tag_id: tag_id, page: page + 1)
      @rss = "tag"

      respond_with_list(@list)
    end

    def tag_feed
      discourse_expires_in 1.minute

      tag_id = ::DiscourseTagging.clean_tag(params[:tag_id])
      @link = "#{Discourse.base_url}/tags/#{tag_id}"
      @description = I18n.t("rss_by_tag", tag: tag_id)
      @title = "#{SiteSetting.title} - #{@description}"
      @atom_link = "#{Discourse.base_url}/tags/#{tag_id}.rss"

      query = TopicQuery.new(current_user)
      topics_tagged = TopicCustomField.where(name: TAGS_FIELD_NAME, value: tag_id).pluck(:topic_id)
      latest_results = query.latest_results.where(id: topics_tagged)
      @topic_list = query.create_list(:by_tag, {}, latest_results)

      render 'list/list', formats: [:rss]
    end

    def search
      tags = self.class.tags_by_count(guardian)
      term = params[:q]
      if term.present?
        term.gsub!(/[^a-z0-9]*/, '')
        tags = tags.where('value like ?', "%#{term}%")
      end

      tags = tags.count(:value).map {|t, c| { id: t, text: t, count: c } }

      render json: { results: tags }
    end

    def notifications
      level = current_user.custom_fields[::DiscourseTagging.notification_key(params[:tag_id])] || 1
      render json: { tag_notifications: { id: params[:tag_id], notification_level: level.to_i } }
    end

    def update_notifications
      level = params[:tag_notifications][:notification_level].to_i

      current_user.custom_fields[::DiscourseTagging.notification_key(params[:tag_id])] = level
      current_user.save_custom_fields

      render json: success_json
    end

    private


      def self.tags_by_count(guardian, opts=nil)
        opts = opts || {}
        result = TopicCustomField.where(name: TAGS_FIELD_NAME)
                                 .joins(:topic)
                                 .group(:value)
                                 .limit(opts[:limit] || 5)
                                 .order('COUNT(topic_custom_fields.value) DESC')

        guardian.filter_allowed_categories(result)
      end
  end

  DataExplorer::Engine.routes.draw do
    get '/' => 'tags#cloud'
    get '/filter/cloud' => 'tags#cloud'
    get '/filter/search' => 'tags#search'
    get '/:tag_id.rss' => 'tags#tag_feed'
    get '/:tag_id' => 'tags#show', as: 'list_by_tag'
    get '/:tag_id/notifications' => 'tags#notifications'
    put '/:tag_id/notifications' => 'tags#update_notifications'
  end

  Discourse::Application.routes.append do
    mount ::DataExplorer::Engine, at: "/tags"
  end

  # Add a `tags` reader to the Topic model for easy reading of tags
  add_to_class(:topic, :tags) do
    result = custom_fields[TAGS_FIELD_NAME]
    return [result].flatten if result
  end

  # Save the tags when the topic is saved
  PostRevisor.track_topic_field(:tags_empty_array) do |tc, val|
    if val.present?
      tc.record_change(TAGS_FIELD_NAME, tc.topic.custom_fields[TAGS_FIELD_NAME], nil)
      tc.topic.custom_fields.delete(TAGS_FIELD_NAME)
    end
  end

  PostRevisor.track_topic_field(:tags) do |tc, tags|
    if tags.present?
      tags = ::DataExplorer.tags_for_saving(tags, tc.guardian)

      new_tags = tags - (tc.topic.tags || [])
      tc.record_change(TAGS_FIELD_NAME, tc.topic.custom_fields[TAGS_FIELD_NAME], tags)
      tc.topic.custom_fields.update(TAGS_FIELD_NAME => tags)

      ::DataExplorer.auto_notify_for(new_tags, tc.topic) if new_tags.present?
    end
  end

  on(:topic_created) do |topic, params, user|
    tags = ::DataExplorer.tags_for_saving(params[:tags], Guardian.new(user))
    if tags.present?
      topic.custom_fields.update(TAGS_FIELD_NAME => tags)
      topic.save
      ::DataExplorer.auto_notify_for(tags, topic)
    end
  end

  add_to_class(:guardian, :can_create_tag?) do
    user && user.has_trust_level?(SiteSetting.min_trust_to_create_tag.to_i)
  end

  # Return tag related stuff in JSON output
  TopicViewSerializer.attributes_from_topic(:tags)
  add_to_serializer(:site, :can_create_tag) { scope.can_create_tag? }
  add_to_serializer(:site, :tags_filter_regexp) { TAGS_FILTER_REGEXP.source }

end

