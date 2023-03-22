# frozen_string_literal: true

Fabricator(:query, from: "DiscourseDataExplorer::Query") do
  name
  description
  sql
  user
end

Fabricator(:query_group, from: "DiscourseDataExplorer::QueryGroup") do
  query
  group
end
