# frozen_string_literal: true

include HasSanitizableFields

module ::DiscourseDataExplorer
  class ResultToMarkdown
    def self.convert(pg_result)
      relations, colrender = DataExplorer.add_extra_data(pg_result)
      result_data = []

      # column names to search in place of id columns (topic_id, user_id etc)
      cols = %w[name title username]

      # find values from extra data, based on result id
      pg_result.values.each do |row|
        row_data = []

        row.each_with_index do |col, col_index|
          col_name = pg_result.fields[col_index]
          related = relations.dig(colrender[col_index].to_sym) unless colrender[col_index].nil?

          if related.is_a?(ActiveModel::ArraySerializer)
            related_row = related.object.find_by(id: col)
            if col_name.include?("_id")
              column = cols.find { |c| related_row.try c }
            else
              column = related_row.try(col_name)
            end

            if column.nil?
              row_data[col_index] = col
            else
              row_data[col_index] = related_row[column]
            end
          else
            row_data[col_index] = col
          end
        end

        result_data << row_data.map { |c| "| #{sanitize_field(c.to_s)} " }.join + "|\n"
      end

      table_headers = pg_result.fields.map { |c| " #{c.gsub("_id", "")} |" }.join
      table_body = pg_result.fields.size.times.map { " :-----: |" }.join

      "|#{table_headers}\n|#{table_body}\n#{result_data.join}"
    end
  end
end
