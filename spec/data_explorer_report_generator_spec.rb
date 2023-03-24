# frozen_string_literal: true

require "rails_helper"

describe DataExplorerReportGenerator do
  fab!(:user) { Fabricate(:user) }
  fab!(:unauthorised_user) { Fabricate(:user) }
  fab!(:unauthorised_group) { Fabricate(:group) }
  fab!(:group) { Fabricate(:group, users: [user]) }

  fab!(:query) { DataExplorer::Query.find(-1) }
  fab!(:query_group) { Fabricate(:query_group, query: query, group: group) }

  let(:query_params) { [%w[from_days_ago 0], %w[duration_days 15]] }

  before { SiteSetting.data_explorer_enabled = true }

  describe ".generate" do
    it "returns [] if the creator cannot send PMs" do
      result =
        DataExplorerReportGenerator.new(user.id).generate(query.id, query_params, [user.username])

      expect(result).to eq []
    end

    it "returns [] if the recipient is not in query group" do
      result =
        DataExplorerReportGenerator.new(user.id).generate(
          query.id,
          query_params,
          [unauthorised_user.username, unauthorised_group.name],
        )

      expect(result).to eq []
    end

    it "returns a list of pms for authorised users" do
      SiteSetting.personal_message_enabled_groups = group.id
      ResultToMarkdown.expects(:convert).returns("le table")
      freeze_time

      result =
        DataExplorerReportGenerator.new(user.id).generate(query.id, query_params, [user.username])

      expect(result).to eq(
        [
          {
            "title" => "Scheduled Report for #{query.name}",
            "target_usernames" => [user.username],
            "raw" =>
              "Hi #{user.username}, your data explorer report is ready.\n\n" +
                "Query Name:\n#{query.name}\n\nHere are the results:\nle table\n\n" +
                "<a href='/admin/plugins/explorer?id=#{query.id}'>View query in Data Explorer</a>\n\n" +
                "Report created at #{Time.zone.now.strftime("%Y-%m-%d at %H:%M:%S")} (#{Time.zone.name})",
          },
        ],
      )
    end
  end
end
