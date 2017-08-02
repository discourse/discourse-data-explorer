require 'rails_helper'

describe DataExplorer::QueryController do
  routes { ::DataExplorer::Engine.routes }

  def response_json
    MultiJson.load(response.body)
  end

  before do
    SiteSetting.data_explorer_enabled = true
  end

  let!(:admin) { log_in_user(Fabricate(:admin)) }

  def make_query(sql = 'SELECT 1 as value')
    q = DataExplorer::Query.new
    q.id = Fabrication::Sequencer.sequence("query-id", 1)
    q.name = "Query number #{q.id}"
    q.description = "A description for query number #{q.id}"
    q.sql = sql
    q.save
    q
  end

  describe "when disabled" do
    before do
      SiteSetting.data_explorer_enabled = false
    end
    it 'denies every request' do
      get :index; expect(response.body).to be_empty # check_xhr fail

      xhr :get, :index
      expect(response.status).to eq(404)

      xhr :get, :schema
      expect(response.status).to eq(404)

      xhr :get, :show, id: 3
      expect(response.status).to eq(404)

      xhr :post, :create, id: 3
      expect(response.status).to eq(404)

      xhr :post, :run, id: 3
      expect(response.status).to eq(404)

      xhr :put, :update, id: 3
      expect(response.status).to eq(404)

      xhr :delete, :destroy, id: 3
      expect(response.status).to eq(404)
    end
  end

  describe "#index" do
    it "behaves nicely with no queries" do
      DataExplorer::Query.destroy_all
      xhr :get, :index
      expect(response).to be_success
      expect(response_json['queries']).to eq([])
    end

    it "shows all available queries" do
      DataExplorer::Query.destroy_all
      q1 = make_query
      q2 = make_query
      xhr :get, :index
      expect(response).to be_success
      expect(response_json['queries'].length).to eq(2)
      expect(response_json['queries'][0]['name']).to eq(q1.name)
      expect(response_json['queries'][1]['name']).to eq(q2.name)
    end
  end

  describe "#run" do
    let!(:admin) { log_in(:admin) }

    def run_query(id, params = {})
      params = Hash[params.map { |a| [a[0], a[1].to_s] }]
      xhr :post, :run, id: id, _params: MultiJson.dump(params)
    end
    it "can run queries" do
      q = make_query('SELECT 23 as my_value')
      run_query q.id
      expect(response).to be_success
      expect(response_json['success']).to eq(true)
      expect(response_json['errors']).to eq([])
      expect(response_json['columns']).to eq(['my_value'])
      expect(response_json['rows']).to eq([['23']])
    end

    it "can process parameters" do
      q = make_query <<SQL
-- [params]
-- int :foo = 34
SELECT :foo as my_value
SQL
      run_query q.id, foo: 23
      expect(response).to be_success
      expect(response_json['errors']).to eq([])
      expect(response_json['success']).to eq(true)
      expect(response_json['columns']).to eq(['my_value'])
      expect(response_json['rows']).to eq([['23']])

      run_query q.id
      expect(response).to be_success
      expect(response_json['errors']).to eq([])
      expect(response_json['success']).to eq(true)
      expect(response_json['columns']).to eq(['my_value'])
      expect(response_json['rows']).to eq([['34']])

      # 2.3 is not an integer
      run_query q.id, foo: '2.3'
      expect(response).to_not be_success
      expect(response_json['errors']).to_not eq([])
      expect(response_json['success']).to eq(false)
      expect(response_json['errors'].first).to match(/ValidationError/)
    end

    it "doesn't allow you to modify the database #1" do
      p = create_post
      q = make_query <<-SQL
UPDATE posts SET cooked = '<p>you may already be a winner!</p>' WHERE id = #{p.id}
RETURNING id
SQL
      run_query q.id
      p.reload

      # Manual Test - comment out the following lines:
      #   ActiveRecord::Base.exec_sql "SET TRANSACTION READ ONLY"
      #   raise ActiveRecord::Rollback
      # This test should fail on the below check.
      expect(p.cooked).to_not match(/winner/)
      expect(response).to_not be_success
      expect(response_json['errors']).to_not eq([])
      expect(response_json['success']).to eq(false)
      expect(response_json['errors'].first).to match(/read-only transaction/)
    end

    it "doesn't allow you to modify the database #2" do
      p = create_post
      q = make_query <<-SQL
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
      run_query q.id
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
      expect(response).to_not be_success
      expect(response_json['errors']).to_not eq([])
      expect(response_json['success']).to eq(false)
      expect(response_json['errors'].first).to match(/semicolon/)
    end

    it "doesn't allow you to lock rows" do
      q = make_query <<SQL
SELECT id FROM posts FOR UPDATE
SQL

      run_query q.id
      expect(response).to_not be_success
      expect(response_json['errors']).to_not eq([])
      expect(response_json['success']).to eq(false)
      expect(response_json['errors'].first).to match(/read-only transaction/)
    end

    it "doesn't allow you to create a table" do
      q = make_query <<SQL
CREATE TABLE mytable (id serial)
SQL
      run_query q.id
      expect(response).to_not be_success
      expect(response_json['errors']).to_not eq([])
      expect(response_json['success']).to eq(false)
      expect(response_json['errors'].first).to match(/read-only transaction|syntax error/)
    end

    it "doesn't allow you to break the transaction" do
      q = make_query <<SQL
COMMIT
SQL
      run_query q.id
      expect(response).to_not be_success
      expect(response_json['errors']).to_not eq([])
      expect(response_json['success']).to eq(false)
      expect(response_json['errors'].first).to match(/syntax error/)

      q.sql = <<SQL
)
SQL
      run_query q.id
      expect(response).to_not be_success
      expect(response_json['errors']).to_not eq([])
      expect(response_json['success']).to eq(false)
      expect(response_json['errors'].first).to match(/syntax error/)

      q.sql = <<SQL
RELEASE SAVEPOINT active_record_1
SQL
      run_query q.id
      expect(response).to_not be_success
      expect(response_json['errors']).to_not eq([])
      expect(response_json['success']).to eq(false)
      expect(response_json['errors'].first).to match(/syntax error/)
    end
  end
end
