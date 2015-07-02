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

    class ValidationError < StandardError; end

    # Extract :colon-style parameters from the SQL query and replace them with
    # $1-style parameters.
    #
    # @return [Hash] :sql => [String] the new SQL query to run, :names =>
    #   [Array] the names of all parameters, in order by their $-style name.
    #   (The first name is $0.)
    def self.extract_params(sql)
      names = []
      new_sql = sql.gsub(/(:?):([a-z_]+)/) do |_|
        if $1 == ':' # skip casts
          $&
        else
          names << $2
          "$#{names.length - 1}"
        end
      end
      {sql: new_sql, names: names}
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
    def self.run_query(query, params={}, opts={})
      # Safety checks
      if query.sql =~ /;/
        err = DataExplorer::ValidationError.new(I18n.t('js.errors.explorer.no_semicolons'))
        return {error: err, duration_nanos: 0}
      end

      query_args = (query.qopts[:defaults] || {}).with_indifferent_access.merge(params)

      # Rudimentary types
      query_args.each do |k, arg|
        if arg =~ /\A\d+\z/
          query_args[k] = arg.to_i
        end
      end
      # If we don't include this, then queries with a % sign in them fail
      # because AR thinks we want percent-based parametes
      query_args[:xxdummy] = 1

      time_start, time_end, explain, err, result = nil
      begin
        ActiveRecord::Base.connection.transaction do
          # Setting transaction to read only prevents shoot-in-foot actions like SELECT FOR UPDATE
          ActiveRecord::Base.exec_sql "SET TRANSACTION READ ONLY"
          # SQL comments are for the benefits of the slow queries log
          sql = <<SQL

/*
 * DataExplorer Query
 * Query: /admin/plugins/explorer?id=#{query.id}
 * Started by: #{opts[:current_user]}
 * :xxdummy
 */
WITH query AS (
#{query.sql}
) SELECT * FROM query
LIMIT #{opts[:limit] || 1000}
SQL

          time_start = Time.now
          result = ActiveRecord::Base.exec_sql(sql, query_args)
          time_end = Time.now

          if opts[:explain]
            explain = ActiveRecord::Base.exec_sql("-- :xxdummy \nEXPLAIN #{query.sql}", query_args)
                        .map { |row| row["QUERY PLAN"] }.join "\n"
          end

          # All done. Issue a rollback anyways, just in case
          raise ActiveRecord::Rollback
        end
      rescue Exception => ex
        err = ex
        time_end = Time.now
      end

      {
        error: err,
        pg_result: result,
        duration_nanos: time_end.nsec - time_start.nsec,
        explain: explain,
      }
    end

  end

  # Reimplement a couple ActiveRecord methods, but use PluginStore for storage instead
  class DataExplorer::Query
    attr_accessor :id, :name, :description, :sql
    attr_reader :qopts

    def initialize
      @name = 'Unnamed Query'
      @description = 'Enter a description here'
      @sql = 'SELECT 1'
      @qopts = {}
    end

    def param_names
      param_info = DataExplorer.extract_params sql
      param_info[:names]
    end

    def slug
      s = Slug.for(name)
      s = "query-#{id}" unless s.present?
      s
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

    def qopts=(val)
      case val
        when String
          @qopts = HashWithIndifferentAccess.new(MultiJson.load(val))
        when HashWithIndifferentAccess
          @qopts = val
        when Hash
          @qopts = val.with_indifferent_access
        else
          raise ArgumentError.new('invalid type for qopts')
      end
    end

    def self.from_hash(h)
      query = DataExplorer::Query.new
      [:name, :description, :sql, :qopts].each do |sym|
        query.send("#{sym}=", h[sym]) if h[sym]
      end
      if h[:id]
        query.id = h[:id].to_i
      end
      query
    end

    def to_hash
      {
        id: @id,
        name: @name,
        description: @description,
        sql: @sql,
        qopts: @qopts.to_hash,
      }
    end

    def self.find(id, opts={})
      hash = DataExplorer.pstore_get("q:#{id}")
      unless hash
        return DataExplorer::Query.new if opts[:ignore_deleted]
        raise Discourse::NotFound
      end
      from_hash hash
    end

    def save
      unless @id && @id > 0
        @id = self.class.alloc_id
      end
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
      end
    end
  end

  require_dependency 'application_controller'
  class DataExplorer::QueryController < ::ApplicationController
    requires_plugin DataExplorer.plugin_name

    def index
      # guardian.ensure_can_use_data_explorer!
      queries = DataExplorer::Query.all
      render_serialized queries, DataExplorer::QuerySerializer, root: 'queries'
    end

    skip_before_filter :check_xhr, only: [:show]
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

      [:name, :sql, :description, :qopts].each do |sym|
        query.send("#{sym}=", hash[sym]) if hash[sym]
      end
      query.save

      render_serialized query, DataExplorer::QuerySerializer, root: 'query'
    end

    def destroy
      query = DataExplorer::Query.find(params[:id].to_i)
      query.destroy

      render json: {success: true, errors: []}
    end

    # Return value:
    # success - true/false. if false, inspect the errors value.
    # errors - array of strings.
    # params - hash. Echo of the query parameters as executed.
    # duration - float. Time to execute the query, in milliseconds, to 1 decimal place.
    # columns - array of strings. Titles of the returned columns, in order.
    # explain - string. (Optional - pass explain=true in the request) Postgres query plan, UNIX newlines.
    # rows - array of array of strings. Results of the query. In the same order as 'columns'.
    def run
      query = DataExplorer::Query.find(params[:id].to_i)
      query_params = MultiJson.load(params[:params])
      opts = {current_user: current_user.username}
      opts[:explain] = true if params[:explain] == "true"
      opts[:limit] = params[:limit].to_i if params[:limit]
      result = DataExplorer.run_query(query, query_params, opts)

      if result[:error]
        err = result[:error]

        # Pretty printing logic
        err_class = err.class
        err_msg = err.message
        if err.is_a? ActiveRecord::StatementInvalid
          err_class = err.original_exception.class
          err_msg.gsub!("#{err_class.to_s}:", '')
        else
          err_msg = "#{err_class}: #{err_msg}"
        end

        render json: {
                 success: false,
                 errors: [err_msg]
               }
      else
        pg_result = result[:pg_result]
        cols = pg_result.fields
        json = {
          success: true,
          errors: [],
          duration: (result[:duration_nanos].to_f / 1_000_000).round(1),
          columns: cols,
        }
        json[:explain] = result[:explain] if opts[:explain]
        # TODO - special serialization
        # This is dead code in the client right now
        # if cols.any? { |col_name| special_serialization? col_name }
        #   json[:relations] = DataExplorer.add_extra_data(pg_result)
        # end

        json[:rows] = pg_result.values

        render json: json
      end
    end
  end

  class DataExplorer::QuerySerializer < ActiveModel::Serializer
    attributes :id, :sql, :name, :description, :qopts, :param_names
  end

  DataExplorer::Engine.routes.draw do
    root to: "query#index"

    get 'queries' => "query#index"
    post 'queries' => "query#create"
    get 'queries/:id' => "query#show"
    put 'queries/:id' => "query#update"
    delete 'queries/:id' => "query#destroy"
    get 'queries/parse_params' => "query#parse_params"
    post 'queries/:id/run' => "query#run"
  end

  Discourse::Application.routes.append do
    mount ::DataExplorer::Engine, at: '/admin/plugins/explorer', constraints: AdminConstraint.new
  end

end

