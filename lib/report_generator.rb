# frozen_string_literal: true

module ::DiscourseDataExplorer
  class ReportGenerator
    def self.generate(query_id, query_params, recipients)
      query = DiscourseDataExplorer::Query.find(query_id)
      return [] if !query || recipients.empty?

      recipients = filter_recipients_by_query_access(recipients, query)
      params = params_to_hash(query_params)

      result = DataExplorer.run_query(query, params)
      query.update!(last_run_at: Time.now)

      table = ResultToMarkdown.convert(result[:pg_result])

      build_report_pms(query, table, recipients)
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

    def self.build_report_pms(query, table = "", targets = [])
      pms = []
      targets.each do |target|
        name = target[0]
        pm_type = target[1] == "group" ? "target_group_names" : "target_usernames"

        pm = {}
        pm["title"] = "Scheduled Report for #{query.name}"
        pm[pm_type] = Array(name)
        pm["raw"] = "Hi #{name}, your data explorer report is ready.\n\n" +
          "Query Name:\n#{query.name}\n\nHere are the results:\n#{table}\n\n" +
          "<a href='#{Discourse.base_url}/admin/plugins/explorer?id=#{query.id}'>View query in Data Explorer</a>\n\n" +
          "Report created at #{Time.zone.now.strftime("%Y-%m-%d at %H:%M:%S")} (#{Time.zone.name})"
        pms << pm
      end
      pms
    end

    def self.filter_recipients_by_query_access(recipients, query)
      recipients
        .uniq
        .reduce([]) do |names, recipient|
          if (group = Group.find_by(name: recipient)) &&
            (
              group.id == Group::AUTO_GROUPS[:admins] ||
              query.query_groups.exists?(group_id: group.id)
            )
            names << [recipient, "group"]
          elsif (user = User.find_by(username: recipient)) &&
            Guardian.new(user).user_can_access_query?(query)
            names << [recipient, "user"]
          elsif Email.is_valid?(recipient)
            names << [recipient, "email"]
          end
          names
        end
    end
  end
end
