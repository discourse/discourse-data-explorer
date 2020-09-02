class FixQueryIds < ActiveRecord::Migration[6.0]
  def up

    # Only queries with unique title can be fixed
    movements = DB.query <<-SQL
      SELECT deq.id AS from, (replace(plugin_store_rows.key, 'q:',''))::integer AS to
      FROM plugin_store_rows
      INNER JOIN data_explorer_queries deq ON deq.name = plugin_store_rows.value::json->>'name'
      WHERE
        (replace(plugin_store_rows.key, 'q:',''))::integer != deq.id AND
        plugin_store_rows.plugin_name = 'discourse-data-explorer' AND
        plugin_store_rows.type_name = 'JSON' AND
        (SELECT COUNT(*) from data_explorer_queries deq2 WHERE deq.name = deq2.name) = 1
    SQL

    return if movements.blank?

    offset = DB.query("SELECT max(id) AS id FROM data_explorer_queries").first.id + 20 # 18 system queries with negative ids

    ActiveRecord::Base.transaction do
      # Move all queries we need to update to higher and safer id to avoid conflicts
      DB.exec(<<~SQL, ids: movements.map(&:from), offset: offset)
          UPDATE data_explorer_queries
          SET id = id + :offset
          WHERE id IN (:ids)
        SQL

      # If there are new queries, they still may have conflict
      # We just want to move their ids to safe space and we will not move them back
      additional_conflicts = DB.query(<<~SQL, movements.map { |m| m.to } ).map(&:id)
        SELECT id FROM data_explorer_queries
        WHERE id IN (?)
      SQL

      # Update groups for potential additional_conflicts
      additional_conflicts.each do |id|
        DB.exec(<<~SQL, new: id + offset, old: id)
          UPDATE data_explorer_query_groups
          SET query_id = :new
          WHERE query_id = :old
        SQL
      end

      DB.exec(<<~SQL, ids: additional_conflicts, offset: offset)
          UPDATE data_explorer_queries
          SET id = id + :offset
          WHERE id IN (:ids)
      SQL

      # Move queries to correct id
      movements.each do |movement|
        DB.exec(<<~SQL, new: movement.to, old: movement.from + offset)
          UPDATE data_explorer_queries
          SET id = :new
          WHERE id = :old
        SQL
        DB.exec(<<~SQL, new: movement.to, old: movement.from)
          UPDATE data_explorer_query_groups
          SET query_id = :new
          WHERE query_id= :old
        SQL
      end

      # Update id sequence
      DB.exec <<~SQL
        SELECT
          setval(
            pg_get_serial_sequence('data_explorer_queries', 'id'),
            (select max(id) from data_explorer_queries)
          );
      SQL
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
