# name: discourse-data-explorer
# about: Interface for running analysis SQL queries on the live database
# version: 0.2
# authors: Riking
# url: https://github.com/discourse/discourse-data-explorer

enabled_site_setting :data_explorer_enabled
register_asset 'stylesheets/explorer.scss'

# route: /admin/plugins/explorer
add_admin_route 'explorer.title', 'explorer'

module ::DataExplorer
  def self.plugin_name
    'discourse-data-explorer'.freeze
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

    class ValidationError < StandardError;
    end

    class SmallBadgeSerializer < ApplicationSerializer
      attributes :id, :name, :badge_type, :description, :icon
    end

    class SmallPostWithExcerptSerializer < ApplicationSerializer
      attributes :id, :topic_id, :post_number, :excerpt
      attributes :username, :avatar_template
      def excerpt
        Post.excerpt(object.cooked, 70)
      end
      def username; object.user && object.user.username; end
      def avatar_template; object.user && object.user.avatar_template; end
    end

    # Run a data explorer query on the currently connected database.
    #
    # @param [DataExplorer::Query] query the Query object to run
    # @param [Hash] params the colon-style query parameters to pass to AR
    # @param [Hash] opts hash of options
    #   explain - include a query plan in the result
    # @return [Hash]
    #   error - any exception that was raised in the execution. Check this
    #     first before looking at any other fields.
    #   pg_result - the PG::Result object
    #   duration_nanos - the query duration, in nanoseconds
    #   explain - the query
    def self.run_query(query, req_params = {}, opts = {})
      # Safety checks
      # see test 'doesn't allow you to modify the database #2'
      if query.sql =~ /;/
        err = DataExplorer::ValidationError.new(I18n.t('js.errors.explorer.no_semicolons'))
        return { error: err, duration_nanos: 0 }
      end

      query_args = {}
      begin
        query_args = query.cast_params req_params
      rescue DataExplorer::ValidationError => e
        return { error: e, duration_nanos: 0 }
      end

      time_start, time_end, explain, err, result = nil
      begin
        ActiveRecord::Base.connection.transaction do
          # Setting transaction to read only prevents shoot-in-foot actions like SELECT FOR UPDATE
          # see test 'doesn't allow you to modify the database #1'
          DB.exec "SET TRANSACTION READ ONLY"
          # Set a statement timeout so we can't tie up the server
          DB.exec "SET LOCAL statement_timeout = 10000"

          # SQL comments are for the benefits of the slow queries log
          sql = <<-SQL
/*
 * DataExplorer Query
 * Query: /admin/plugins/explorer?id=#{query.id}
 * Started by: #{opts[:current_user]}
 */
WITH query AS (
#{query.sql}
) SELECT * FROM query
LIMIT #{opts[:limit] || 250}
SQL

          time_start = Time.now

          # we probably want to rewrite this ... but for now reuse the working
          # code we have
          sql = DB.param_encoder.encode(sql, query_args)

          result = ActiveRecord::Base.connection.raw_connection.async_exec(sql)
          result.check # make sure it's done
          time_end = Time.now

          if opts[:explain]
            explain = DB.query_hash("EXPLAIN #{query.sql}", query_args)
              .map { |row| row["QUERY PLAN"] }.join "\n"
          end

          # All done. Issue a rollback anyways, just in case
          # see test 'doesn't allow you to modify the database #1'
          raise ActiveRecord::Rollback
        end
      rescue Exception => ex
        err = ex
        time_end = Time.now
      end

      {
        error: err,
        pg_result: result,
        duration_secs: time_end - time_start,
        explain: explain,
        params_full: query_args
      }
    end

    def self.extra_data_pluck_fields
      @extra_data_pluck_fields ||= {
        user: { class: User, fields: [:id, :username, :uploaded_avatar_id], serializer: BasicUserSerializer },
        badge: { class: Badge, fields: [:id, :name, :badge_type_id, :description, :icon], include: [:badge_type], serializer: SmallBadgeSerializer },
        post: { class: Post, fields: [:id, :topic_id, :post_number, :cooked, :user_id], include: [:user], serializer: SmallPostWithExcerptSerializer },
        topic: { class: Topic, fields: [:id, :title, :slug, :posts_count], serializer: BasicTopicSerializer },
        group: { class: Group, ignore: true },
        category: { class: Category, ignore: true },
        reltime: { ignore: true },
        html: { ignore: true },
      }
    end

    def self.column_regexes
      @column_regexes ||=
        extra_data_pluck_fields.map do |key, val|
          if val[:class]
            /(#{val[:class].to_s.downcase})_id$/
          end
        end.compact
    end

    def self.add_extra_data(pg_result)
      needed_classes = {}

      pg_result.fields.each_with_index do |col, idx|
        rgx = column_regexes.find { |rgx| rgx.match col }
        if rgx
          cls = (rgx.match col)[1].to_sym
          needed_classes[cls] ||= []
          needed_classes[cls] << idx
        elsif col =~ /^(\w+)\$/
          cls = $1.to_sym
          needed_classes[cls] ||= []
          needed_classes[cls] << idx
        end
      end

      ret = {}
      col_map = {}
      needed_classes.each do |cls, column_nums|
        next unless column_nums.present?
        support_info = extra_data_pluck_fields[cls]
        next unless support_info

        column_nums.each do |col_n|
          col_map[col_n] = cls
        end

        if support_info[:ignore]
          ret[cls] = []
          next
        end

        ids = Set.new
        column_nums.each do |col_n|
          ids.merge(pg_result.column_values(col_n))
        end
        ids.delete nil
        ids.map! &:to_i

        object_class = support_info[:class]
        all_objs = object_class
        all_objs = all_objs.with_deleted if all_objs.respond_to? :with_deleted
        all_objs = all_objs
          .select(support_info[:fields])
          .where(id: ids.to_a.sort)
          .includes(support_info[:include])
          .order(:id)

        ret[cls] = ActiveModel::ArraySerializer.new(all_objs, each_serializer: support_info[:serializer])
      end
      [ret, col_map]
    end

    def self.sensitive_column_names
      %w(
        #_IP_Addresses
        topic_views.ip_address
        users.ip_address
        users.registration_ip_address
        incoming_links.ip_address
        topic_link_clicks.ip_address
        user_histories.ip_address

        #_Emails
        email_tokens.email
        users.email
        invites.email
        user_histories.email
        email_logs.to_address
        posts.raw_email
        badge_posts.raw_email

        #_Secret_Tokens
        email_tokens.token
        email_logs.reply_key
        api_keys.key
        site_settings.value

        users.auth_token
        users.password_hash
        users.salt

        #_Authentication_Info
        user_open_ids.email
        oauth2_user_infos.uid
        oauth2_user_infos.email
        facebook_user_infos.facebook_user_id
        facebook_user_infos.email
        twitter_user_infos.twitter_user_id
        github_user_infos.github_user_id
        single_sign_on_records.external_email
        single_sign_on_records.external_id
        google_user_infos.google_user_id
        google_user_infos.email
      )
    end

    def self.schema
      # No need to expire this, because the server processes get restarted on upgrade
      # refer user to http://www.postgresql.org/docs/9.3/static/datatype.html
      @schema ||= begin
        results = DB.query_hash <<~SQL
          select
            c.column_name column_name,
            c.data_type data_type,
            c.character_maximum_length character_maximum_length,
            c.is_nullable is_nullable,
            c.column_default column_default,
            c.table_name table_name,
            pgd.description column_desc
          from INFORMATION_SCHEMA.COLUMNS c
          inner join pg_catalog.pg_statio_all_tables st on (c.table_schema = st.schemaname and c.table_name = st.relname)
          left outer join pg_catalog.pg_description pgd on (pgd.objoid = st.relid and pgd.objsubid = c.ordinal_position)
          where c.table_schema = 'public'
          ORDER BY c.table_name, c.ordinal_position
        SQL

        by_table = {}
        # Massage the results into a nicer form
        results.each do |hash|
          full_col_name = "#{hash['table_name']}.#{hash['column_name']}"

          if hash['is_nullable'] == "YES"
            hash['is_nullable'] = true
          else
            hash.delete('is_nullable')
          end
          clen = hash.delete 'character_maximum_length'
          dt = hash['data_type']
          if hash['column_name'] == 'id'
            hash['data_type'] = 'serial'
            hash['primary'] = true
          elsif dt == 'character varying'
            hash['data_type'] = "varchar(#{clen.to_i})"
          elsif dt == 'timestamp without time zone'
            hash['data_type'] = 'timestamp'
          elsif dt == 'double precision'
            hash['data_type'] = 'double'
          end
          default = hash['column_default']
          if default.nil? || default =~ /^nextval\(/
            hash.delete 'column_default'
          elsif default =~ /^'(.*)'::(character varying|text)/
            hash['column_default'] = $1
          end
          hash.delete('column_desc') unless hash['column_desc']

          if sensitive_column_names.include? full_col_name
            hash['sensitive'] = true
          end
          if enum_info.include? full_col_name
            hash['enum'] = enum_info[full_col_name]
          end
          if denormalized_columns.include? full_col_name
            hash['denormal'] = denormalized_columns[full_col_name]
          end
          fkey = fkey_info(hash['table_name'], hash['column_name'])
          if fkey
            hash['fkey_info'] = fkey
          end

          table_name = hash.delete('table_name')
          by_table[table_name] ||= []
          by_table[table_name] << hash
        end

        # this works for now, but no big loss if the tables aren't quite sorted
        favored_order = %w(posts topics users categories badges groups notifications post_actions site_settings)
        sorted_by_table = {}
        favored_order.each do |tbl|
          sorted_by_table[tbl] = by_table[tbl]
        end
        by_table.keys.sort.each do |tbl|
          next if favored_order.include? tbl
          sorted_by_table[tbl] = by_table[tbl]
        end
        sorted_by_table
      end
    end

    def self.enums
      @enums ||= {
        'badges.badge_type_id': Enum.new(:gold, :silver, :bronze, start: 1),
        'category_groups.permission_type': CategoryGroup.permission_types,
        'directory_items.period_type': DirectoryItem.period_types,
        'groups.alias_level': Group::ALIAS_LEVELS,
        'groups.id': Group::AUTO_GROUPS,
        'notifications.notification_type': Notification.types,
        'posts.cook_method': Post.cook_methods,
        'posts.hidden_reason_id': Post.hidden_reasons,
        'posts.post_type': Post.types,
        'post_actions.post_action_type_id': PostActionType.types,
        'post_action_types.id': PostActionType.types,
        'queued_posts.state': QueuedPost.states,
        'site_settings.data_type': SiteSetting.types,
        'topic_users.notification_level': TopicUser.notification_levels,
        'topic_users.notifications_reason_id': TopicUser.notification_reasons,
        'user_histories.action': UserHistory.actions,
        'users.trust_level': TrustLevel.levels,
      }.with_indifferent_access
    end

    def self.enum_info
      @enum_info ||= begin
        enum_info = {}
        enums.map do |key, enum|
          # https://stackoverflow.com/questions/10874356/reverse-a-hash-in-ruby
          enum_info[key] = Hash[enum.to_a.map(&:reverse)]
        end
        enum_info
      end
    end

    def self.fkey_info(table, column)
      full_name = "#{table}.#{column}"

      if fkey_defaults[column]
        fkey_defaults[column]
      elsif column =~ /_by_id$/ || column =~ /_user_id$/
        :users
      elsif foreign_keys[full_name]
        foreign_keys[full_name]
      else
        nil
      end
    end

    def self.foreign_keys
      @fkey_columns ||= {
        'posts.last_editor_id': :users,
        'posts.version': :'post_revisions.number',

        'topics.featured_user1_id': :users,
        'topics.featured_user2_id': :users,
        'topics.featured_user3_id': :users,
        'topics.featured_user4_id': :users,
        'topics.featured_user5_id': :users,

        'users.seen_notification_id': :notifications,
        'users.uploaded_avatar_id': :uploads,
        'users.primary_group_id': :groups,

        'categories.latest_post_id': :posts,
        'categories.latest_topic_id': :topics,
        'categories.parent_category_id': :categories,

        'badges.badge_grouping_id': :badge_groupings,

        'post_actions.related_post_id': :posts,

        'color_scheme_colors.color_scheme_id': :color_schemes,
        'color_schemes.versioned_id': :color_schemes,

        'incoming_links.incoming_referer_id': :incoming_referers,
        'incoming_referers.incoming_domain_id': :incoming_domains,

        'post_replies.reply_id': :posts,

        'quoted_posts.quoted_post_id': :posts,

        'topic_link_clicks.topic_link_id': :topic_links,
        'topic_link_clicks.link_topic_id': :topics,
        'topic_link_clicks.link_post_id': :posts,

        'user_actions.target_topic_id': :topics,
        'user_actions.target_post_id': :posts,

        'user_avatars.custom_upload_id': :uploads,
        'user_avatars.gravatar_upload_id': :uploads,

        'user_badges.notification_id': :notifications,

        'user_profiles.card_image_badge_id': :badges,
      }.with_indifferent_access
    end

    def self.fkey_defaults
      @fkey_defaults ||= {
        user_id: :users,
        # :*_by_id    => :users,
        # :*_user_id  => :users,

        category_id: :categories,
        group_id: :groups,
        post_id: :posts,
        post_action_id: :post_actions,
        topic_id: :topics,
        upload_id: :uploads,

      }.with_indifferent_access
    end

    def self.denormalized_columns
      {
        'posts.reply_count': :post_replies,
        'posts.quote_count': :quoted_posts,
        'posts.incoming_link_count': :topic_links,
        'posts.word_count': :posts,
        'posts.avg_time': :post_timings,
        'posts.reads': :post_timings,
        'posts.like_score': :post_actions,

        'posts.like_count': :post_actions,
        'posts.bookmark_count': :post_actions,
        'posts.vote_count': :post_actions,
        'posts.off_topic_count': :post_actions,
        'posts.notify_moderators_count': :post_actions,
        'posts.spam_count': :post_actions,
        'posts.illegal_count': :post_actions,
        'posts.inappropriate_count': :post_actions,
        'posts.notify_user_count': :post_actions,

        'topics.views': :topic_views,
        'topics.posts_count': :posts,
        'topics.reply_count': :posts,
        'topics.incoming_link_count': :topic_links,
        'topics.moderator_posts_count': :posts,
        'topics.participant_count': :posts,
        'topics.word_count': :posts,
        'topics.last_posted_at': :posts,
        'topics.last_post_user_idt': :posts,
        'topics.avg_time': :post_timings,
        'topics.highest_post_number': :posts,
        'topics.image_url': :posts,
        'topics.excerpt': :posts,

        'topics.like_count': :post_actions,
        'topics.bookmark_count': :post_actions,
        'topics.vote_count': :post_actions,
        'topics.off_topic_count': :post_actions,
        'topics.notify_moderators_count': :post_actions,
        'topics.spam_count': :post_actions,
        'topics.illegal_count': :post_actions,
        'topics.inappropriate_count': :post_actions,
        'topics.notify_user_count': :post_actions,

        'categories.topic_count': :topics,
        'categories.post_count': :posts,
        'categories.latest_post_id': :posts,
        'categories.latest_topic_id': :topics,
        'categories.description': :posts,
        'categories.read_restricted': :category_groups,
        'categories.topics_year': :topics,
        'categories.topics_month': :topics,
        'categories.topics_week': :topics,
        'categories.topics_day': :topics,
        'categories.posts_year': :posts,
        'categories.posts_month': :posts,
        'categories.posts_week': :posts,
        'categories.posts_day': :posts,

        'badges.grant_count': :user_badges,
        'groups.user_count': :group_users,

        'directory_items.likes_received': :post_actions,
        'directory_items.likes_given': :post_actions,
        'directory_items.topics_entered': :user_stats,
        'directory_items.days_visited': :user_stats,
        'directory_items.posts_read': :user_stats,
        'directory_items.topic_count': :topics,
        'directory_items.post_count': :posts,

        'post_search_data.search_data': :posts,

        'top_topics.yearly_posts_count': :posts,
        'top_topics.monthly_posts_count': :posts,
        'top_topics.weekly_posts_count': :posts,
        'top_topics.daily_posts_count': :posts,
        'top_topics.yearly_views_count': :topic_views,
        'top_topics.monthly_views_count': :topic_views,
        'top_topics.weekly_views_count': :topic_views,
        'top_topics.daily_views_count': :topic_views,
        'top_topics.yearly_likes_count': :post_actions,
        'top_topics.monthly_likes_count': :post_actions,
        'top_topics.weekly_likes_count': :post_actions,
        'top_topics.daily_likes_count': :post_actions,
        'top_topics.yearly_op_likes_count': :post_actions,
        'top_topics.monthly_op_likes_count': :post_actions,
        'top_topics.weekly_op_likes_count': :post_actions,
        'top_topics.daily_op_likes_count': :post_actions,
        'top_topics.all_score': :posts,
        'top_topics.yearly_score': :posts,
        'top_topics.monthly_score': :posts,
        'top_topics.weekly_score': :posts,
        'top_topics.daily_score': :posts,

        'topic_links.clicks': :topic_link_clicks,
        'topic_search_data.search_data': :topics,

        'topic_users.liked': :post_actions,
        'topic_users.bookmarked': :post_actions,

        'user_stats.posts_read_count': :post_timings,
        'user_stats.topic_reply_count': :posts,
        'user_stats.first_post_created_at': :posts,
        'user_stats.post_count': :posts,
        'user_stats.topic_count': :topics,
        'user_stats.likes_given': :post_actions,
        'user_stats.likes_received': :post_actions,

        'user_search_data.search_data': :user_profiles,

        'users.last_posted_at': :posts,
        'users.previous_visit_at': :user_visits,
      }.with_indifferent_access
    end
  end

  # Reimplement a couple ActiveRecord methods, but use PluginStore for storage instead
  class DataExplorer::Query
    attr_accessor :id, :name, :description, :sql, :created_by, :created_at, :username

    def initialize
      @name = 'Unnamed Query'
      @description = 'Enter a description here'
      @sql = 'SELECT 1'
    end

    def slug
      Slug.for(name).presence || "query-#{id}"
    end

    def params
      @params ||= DataExplorer::Parameter.create_from_sql(sql)
    end

    def check_params!
      DataExplorer::Parameter.create_from_sql(sql, strict: true)
      nil
    end

    def cast_params(input_params)
      result = {}.with_indifferent_access
      self.params.each do |pobj|
        result[pobj.identifier] = pobj.cast_to_ruby input_params[pobj.identifier]
      end
      result
    end

    # saving/loading functions
    # May want to extract this into a library or something for plugins to use?
    def self.alloc_id
      DistributedMutex.synchronize('data-explorer_query-id') do
        max_id = DataExplorer.pstore_get("q:_id")
        max_id = 1 unless max_id
        DataExplorer.pstore_set("q:_id", max_id + 1)
        max_id
      end
    end

    def self.from_hash(h)
      query = DataExplorer::Query.new
      [:name, :description, :sql, :created_by, :created_at, :username].each do |sym|
        query.send("#{sym}=", h[sym].strip) if h[sym]
      end
      query.id = h[:id].to_i if h[:id]
      query
    end

    def to_hash
      {
        id: @id,
        name: @name,
        description: @description,
        sql: @sql,
        created_by: @created_by,
        created_at: @created_at,
        username: @username
      }
    end

    def self.find(id, opts = {})
      unless hash = DataExplorer.pstore_get("q:#{id}")
        return DataExplorer::Query.new if opts[:ignore_deleted]
        raise Discourse::NotFound
      end
      from_hash hash
    end

    def save
      check_params!
      @id = self.class.alloc_id unless @id && @id > 0
      DataExplorer.pstore_set "q:#{id}", to_hash
    end

    def destroy
      DataExplorer.pstore_delete "q:#{id}"
    end

    def read_attribute_for_serialization(attr)
      self.send(attr)
    end

    def self.all
      PluginStoreRow.where(plugin_name: DataExplorer.plugin_name)
        .where("key LIKE 'q:%'")
        .where("key != 'q:_id'")
        .map do |psr|
          DataExplorer::Query.from_hash PluginStore.cast_value(psr.type_name, psr.value)
        end.sort_by { |query| query.name }
    end

    def self.destroy_all
      PluginStoreRow.where(plugin_name: DataExplorer.plugin_name)
        .where("key LIKE 'q:%'")
        .destroy_all
    end
  end

  class DataExplorer::Parameter
    attr_accessor :identifier, :type, :default, :nullable

    def initialize(identifier, type, default, nullable)
      raise DataExplorer::ValidationError.new('Parameter declaration error - identifier is missing') unless identifier
      raise DataExplorer::ValidationError.new('Parameter declaration error - type is missing') unless type
      # process aliases
      type = type.to_sym
      if DataExplorer::Parameter.type_aliases[type]
        type = DataExplorer::Parameter.type_aliases[type]
      end
      raise DataExplorer::ValidationError.new("Parameter declaration error - unknown type #{type}") unless DataExplorer::Parameter.types[type]

      @identifier = identifier
      @type = type
      @default = default
      @nullable = nullable
      begin
        cast_to_ruby default unless default.blank?
      rescue DataExplorer::ValidationError
        raise DataExplorer::ValidationError.new("Parameter declaration error - the default value is not a valid #{type}")
      end
    end

    def to_hash
      {
        identifier: @identifier,
        type: @type,
        default: @default,
        nullable: @nullable,
      }
    end

    def self.types
      @types ||= Enum.new(
        # Normal types
        :int, :bigint, :boolean, :string, :date, :time, :datetime, :double,
        # Selection help
        :user_id, :post_id, :topic_id, :category_id, :group_id, :badge_id,
        # Arrays
        :int_list, :string_list, :user_list
      )
    end

    def self.type_aliases
      @type_aliases ||= {
        integer: :int,
        text: :string,
        timestamp: :datetime,
      }
    end

    def cast_to_ruby(string)
      string = @default unless string

      if string.blank?
        if @nullable
          return nil
        else
          raise DataExplorer::ValidationError.new("Missing parameter #{identifier} of type #{type}")
        end
      end
      if string.downcase == '#null'
        return nil
      end

      def invalid_format(string, msg = nil)
        if msg
          raise DataExplorer::ValidationError.new("'#{string}' is an invalid #{type} - #{msg}")
        else
          raise DataExplorer::ValidationError.new("'#{string}' is an invalid value for #{type}")
        end
      end

      value = nil

      case @type
      when :int
        invalid_format string, 'Not an integer' unless string =~ /^-?\d+$/
        value = string.to_i
        invalid_format string, 'Too large' unless Integer === value
      when :bigint
        invalid_format string, 'Not an integer' unless string =~ /^-?\d+$/
        value = string.to_i
      when :boolean
        value = !!(string =~ /t|true|y|yes|1/i)
      when :string
        value = string
      when :time
        begin
          value = Time.parse string
        rescue ArgumentError => e
          invalid_format string, e.message
        end
      when :date
        begin
          value = Date.parse string
        rescue ArgumentError => e
          invalid_format string, e.message
        end
      when :datetime
        begin
          value = DateTime.parse string
        rescue ArgumentError => e
          invalid_format string, e.message
        end
      when :double
        if string =~ /-?\d*(\.\d+)/
          value = Float(string)
        elsif string =~ /^(-?)Inf(inity)?$/i
          if $1
            value = -Float::INFINITY
          else
            value = Float::INFINITY
          end
        elsif string =~ /^(-?)NaN$/i
          if $1
            value = -Float::NAN
          else
            value = Float::NAN
          end
        else
          invalid_format string
        end
      when :category_id
        if string =~ /(.*)\/(.*)/
          parent_name = $1
          child_name = $2
          parent = Category.query_parent_category(parent_name)
          invalid_format string, "Could not find category named #{parent_name}" unless parent
          object = Category.query_category(child_name, parent)
          invalid_format string, "Could not find subcategory of #{parent_name} named #{child_name}" unless object
        else
          object = Category.where(id: string.to_i).first || Category.where(slug: string).first || Category.where(name: string).first
          invalid_format string, "Could not find category named #{string}" unless object
        end

        value = object.id
      when :user_id, :post_id, :topic_id, :group_id, :badge_id
        if string.gsub(/[ _]/, '') =~ /^-?\d+$/
          clazz_name = (/^(.*)_id$/.match(type.to_s)[1].classify.to_sym)
          begin
            object = Object.const_get(clazz_name).with_deleted.find(string.gsub(/[ _]/, '').to_i)
            value = object.id
          rescue ActiveRecord::RecordNotFound
            invalid_format string, "The specified #{clazz_name} was not found"
          end
        elsif type == :user_id
          begin
            object = User.find_by_username_or_email(string)
            value = object.id
          rescue ActiveRecord::RecordNotFound
            invalid_format string, "The user named #{string} was not found"
          end
        elsif type == :post_id
          if string =~ /(\d+)\/(\d+)(\?u=.*)?$/
            object = Post.with_deleted.find_by(topic_id: $1, post_number: $2)
            invalid_format string, "The post at topic:#{$1} post_number:#{$2} was not found" unless object
            value = object.id
          end
        elsif type == :topic_id
          if string =~ /\/t\/[^\/]+\/(\d+)/
            begin
              object = Topic.with_deleted.find($1)
              value = object.id
            rescue ActiveRecord::RecordNotFound
              invalid_format string, "The topic with id #{$1} was not found"
            end
          end
        elsif type == :group_id
          object = Group.where(name: string).first
          invalid_format string, "The group named #{string} was not found" unless object
          value = object.id
        else
          invalid_format string
        end
      when :int_list
        value = string.split(',').map { |s| s.downcase == '#null' ? nil : s.to_i }
        invalid_format string, "can't be empty" if value.length == 0
      when :string_list
        value = string.split(',').map { |s| s.downcase == '#null' ? nil : s }
        invalid_format string, "can't be empty" if value.length == 0
      when :user_list
        value = string.split(',').map { |s| User.find_by_username_or_email(s) }
        invalid_format string, "can't be empty" if value.length == 0
      else
        raise TypeError.new('unknown parameter type??? should not get here')
      end

      value
    end

    def self.create_from_sql(sql, opts = {})
      in_params = false
      ret_params = []
      sql.lines.find do |line|
        line.chomp!

        if in_params
          # -- (ident) :(ident) (= (ident))?

          if line =~ /^\s*--\s*([a-zA-Z_ ]+)\s*:([a-z_]+)\s*(?:=\s+(.*)\s*)?$/
            type = $1
            ident = $2
            default = $3
            nullable = false
            if type =~ /^(null)?(.*?)(null)?$/i
              if $1 || $3
                nullable = true
              end
              type = $2
            end
            type = type.strip

            begin
              ret_params << DataExplorer::Parameter.new(ident, type, default, nullable)
            rescue
              if opts[:strict]
                raise
              end
            end

            false
          elsif line =~ /^\s+$/
            false
          else
            true
          end

        else
          if line =~ /^\s*--\s*\[params\]\s*$/
            in_params = true
          end
          false
        end
      end
      return ret_params
    end
  end

  require_dependency 'application_controller'
  class DataExplorer::QueryController < ::ApplicationController
    requires_plugin DataExplorer.plugin_name

    before_action :check_enabled

    def check_enabled
      raise Discourse::NotFound unless SiteSetting.data_explorer_enabled?
    end

    def index
      # guardian.ensure_can_use_data_explorer!
      queries = DataExplorer::Query.all
      render_serialized queries, DataExplorer::QuerySerializer, root: 'queries'
    end

    skip_before_action :check_xhr, only: [:show]
    def show
      check_xhr unless params[:export]

      query = DataExplorer::Query.find(params[:id].to_i)

      if params[:export]
        response.headers['Content-Disposition'] = "attachment; filename=#{query.slug}.dcquery.json"
        response.sending_file = true
      end

      # guardian.ensure_can_see! query
      render_serialized query, DataExplorer::QuerySerializer, root: 'query'
    end

    def create
      # guardian.ensure_can_create_explorer_query!

      query = DataExplorer::Query.from_hash params.require(:query)
      query.created_by = current_user.id.to_s
      query.created_at = Time.now.strftime("%b %e, %Y")
      query.username = current_user.username
      query.id = nil # json import will assign an id, which is wrong
      query.save

      render_serialized query, DataExplorer::QuerySerializer, root: 'query'
    end

    def update
      query = DataExplorer::Query.find(params[:id].to_i, ignore_deleted: true)
      hash = params.require(:query)

      # Undeleting
      unless query.id
        if hash[:id]
          query.id = hash[:id].to_i
        else
          raise Discourse::NotFound
        end
      end

      [:name, :sql, :description].each do |sym|
        query.send("#{sym}=", hash[sym]) if hash[sym]
      end

      query.check_params!
      query.save

      render_serialized query, DataExplorer::QuerySerializer, root: 'query'
    rescue DataExplorer::ValidationError => e
      render_json_error e.message
    end

    def destroy
      query = DataExplorer::Query.find(params[:id].to_i)
      query.destroy

      render json: { success: true, errors: [] }
    end

    def schema
      schema_version = DB.query_single("SELECT max(version) AS tag FROM schema_migrations").first
      if stale?(public: true, etag: schema_version, template: false)
        render json: DataExplorer.schema
      end
    end

    skip_before_action :check_xhr, only: [:run]
    # Return value:
    # success - true/false. if false, inspect the errors value.
    # errors - array of strings.
    # params - hash. Echo of the query parameters as executed.
    # duration - float. Time to execute the query, in milliseconds, to 1 decimal place.
    # columns - array of strings. Titles of the returned columns, in order.
    # explain - string. (Optional - pass explain=true in the request) Postgres query plan, UNIX newlines.
    # rows - array of array of strings. Results of the query. In the same order as 'columns'.
    def run
      check_xhr unless params[:download]
      query = DataExplorer::Query.find(params[:id].to_i)
      if params[:download]
        response.sending_file = true
      end

      params[:params] = params[:_params] if params[:_params] # testing workaround
      query_params = {}
      query_params = MultiJson.load(params[:params]) if params[:params]

      opts = { current_user: current_user.username }
      opts[:explain] = true if params[:explain] == "true"

      opts[:limit] = "ALL" if params[:format] == "csv"
      opts[:limit] = params[:limit].to_i if params[:limit]

      result = DataExplorer.run_query(query, query_params, opts)

      if result[:error]
        err = result[:error]

        # Pretty printing logic
        err_class = err.class
        err_msg = err.message
        if err.is_a? ActiveRecord::StatementInvalid
          err_class = err.original_exception.class
          err_msg.gsub!("#{err_class}:", '')
        else
          err_msg = "#{err_class}: #{err_msg}"
        end

        render json: {
                 success: false,
                 errors: [err_msg]
               }, status: 422
      else
        pg_result = result[:pg_result]
        cols = pg_result.fields
        respond_to do |format|
          format.json do
            if params[:download]
              response.headers['Content-Disposition'] =
                "attachment; filename=#{query.slug}@#{Slug.for(Discourse.current_hostname, 'discourse')}-#{Date.today}.dcqresult.json"
            end
            json = {
              success: true,
              errors: [],
              duration: (result[:duration_secs].to_f * 1000).round(1),
              params: query_params,
              columns: cols,
            }
            json[:explain] = result[:explain] if opts[:explain]
            ext = DataExplorer.add_extra_data(pg_result)
            json[:colrender] = ext[1]
            json[:relations] = ext[0]

            json[:rows] = pg_result.values

            render json: json
          end
          format.csv do
            response.headers['Content-Disposition'] =
              "attachment; filename=#{query.slug}@#{Slug.for(Discourse.current_hostname, 'discourse')}-#{Date.today}.dcqresult.csv"

            require 'csv'
            text = CSV.generate do |csv|
              csv << cols
              pg_result.values.each do |row|
                csv << row
              end
            end

            render plain: text
          end
        end
      end
    end
  end

  class DataExplorer::QuerySerializer < ActiveModel::Serializer
    attributes :id, :sql, :name, :description, :param_info, :created_by, :created_at, :username

    def param_info
      object.params.map(&:to_hash) rescue nil
    end
  end

  DataExplorer::Engine.routes.draw do
    root to: "query#index"
    get 'schema' => "query#schema"
    get 'queries' => "query#index"
    post 'queries' => "query#create"
    get 'queries/:id' => "query#show"
    put 'queries/:id' => "query#update"
    delete 'queries/:id' => "query#destroy"
    post 'queries/:id/run' => "query#run"
  end

  Discourse::Application.routes.append do
    mount ::DataExplorer::Engine, at: '/admin/plugins/explorer', constraints: AdminConstraint.new
  end
end
