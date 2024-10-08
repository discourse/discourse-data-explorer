# frozen_string_literal: true

module ::DiscourseDataExplorer
  class ReportGenerator
    def self.generate(query_id, query_params, recipients, opts = {})
      query = DiscourseDataExplorer::Query.find(query_id)
      return [] if !query || recipients.empty?

      recipients = filter_recipients_by_query_access(recipients, query)
      params = params_to_hash(query_params)

      result = DataExplorer.run_query(query, params)
      query.update!(last_run_at: Time.now)

      return [] if opts[:skip_empty] && result[:pg_result].values.empty?
      table = ResultToMarkdown.convert(result[:pg_result])

      build_report_pms(query, table, recipients, attach_csv: opts[:attach_csv], result:)
    end

    def self.generate_post(query_id, query_params, opts = {})
      query = DiscourseDataExplorer::Query.find(query_id)
      return {} if !query

      params = params_to_hash(query_params)

      result = DataExplorer.run_query(query, params)
      query.update!(last_run_at: Time.now)

      return {} if opts[:skip_empty] && result[:pg_result].values.empty?
      table = ResultToMarkdown.convert(result[:pg_result])

      build_report_post(query, table, attach_csv: opts[:attach_csv], result:)
    end

    private

    def self.params_to_hash(query_params)
      params = JSON.parse(query_params)
      params_hash = {}

      if !params.blank?
        param_key, param_value = [], []
        params.flatten.each.with_index do |data, i|
          if i % 2 == 0
            param_key << data
          else
            param_value << data
          end
        end

        params_hash = Hash[param_key.zip(param_value)]
      end

      params_hash
    end

    def self.build_report_pms(query, table = "", targets = [], attach_csv: false, result: nil)
      pms = []
      upload = create_csv_upload(query, result) if attach_csv

      targets.each do |target|
        name = target[0]
        pm_type = "target_#{target[1]}s"

        pm = {}
        pm["title"] = "Scheduled Report for #{query.name}"
        pm[pm_type] = Array(name)
        pm["raw"] = "Hi #{name}, your data explorer report is ready.\n\n" +
          "Query Name:\n#{query.name}\n\nHere are the results:\n#{table}\n\n" +
          "<a href='#{Discourse.base_url}/admin/plugins/explorer?id=#{query.id}'>View query in Data Explorer</a>\n\n" +
          "Report created at #{Time.zone.now.strftime("%Y-%m-%d at %H:%M:%S")} (#{Time.zone.name})"
        if upload
          pm["raw"] << "\n\nAppendix: [#{upload.original_filename}|attachment](#{upload.short_url})"
        end
        pms << pm
      end
      pms
    end

    def self.build_report_post(query, table = "", attach_csv: false, result: nil)
      pms = []

      upload = create_csv_upload(query, result) if attach_csv

      post = {}
      post["raw"] = "### Scheduled Report for #{query.name}\n\n" +
        "Query Name:\n#{query.name}\n\nHere are the results:\n#{table}\n\n" +
        "<a href='#{Discourse.base_url}/admin/plugins/explorer?id=#{query.id}'>View query in Data Explorer</a>\n\n" +
        "Report created at #{Time.zone.now.strftime("%Y-%m-%d at %H:%M:%S")} (#{Time.zone.name})"

      if upload
        post["raw"] << "\n\nAppendix: [#{upload.original_filename}|attachment](#{upload.short_url})"
      end

      post
    end

    def self.create_csv_upload(query, result)
      tmp_filename =
        "#{query.slug}@#{Slug.for(Discourse.current_hostname, "discourse")}-#{Date.today}.dcqresult.csv"
      tmp = Tempfile.new(tmp_filename)
      tmp.write(ResultFormatConverter.convert(:csv, result))
      tmp.rewind
      UploadCreator.new(tmp, tmp_filename, type: "csv_export").create_for(Discourse.system_user.id)
    end

    def self.filter_recipients_by_query_access(recipients, query)
      users = User.where(username: recipients)
      groups = Group.where(name: recipients)
      emails = recipients - users.pluck(:username) - groups.pluck(:name)
      result = []

      users.each do |user|
        result << [user.username, "username"] if Guardian.new(user).user_can_access_query?(query)
      end

      groups.each do |group|
        if group.id == Group::AUTO_GROUPS[:admins] || query.query_groups.exists?(group_id: group.id)
          result << [group.name, "group_name"]
        end
      end

      emails.each { |email| result << [email, "email"] if Email.is_valid?(email) }

      result
    end
  end
end
