# frozen_string_literal: true

module ::DiscourseDataExplorer
  class QueryGroup < ActiveRecord::Base
    self.table_name = "data_explorer_query_groups"

    belongs_to :query
    belongs_to :group

    has_many :bookmarks, as: :bookmarkable
  end
end
