# frozen_string_literal: true

require 'rails_helper'

describe 'Data Explorer rake tasks' do
  before :all do
    $stdout = File.open(File::NULL, 'w')
  end

  before do
    Rake::Task.clear
    Discourse::Application.load_tasks
  end

  def make_query(sql, opts = {}, group_ids = [])
    q = DataExplorer::Query.new
    q.id = opts[:id] || Fabrication::Sequencer.sequence("query-id", 1)
    q.name = opts[:name] || "Query number #{q.id}"
    q.description = "A description for query number #{q.id}"
    q.group_ids = group_ids
    q.sql = sql
    q.hidden = opts[:hidden] || false
    q.save
    q
  end

  def hidden_queries
    hidden_queries = []

    DataExplorer::Query.all.each do |query|
      hidden_queries.push(query) if query.hidden
    end

    hidden_queries
  end

  describe 'data_explorer' do
    it 'hides a single query' do
      DataExplorer::Query.destroy_all
      make_query('SELECT 1 as value', id: 1, name: 'A')
      make_query('SELECT 1 as value', id: 2, name: 'B')
      # rake data_explorer[1] => hide query with ID 1
      Rake::Task['data_explorer'].invoke(1)

      # Soft deletion: PluginStoreRow should not be modified
      expect(DataExplorer::Query.all.length).to eq(2)
      # Array of hidden queries should have exactly 1 element
      expect(hidden_queries.length).to eq(1)
      # That one element should have the same ID as the one invoked to be hidden
      expect(hidden_queries[0].id).to eq(1)
    end

    it 'hides multiple queries' do
      DataExplorer::Query.destroy_all
      make_query('SELECT 1 as value', id: 1, name: 'A')
      make_query('SELECT 1 as value', id: 2, name: 'B')
      make_query('SELECT 1 as value', id: 3, name: 'C')
      make_query('SELECT 1 as value', id: 4, name: 'D')
      # rake data_explorer[1,2,4] => hide queries with IDs 1, 2 and 4
      Rake::Task['data_explorer'].invoke(1, 2, 4)

      # Soft deletion: PluginStoreRow should not be modified
      expect(DataExplorer::Query.all.length).to eq(4)
      # Array of hidden queries should have the same number of elements invoked to be hidden
      expect(hidden_queries.length).to eq(3)
      # The elements should have the same ID as the ones invoked to be hidden
      expect(hidden_queries[0].id).to eq(1)
      expect(hidden_queries[1].id).to eq(2)
      expect(hidden_queries[2].id).to eq(4)
    end

    context 'query does not exist in PluginStore' do
      it 'should not hide the query' do
        DataExplorer::Query.destroy_all
        make_query('SELECT 1 as value', id: 1, name: 'A')
        make_query('SELECT 1 as value', id: 2, name: 'B')
        # rake data_explorer[3] => try to hide query with ID 3
        Rake::Task['data_explorer'].invoke(3)
        # rake data_explorer[3,4,5] => try to hide queries with IDs 3, 4 and 5
        Rake::Task['data_explorer'].invoke(3, 4, 5)

        # Array of hidden queries should be empty
        expect(hidden_queries.length).to eq(0)
      end
    end
  end

  describe '#unhide_query' do
    it 'unhides a single query' do
      DataExplorer::Query.destroy_all
      make_query('SELECT 1 as value', id: 1, name: 'A', hidden: true)
      make_query('SELECT 1 as value', id: 2, name: 'B', hidden: true)
      # rake data_explorer:unhide_query[1] => unhide query with ID 1
      Rake::Task['data_explorer:unhide_query'].invoke(1)

      # Soft deletion: PluginStoreRow should not be modified
      expect(DataExplorer::Query.all.length).to eq(2)
      # Array of hidden queries should have exactly 1 element
      expect(hidden_queries.length).to eq(1)
      # There should be one remaining element that is still hidden
      expect(hidden_queries[0].id).to eq(2)
    end

    it 'unhides multiple queries' do
      DataExplorer::Query.destroy_all
      make_query('SELECT 1 as value', id: 1, name: 'A', hidden: true)
      make_query('SELECT 1 as value', id: 2, name: 'B', hidden: true)
      make_query('SELECT 1 as value', id: 3, name: 'C', hidden: true)
      make_query('SELECT 1 as value', id: 4, name: 'D', hidden: true)
      # rake data_explorer:unhide_query[1,2,4] => unhide queries with IDs 1, 2 and 4
      Rake::Task['data_explorer:unhide_query'].invoke(1, 2, 4)

      # Soft deletion: PluginStoreRow should not be modified
      expect(DataExplorer::Query.all.length).to eq(4)
      # Array of hidden queries should have exactly 1 element
      expect(hidden_queries.length).to eq(1)
      # There should be one remaining element that is still hidden
      expect(hidden_queries[0].id).to eq(3)
    end

    context 'query does not exist in PluginStore' do
      it 'should not unhide the query' do
        DataExplorer::Query.destroy_all
        make_query('SELECT 1 as value', id: 1, name: 'A', hidden: true)
        make_query('SELECT 1 as value', id: 2, name: 'B', hidden: true)
        # rake data_explorer:unhide_query[3] => try to unhide query with ID 3
        Rake::Task['data_explorer:unhide_query'].invoke(3)
        # rake data_explorer:unhide_query[3,4,5] => try to unhide queries with IDs 3, 4 and 5
        Rake::Task['data_explorer:unhide_query'].invoke(3, 4, 5)

        # Array of hidden queries shouldn't change
        expect(hidden_queries.length).to eq(2)
      end
    end
  end
end
