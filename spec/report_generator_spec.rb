# frozen_string_literal: true

require "rails_helper"

describe DiscourseDataExplorer::ReportGenerator do
  fab!(:user)
  fab!(:unauthorised_user) { Fabricate(:user) }
  fab!(:unauthorised_group) { Fabricate(:group) }
  fab!(:group) { Fabricate(:group, users: [user]) }

  fab!(:query) { DiscourseDataExplorer::Query.find(-1) }

  let(:query_params) { [%w[from_days_ago 0], %w[duration_days 15]] }

  before { SiteSetting.data_explorer_enabled = true }

  describe ".generate" do
    it "returns [] if the recipient is not in query group" do
      Fabricate(:query_group, query: query, group: group)
      result =
        described_class.generate(
          query.id,
          query_params,
          [unauthorised_user.username, unauthorised_group.name],
        )

      expect(result).to eq []
    end

    it "returns a list of pms for authorised users" do
      SiteSetting.personal_message_enabled_groups = group.id
      DiscourseDataExplorer::ResultToMarkdown.expects(:convert).returns("le table")
      freeze_time

      result = described_class.generate(query.id, query_params, [user.username])

      expect(result).to eq(
        [
          {
            "title" => "Scheduled Report for #{query.name}",
            "target_usernames" => [user.username],
            "raw" =>
              "Hi #{user.username}, your data explorer report is ready.\n\n" +
                "Query Name:\n#{query.name}\n\nHere are the results:\nle table\n\n" +
                "<a href='#{Discourse.base_url}/admin/plugins/explorer?id=#{query.id}'>View query in Data Explorer</a>\n\n" +
                "Report created at #{Time.zone.now.strftime("%Y-%m-%d at %H:%M:%S")} (#{Time.zone.name})",
          },
        ],
      )
    end

    it "still returns a list of pms if a group or user does not exist" do
      Fabricate(:query_group, query: query, group: group)

      SiteSetting.personal_message_enabled_groups = group.id
      DiscourseDataExplorer::ResultToMarkdown.expects(:convert).returns("le table")
      freeze_time

      result = described_class.generate(query.id, query_params, [group.name, "non-existent-group"])

      expect(result).to eq(
        [
          {
            "title" => "Scheduled Report for #{query.name}",
            "target_group_names" => [group.name],
            "raw" =>
              "Hi #{group.name}, your data explorer report is ready.\n\n" +
                "Query Name:\n#{query.name}\n\nHere are the results:\nle table\n\n" +
                "<a href='#{Discourse.base_url}/admin/plugins/explorer?id=#{query.id}'>View query in Data Explorer</a>\n\n" +
                "Report created at #{Time.zone.now.strftime("%Y-%m-%d at %H:%M:%S")} (#{Time.zone.name})",
          },
        ],
      )
    end

    it "works with email recipients" do
      DiscourseDataExplorer::ResultToMarkdown.expects(:convert).returns("le table")

      email = "john@doe.com"
      result = described_class.generate(query.id, query_params, [email])

      expect(result).to eq(
        [
          {
            "title" => "Scheduled Report for #{query.name}",
            "target_usernames" => [email],
            "raw" =>
              "Hi #{email}, your data explorer report is ready.\n\n" +
                "Query Name:\n#{query.name}\n\nHere are the results:\nle table\n\n" +
                "<a href='#{Discourse.base_url}/admin/plugins/explorer?id=#{query.id}'>View query in Data Explorer</a>\n\n" +
                "Report created at #{Time.zone.now.strftime("%Y-%m-%d at %H:%M:%S")} (#{Time.zone.name})",
          },
        ],
      )
    end

    it "works with duplicate recipients" do
      DiscourseDataExplorer::ResultToMarkdown.expects(:convert).returns("table data")

      result = described_class.generate(query.id, query_params, [user.username, user.username])

      expect(result).to eq(
        [
          {
            "title" => "Scheduled Report for #{query.name}",
            "target_usernames" => [user.username],
            "raw" =>
              "Hi #{user.username}, your data explorer report is ready.\n\n" +
                "Query Name:\n#{query.name}\n\nHere are the results:\ntable data\n\n" +
                "<a href='#{Discourse.base_url}/admin/plugins/explorer?id=#{query.id}'>View query in Data Explorer</a>\n\n" +
                "Report created at #{Time.zone.now.strftime("%Y-%m-%d at %H:%M:%S")} (#{Time.zone.name})",
          },
        ],
      )
    end
  end
end
