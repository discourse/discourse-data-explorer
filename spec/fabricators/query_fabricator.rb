# frozen_string_literal: true

Fabricator(:query, from: "DataExplorer::Query") do
  name
  description
  sql
  user
end

Fabricator(:query_group, from: "DataExplorer::QueryGroup") do
  query
  group
end
