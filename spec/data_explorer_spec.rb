# frozen_string_literal: true

describe DiscourseDataExplorer::DataExplorer do
  describe ".run_query" do
    fab!(:topic) { Fabricate(:topic) }

    it "should run a query that includes PG template patterns" do
      sql = <<~SQL
      WITH query AS (
        SELECT TO_CHAR(created_at, 'yyyy:mm:dd') AS date FROM topics
      ) SELECT * FROM query
      SQL

      query = DiscourseDataExplorer::Query.create!(name: "some query", sql: sql)

      result = described_class.run_query(query)

      expect(result[:error]).to eq(nil)
      expect(result[:pg_result][0]["date"]).to eq(topic.created_at.strftime("%Y:%m:%d"))
    end

    it "should run a query containing a question mark in the comment" do
      sql = <<~SQL
      WITH query AS (
        SELECT id FROM topics -- some SQL ? comment ?
      ) SELECT * FROM query
      SQL

      query = DiscourseDataExplorer::Query.create!(name: "some query", sql: sql)

      result = described_class.run_query(query)

      expect(result[:error]).to eq(nil)
      expect(result[:pg_result][0]["id"]).to eq(topic.id)
    end

    it "can run a query with params interpolation" do
      topic2 = Fabricate(:topic)

      sql = <<~SQL
      -- [params]
      -- int :topic_id = 99999999
      WITH query AS (
        SELECT
          id,
          TO_CHAR(created_at, 'yyyy:mm:dd') AS date
        FROM topics
        WHERE topics.id = :topic_id
      ) SELECT * FROM query
      SQL

      query = DiscourseDataExplorer::Query.create!(name: "some query", sql: sql)

      result = described_class.run_query(query, { "topic_id" => topic2.id.to_s })

      expect(result[:error]).to eq(nil)
      expect(result[:pg_result].to_a.size).to eq(1)
      expect(result[:pg_result][0]["id"]).to eq(topic2.id)
    end
  end
end
