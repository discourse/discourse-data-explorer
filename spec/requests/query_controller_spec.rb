# frozen_string_literal: true

require 'rails_helper'

describe DataExplorer::QueryController do
  def response_json
    response.parsed_body
  end

  before do
    SiteSetting.data_explorer_enabled = true
  end

  def make_query(sql, opts = {}, group_ids = [])
    query = DataExplorer::Query.create!(name: opts[:name] || "Query number", description: "A description for query number", sql: sql, hidden: opts[:hidden] || false)
    group_ids.each do |group_id|
      query.query_groups.create!(group_id: group_id)
    end
    query
  end

  describe "Admin" do
    fab!(:admin) { Fabricate(:admin) }

    before do
      sign_in(admin)
    end

    describe "when disabled" do
      before do
        SiteSetting.data_explorer_enabled = false
      end

      it 'denies every request' do
        get "/admin/plugins/explorer/queries.json"
        expect(response.status).to eq(404)

        get "/admin/plugins/explorer/schema.json"
        expect(response.status).to eq(404)

        get "/admin/plugins/explorer/queries/3.json"
        expect(response.status).to eq(404)

        post "/admin/plugins/explorer/queries.json", params: {
          id: 3
        }
        expect(response.status).to eq(404)

        post "/admin/plugins/explorer/queries/3/run.json"
        expect(response.status).to eq(404)

        put "/admin/plugins/explorer/queries/3.json"
        expect(response.status).to eq(404)

        delete "/admin/plugins/explorer/queries/3.json"
        expect(response.status).to eq(404)
      end
    end

    describe "#index" do
      it "behaves nicely with no user created queries" do
        DataExplorer::Query.destroy_all
        get "/admin/plugins/explorer/queries.json"
        expect(response.status).to eq(200)
        expect(response_json['queries'].count).to eq(Queries.default.count)
      end

      it "shows all available queries in alphabetical order" do
        DataExplorer::Query.destroy_all
        make_query('SELECT 1 as value', name: 'B')
        make_query('SELECT 1 as value', name: 'A')
        get "/admin/plugins/explorer/queries.json"
        expect(response.status).to eq(200)
        expect(response_json['queries'].length).to eq(Queries.default.count + 2)
        expect(response_json['queries'][0]['name']).to eq('A')
        expect(response_json['queries'][1]['name']).to eq('B')
      end

      it "doesn't show hidden/deleted queries" do
        DataExplorer::Query.destroy_all
        make_query('SELECT 1 as value', name: 'A', hidden: false)
        make_query('SELECT 1 as value', name: 'B', hidden: true)
        make_query('SELECT 1 as value', name: 'C', hidden: true)
        get "/admin/plugins/explorer/queries.json"
        expect(response.status).to eq(200)
        expect(response_json['queries'].length).to eq(Queries.default.count + 1)
      end
    end

    describe "#update" do
      fab!(:user2) { Fabricate(:user) }
      fab!(:group2) { Fabricate(:group, users: [user2]) }

      it "allows group to access system query" do
        query = DataExplorer::Query.find(-4)
        put "/admin/plugins/explorer/queries/#{query.id}.json", params: {
          "query" => {
            "name" => query.name,
            "description" => query.description,
            "sql" => query.sql,
            "user_id" => query.user_id,
            "created_at" => query.created_at,
            "group_ids" => [group2.id],
            "last_run_at" => query.last_run_at
          },
          "id" => query.id }

        expect(response.status).to eq(200)
      end

      it "returns a proper json error for invalid updates" do

        query = DataExplorer::Query.find(-4)
        put "/admin/plugins/explorer/queries/#{query.id}", params: {
          "query" => {
            "name" => "",
          },
          "id" => query.id }

        expect(response.status).to eq(422)
        expect(response.parsed_body["errors"]).to eq(["Name can't be blank"])
      end
    end

    describe "#run" do
      def run_query(id, params = {})
        params = Hash[params.map { |a| [a[0], a[1].to_s] }]
        post "/admin/plugins/explorer/queries/#{id}/run.json", params: { params: params.to_json }
      end

      it "can run queries" do
        query = make_query('SELECT 23 as my_value')
        run_query query.id
        expect(response.status).to eq(200)
        expect(response_json['success']).to eq(true)
        expect(response_json['errors']).to eq([])
        expect(response_json['columns']).to eq(['my_value'])
        expect(response_json['rows']).to eq([[23]])
      end

      it "can process parameters" do
        query = make_query <<~SQL
        -- [params]
        -- int :foo = 34
        SELECT :foo as my_value
        SQL

        run_query query.id, foo: 23
        expect(response.status).to eq(200)
        expect(response_json['errors']).to eq([])
        expect(response_json['success']).to eq(true)
        expect(response_json['columns']).to eq(['my_value'])
        expect(response_json['rows']).to eq([[23]])

        run_query query.id
        expect(response.status).to eq(200)
        expect(response_json['errors']).to eq([])
        expect(response_json['success']).to eq(true)
        expect(response_json['columns']).to eq(['my_value'])
        expect(response_json['rows']).to eq([[34]])

        # 2.3 is not an integer
        run_query query.id, foo: '2.3'
        expect(response.status).to eq(422)
        expect(response_json['errors']).to_not eq([])
        expect(response_json['success']).to eq(false)
        expect(response_json['errors'].first).to match(/ValidationError/)
      end

      it "doesn't allow you to modify the database #1" do
        p = create_post

        query = make_query <<~SQL
        UPDATE posts SET cooked = '<p>you may already be a winner!</p>' WHERE id = #{p.id}
        RETURNING id
        SQL

        run_query query.id
        p.reload

        # Manual Test - comment out the following lines:
        #   DB.exec "SET TRANSACTION READ ONLY"
        #   raise ActiveRecord::Rollback
        # This test should fail on the below check.
        expect(p.cooked).to_not match(/winner/)
        expect(response.status).to eq(422)
        expect(response_json['errors']).to_not eq([])
        expect(response_json['success']).to eq(false)
        expect(response_json['errors'].first).to match(/read-only transaction/)
      end

      it "doesn't allow you to modify the database #2" do
        p = create_post

        query = make_query <<~SQL
          SELECT 1
        )
        SELECT * FROM query;
        RELEASE SAVEPOINT active_record_1;
        SET TRANSACTION READ WRITE;
        UPDATE posts SET cooked = '<p>you may already be a winner!</p>' WHERE id = #{p.id};
        SAVEPOINT active_record_1;
        SET TRANSACTION READ ONLY;
        WITH query AS (
          SELECT 1
        SQL

        run_query query.id
        p.reload

        # Manual Test - change out the following line:
        #
        #  module ::DataExplorer
        #   def self.run_query(...)
        #     if query.sql =~ /;/
        #
        # to
        #
        #     if false && query.sql =~ /;/
        #
        # Afterwards, this test should fail on the below check.
        expect(p.cooked).to_not match(/winner/)
        expect(response.status).to eq(422)
        expect(response_json['errors']).to_not eq([])
        expect(response_json['success']).to eq(false)
        expect(response_json['errors'].first).to match(/semicolon/)
      end

      it "doesn't allow you to lock rows" do
        query = make_query <<~SQL
        SELECT id FROM posts FOR UPDATE
        SQL

        run_query query.id
        expect(response.status).to eq(422)
        expect(response_json['errors']).to_not eq([])
        expect(response_json['success']).to eq(false)
        expect(response_json['errors'].first).to match(/read-only transaction/)
      end

      it "doesn't allow you to create a table" do
        query = make_query <<~SQL
        CREATE TABLE mytable (id serial)
        SQL

        run_query query.id
        expect(response.status).to eq(422)
        expect(response_json['errors']).to_not eq([])
        expect(response_json['success']).to eq(false)
        expect(response_json['errors'].first).to match(/read-only transaction|syntax error/)
      end

      it "doesn't allow you to break the transaction" do
        query = make_query <<~SQL
        COMMIT
        SQL

        run_query query.id
        expect(response.status).to eq(422)
        expect(response_json['errors']).to_not eq([])
        expect(response_json['success']).to eq(false)
        expect(response_json['errors'].first).to match(/syntax error/)

        query.sql = <<~SQL
        )
        SQL

        run_query query.id
        expect(response.status).to eq(422)
        expect(response_json['errors']).to_not eq([])
        expect(response_json['success']).to eq(false)
        expect(response_json['errors'].first).to match(/syntax error/)

        query.sql = <<~SQL
        RELEASE SAVEPOINT active_record_1
        SQL

        run_query query.id
        expect(response.status).to eq(422)
        expect(response_json['errors']).to_not eq([])
        expect(response_json['success']).to eq(false)
        expect(response_json['errors'].first).to match(/syntax error/)
      end

      it "can export data in CSV format" do
        query = make_query('SELECT 23 as my_value')
        post "/admin/plugins/explorer/queries/#{query.id}/run.json", params: { download: 1 }
        expect(response.status).to eq(200)
      end

      context "`limit` parameter" do
        before do
          create_post
          create_post
          create_post
        end

        it "should limit the results in JSON response" do
          SiteSetting.data_explorer_query_result_limit = 2
          query = make_query <<~SQL
            SELECT id FROM posts
          SQL

          run_query query.id
          expect(response_json['rows'].count).to eq(2)

          post "/admin/plugins/explorer/queries/#{query.id}/run.json", params: { limit: 1 }
          expect(response_json['rows'].count).to eq(1)

          post "/admin/plugins/explorer/queries/#{query.id}/run.json", params: { limit: "ALL" }
          expect(response_json['rows'].count).to eq(3)
        end

        it "should limit the results in CSV download" do
          begin
            original_const = DataExplorer::QUERY_RESULT_MAX_LIMIT
            DataExplorer.send(:remove_const, "QUERY_RESULT_MAX_LIMIT")
            DataExplorer.const_set("QUERY_RESULT_MAX_LIMIT", 2)

            query = make_query <<~SQL
            SELECT id FROM posts
            SQL

            post "/admin/plugins/explorer/queries/#{query.id}/run.csv", params: { download: 1 }
            expect(response.body.split("\n").count).to eq(3)

            post "/admin/plugins/explorer/queries/#{query.id}/run.csv", params: { download: 1, limit: 1 }
            expect(response.body.split("\n").count).to eq(2)

            # The value `ALL` is not supported in csv exports.
            post "/admin/plugins/explorer/queries/#{query.id}/run.csv", params: { download: 1, limit: "ALL" }
            expect(response.body.split("\n").count).to eq(1)
          ensure
            DataExplorer.send(:remove_const, "QUERY_RESULT_MAX_LIMIT")
            DataExplorer.const_set("QUERY_RESULT_MAX_LIMIT", original_const)
          end
        end
      end
    end
  end

  describe "Non-Admin" do
    fab!(:user) { Fabricate(:user) }
    fab!(:group) { Fabricate(:group, users: [user]) }

    before do
      sign_in(user)
    end

    describe "when disabled" do
      before do
        SiteSetting.data_explorer_enabled = false
      end

      it 'denies every request' do
        get "/g/1/reports.json"
        expect(response.status).to eq(404)

        get "/g/1/reports/1.json"
        expect(response.status).to eq(404)

        post "/g/1/reports/1/run.json"
        expect(response.status).to eq(404)
      end
    end

    it "cannot access admin endpoints" do
      query = make_query('SELECT 1 as value')
      post "/admin/plugins/explorer/queries/#{query.id}/run.json"
      expect(response.status).to eq(403)
    end

    describe "#group_reports_index" do
      it "only returns queries that the group has access to" do
        group.add(user)
        make_query('SELECT 1 as value', { name: 'A' }, ["#{group.id}"])

        get "/g/#{group.name}/reports.json"
        expect(response.status).to eq(200)
        expect(response_json['queries'].length).to eq(1)
        expect(response_json['queries'][0]['name']).to eq('A')
      end

      it "returns a 404 when the user should not have access to the query " do
        other_user = Fabricate(:user)
        sign_in(other_user)

        get "/g/#{group.name}/reports.json"
        expect(response.status).to eq(404)
      end

      it "return a 200 when the user has access the the query" do
        group.add(user)

        get "/g/#{group.name}/reports.json"
        expect(response.status).to eq(200)
      end

      it "does not return hidden queries" do
        group.add(user)
        make_query('SELECT 1 as value', { name: 'A', hidden: true }, ["#{group.id}"])
        make_query('SELECT 1 as value', { name: 'B' }, ["#{group.id}"])

        get "/g/#{group.name}/reports.json"
        expect(response.status).to eq(200)
        expect(response_json['queries'].length).to eq(1)
        expect(response_json['queries'][0]['name']).to eq('B')
      end
    end

    describe "#group_reports_run" do
      it "runs the query" do
        query = make_query('SELECT 1828 as value', { name: 'B' }, ["#{group.id}"])

        post "/g/#{group.name}/reports/#{query.id}/run.json"
        expect(response.status).to eq(200)
        expect(response.parsed_body["success"]).to eq(true)
        expect(response.parsed_body["columns"]).to eq(["value"])
        expect(response.parsed_body["rows"]).to eq([[1828]])
      end

      it "returns a 404 when the user should not have access to the query " do
        group.add(user)
        query = make_query('SELECT 1 as value', {}, [])

        post "/g/#{group.name}/reports/#{query.id}/run.json"
        expect(response.status).to eq(404)
      end

      it "return a 200 when the user has access the the query" do
        group.add(user)
        query = make_query('SELECT 1 as value', {}, [group.id.to_s])

        post "/g/#{group.name}/reports/#{query.id}/run.json"
        expect(response.status).to eq(200)
      end

      it "return a 404 when the query is hidden" do
        group.add(user)
        query = make_query('SELECT 1 as value', { hidden: true }, [group.id.to_s])

        post "/g/#{group.name}/reports/#{query.id}/run.json"
        expect(response.status).to eq(404)
      end
    end

    describe "#group_reports_show" do
      it "returns a 404 when the user should not have access to the query " do
        query = make_query('SELECT 1 as value', {}, [])

        get "/g/#{group.name}/reports/#{query.id}.json"
        expect(response.status).to eq(404)
      end

      it "return a 200 when the user has access the the query" do
        query = make_query('SELECT 1 as value', {}, [group.id.to_s])

        get "/g/#{group.name}/reports/#{query.id}.json"
        expect(response.status).to eq(200)
      end

      it "return a 404 when the query is hidden" do
        query = make_query('SELECT 1 as value', { hidden: true }, [group.id.to_s])

        get "/g/#{group.name}/reports/#{query.id}.json"
        expect(response.status).to eq(404)
      end
    end
  end
end
