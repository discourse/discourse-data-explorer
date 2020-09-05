# frozen_string_literal: true

module DataExplorer
  class Query < ActiveRecord::Base
    self.table_name = 'data_explorer_queries'
    has_many :query_groups
    has_many :groups, through: :query_groups
    belongs_to :user

    def params
      @params ||= DataExplorer::Parameter.create_from_sql(sql)
    end

    def cast_params(input_params)
      result = {}.with_indifferent_access
      self.params.each do |pobj|
        result[pobj.identifier] = pobj.cast_to_ruby input_params[pobj.identifier]
      end
      result
    end

    def slug
      Slug.for(name).presence || "query-#{id}"
    end

    def self.find(id)
      if id.to_i < 0
        default_query = Queries.default[id.to_s]
        return raise ActiveRecord::RecordNotFound unless default_query
        query = Query.find_by(id: id) || Query.new
        query.attributes = default_query
        query.user_id = Discourse::SYSTEM_USER_ID.to_s
        query
      else
        super
      end
    end
  end
end
