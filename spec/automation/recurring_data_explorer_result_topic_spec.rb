# frozen_string_literal: true

require "rails_helper"

describe "RecurringDataExplorerResultTopic" do
  fab!(:admin)

  fab!(:user)
  fab!(:another_user) { Fabricate(:user) }
  fab!(:group_user) { Fabricate(:user) }
  fab!(:not_allowed_user) { Fabricate(:user) }
  fab!(:topic)

  fab!(:group) { Fabricate(:group, users: [user, another_user]) }
  fab!(:another_group) { Fabricate(:group, users: [group_user]) }

  fab!(:automation) do
    Fabricate(:automation, script: "recurring_data_explorer_result_topic", trigger: "recurring")
  end
  fab!(:query)
  fab!(:query_group) { Fabricate(:query_group, query: query, group: group) }
  fab!(:query_group) { Fabricate(:query_group, query: query, group: another_group) }

  before do
    SiteSetting.data_explorer_enabled = true
    SiteSetting.discourse_automation_enabled = true

    automation.upsert_field!("query_id", "choices", { value: query.id })
    automation.upsert_field!("topic_id", "text", { value: topic.id })
    automation.upsert_field!(
      "query_params",
      "key-value",
      { value: [%w[from_days_ago 0], %w[duration_days 15]] },
    )
    automation.upsert_field!(
      "recurrence",
      "period",
      { value: { interval: 1, frequency: "day" } },
      target: "trigger",
    )
    automation.upsert_field!("start_date", "date_time", { value: 2.minutes.ago }, target: "trigger")
  end

  context "when using recurring trigger" do
    it "sends the post at recurring date_date" do
      freeze_time 1.day.from_now do
        expect { Jobs::DiscourseAutomation::Tracker.new.execute }.to change {
          topic.reload.posts.count
        }.by(1)

        expect(topic.posts.last.raw).to include("Scheduled Report for #{query.name}")
      end
    end

    it "has appropriate content from the report generator" do
      automation.update(last_updated_by_id: admin.id)
      automation.trigger!

      expect(topic.reload.posts.last.raw).to include("Query Name:\n#{query.name}")
    end

    it "does not create the post if skip_empty" do
      automation.upsert_field!("skip_empty", "boolean", { value: true })

      automation.update(last_updated_by_id: admin.id)

      # Done because the fabricated query selects all users
      User.destroy_all

      expect { automation.trigger! }.to_not change { Post.count }
    end
  end
end
