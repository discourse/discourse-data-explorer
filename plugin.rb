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
      new_sql = sql.gsub(/:([a-z_]+)/) do |_|
        names << $1
        "$#{names.length - 1}"
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

      query_args = query.defaults.merge(params)

      time_start, time_end, explain, err, result = nil
      begin
        ActiveRecord::Base.connection.transaction do
          # Setting transaction to read only prevents shoot-in-foot actions like SELECT FOR UPDATE
          ActiveRecord::Base.exec_sql "SET TRANSACTION READ ONLY"
          # SQL comments are for the benefits of the slow queries log
          sql = <<SQL

/*
 * DataExplorer Query
 * Query: /admin/plugins/explorer/#{query.id}
 * Started by: #{opts[:current_user]}
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
            explain = ActiveRecord::Base.exec_sql("EXPLAIN #{query.sql}", query_args)
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
    attr_accessor :id, :name, :description, :sql, :defaults

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

    def self.from_hash(h)
      query = DataExplorer::Query.new
      [:name, :description, :sql].each do |sym|
        query.send("#{sym}=", h[sym]) if h[sym]
      end
      if h[:id]
        query.id = h[:id].to_i
      end
      if h[:defaults]
        case h[:defaults]
          when String
            query.defaults = MultiJson.load(h[:defaults])
          when Hash
            query.defaults = h[:defaults]
          else
            raise ArgumentError.new('invalid type for :defaults')
        end
      end
      query
    end

    def to_hash
      {
        id: @id,
        name: @name || 'Query',
        description: @description || '',
        sql: @sql || 'SELECT 1',
        defaults: @defaults || {},
      }
    end

    def self.find(id)
      from_hash DataExplorer.pstore_get("q:#{id}")
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
    skip_before_filter :check_xhr, only: [:show]

    def index
      # guardian.ensure_can_use_data_explorer!
      queries = DataExplorer::Query.all
      render_serialized queries, DataExplorer::QuerySerializer, root: 'queries'
    end

    def show
      query = DataExplorer::Query.find(params[:id].to_i)

      if params[:export]
        response.headers['Content-Disposition'] = "attachment; filename=#{query.slug}.json"
        response.sending_file = true
      else
        check_xhr
      end

      # guardian.ensure_can_see! query
      render_serialized query, DataExplorer::QuerySerializer, root: 'queries'
    end

    # Helper endpoint for logic
    def parse_params
      render json: (DataExplorer.extract_params params.require(:sql))[:names]
    end

    def create
      # guardian.ensure_can_create_explorer_query!

      query = DataExplorer::Query.from_hash params.permit(:name, :sql, :defaults)
      # Set the ID _only_ if undeleting
      if params[:recover]
        query.id = params[:id].to_i
      end
      query.save

      render_serialized query, DataExplorer::QuerySerializer, root: 'queries'
    end

    def update
      query = DataExplorer::Query.find(params[:id].to_i)
      [:name, :sql, :defaults].each do |sym|
        query.send("#{sym}=", params[sym]) if params[sym]
      end
      query.save

      render_serialized query, DataExplorer::QuerySerializer, root: 'queries'
    end

    def destroy
      query = DataExplorer::Query.find(params[:id].to_i)
      query.destroy
      render nothing: true
    end

    def run
      query = DataExplorer::Query.find(params[:id].to_i)
      query_params = MultiJson.load(params[:params])
      opts = {current_user: current_user.username}
      opts[:explain] = true if params[:explain]
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
          params: query_params,
          duration: (result[:duration_nanos].to_f / 1_000_000).round(1),
          columns: cols,
        }
        json[:explain] = result[:explain] if opts[:explain]
        # TODO - special serialization
        # if cols.any? { |col_name| special_serialization? col_name }
        #   json[:relations] = DataExplorer.add_extra_data(pg_result)
        # end

        # TODO - can we tweak this to save network traffic
        json[:rows] = pg_result.to_a

        render json: json
      end
    end
  end

  class DataExplorer::QuerySerializer < ActiveModel::Serializer
    attributes :id, :sql, :name, :description, :defaults
  end

  DataExplorer::Engine.routes.draw do
    root to: "query#index"
    get 'queries' => "query#index"
    # POST /query -> explorer#create
    # GET /query/:id -> explorer#show
    # PUT /query/:id -> explorer#update
    # DELETE /query/:id -> explorer#destroy
    resources :query
    get 'query/parse_params' => "query#parse_params"
    post 'query/:id/run' => "query#run"
  end

  Discourse::Application.routes.append do
    mount ::DataExplorer::Engine, at: '/admin/plugins/explorer', constraints: AdminConstraint.new
  end

end

