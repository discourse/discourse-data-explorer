# frozen_string_literal: true

class CreateDataExplorerQueries < ActiveRecord::Migration[6.0]
  def up
    create_table :data_explorer_queries do |t|
      t.string :name
      t.text :description
      t.text :sql, default: "SELECT 1", null: false
      t.integer :user_id
      t.datetime :last_run_at
      t.boolean :hidden, default: false, null: false
      t.timestamps
    end

    create_table :data_explorer_query_groups do |t|
      t.integer :query_id
      t.integer :group_id
      t.index :query_id
      t.index :group_id
    end
    add_index(:data_explorer_query_groups, [:query_id, :group_id], unique: true)

    DB.exec <<~SQL, now: Time.zone.now
      INSERT INTO data_explorer_queries(id, name, description, sql, user_id, last_run_at, hidden, created_at, updated_at)
      SELECT
        (replace(key, 'q:',''))::integer,
        value::json->>'name',
        value::json->>'description',
        value::json->>'sql',
        (value::json->>'created_by')::integer,
        CASE WHEN (value::json->'last_run_at')::text = 'null' THEN 
          null
        WHEN (value::json->'last_run_at')::text = '""' THEN
          null
        ELSE
          (value::json->'last_run_at')::text::timestamptz
        END,
        CASE WHEN (value::json->'hidden')::text = 'null' THEN
          false
        WHEN (value::jsonb ? 'hidden') THEN
          (value::json->'hidden')::text::boolean
        ELSE
          false
        END,
        :now,
        :now
      FROM plugin_store_rows
      WHERE plugin_name = 'discourse-data-explorer' AND type_name = 'JSON' AND (replace(key, 'q:',''))::integer < 0
    SQL

    DB.exec <<~SQL, now: Time.zone.now
      INSERT INTO data_explorer_queries(name, description, sql, user_id, last_run_at, hidden, created_at, updated_at)
      SELECT
        value::json->>'name',
        value::json->>'description',
        value::json->>'sql',
        (value::json->>'created_by')::integer,
        CASE WHEN (value::json->'last_run_at')::text = 'null' THEN
          null
        WHEN (value::json->'last_run_at')::text = '""' THEN
          null
        ELSE
          (value::json->'last_run_at')::text::timestamptz
        END,
        CASE WHEN (value::json->'hidden')::text = 'null' THEN
          false
        WHEN (value::jsonb ? 'hidden') THEN
          (value::json->'hidden')::text::boolean
        ELSE
          false
        END,
        :now,
        :now
      FROM plugin_store_rows
      WHERE plugin_name = 'discourse-data-explorer' AND type_name = 'JSON' AND (replace(key, 'q:',''))::integer > 0
    SQL

    DB.query("SELECT * FROM plugin_store_rows WHERE plugin_name = 'discourse-data-explorer' AND type_name = 'JSON'").each do |row|
      json = JSON.parse(row.value)
      next if json['group_ids'].blank?
      query_id = DB.query("SELECT id FROM data_explorer_queries WHERE
                          name = ? AND sql = ?", json['name'], json['sql']).first.id

      json['group_ids'].each do |group_id|
        DB.exec <<~SQL
          INSERT INTO data_explorer_query_groups(query_id, group_id) 
          VALUES(#{query_id}, #{group_id})
        SQL
      end
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
