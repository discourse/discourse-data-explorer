# frozen_string_literal: true

Fabricator(:query, from: "DataExplorer::Query") do
  name { sequence(:name) { |i| "cat#{i}" } }
  description { sequence(:desc) { |i| "description #{i}" } }
  sql { sequence(:sql) { |i| "SELECT * FROM users limit #{i}" } }
  user
end

Fabricator(:query_group, from: "DataExplorer::QueryGroup") do
  query
  group
end
