# frozen_string_literal: true

require "rails_helper"

describe "RecurringDataExplorerResultPm" do
  fab!(:admin)

  fab!(:user)
  fab!(:another_user) { Fabricate(:user) }
  fab!(:group_user) { Fabricate(:user) }
  fab!(:not_allowed_user) { Fabricate(:user) }

  fab!(:group) { Fabricate(:group, users: [user, another_user]) }
  fab!(:another_group) { Fabricate(:group, users: [group_user]) }

  fab!(:automation) do
    Fabricate(:automation, script: "recurring_data_explorer_result_pm", trigger: "recurring")
  end
  fab!(:query)
  fab!(:query_group) { Fabricate(:query_group, query: query, group: group) }
  fab!(:query_group) { Fabricate(:query_group, query: query, group: another_group) }

  let!(:recipients) do
    [user.username, not_allowed_user.username, another_user.username, another_group.name]
  end

  before do
    SiteSetting.data_explorer_enabled = true
    SiteSetting.discourse_automation_enabled = true

    automation.upsert_field!("query_id", "choices", { value: query.id })
    automation.upsert_field!("recipients", "email_group_user", { value: recipients })
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
    it "sends the pm at recurring date_date" do
      freeze_time 1.day.from_now do
        expect { Jobs::DiscourseAutomationTracker.new.execute }.to change { Topic.count }.by(3)

        title = "Scheduled Report for #{query.name}"
        expect(Topic.last(3).pluck(:title)).to eq([title, title, title])
      end
    end

    it "ensures only allowed users in recipients field receive reports via pm" do
      expect do
        automation.update(last_updated_by_id: admin.id)
        automation.trigger!
      end.to change { Topic.count }.by(3)

      user_topics = Topic.first(2)
      group_topics = Topic.last(1)
      expect(Topic.last(3).pluck(:archetype)).to eq(
        [Archetype.private_message, Archetype.private_message, Archetype.private_message],
      )
      expect(user_topics.map { |t| t.allowed_users.pluck(:username).sort }).to match_array(
        [
          [user.username, Discourse.system_user.username],
          [another_user.username, Discourse.system_user.username],
        ],
      )
      expect(group_topics.map { |t| t.allowed_groups.pluck(:name).sort }).to match_array(
        [[another_group.name]],
      )
    end

    it "has appropriate content from the report generator" do
      automation.update(last_updated_by_id: admin.id)
      automation.trigger!

      expect(Post.last.raw).to include(
        "Hi #{another_group.name}, your data explorer report is ready.\n\nQuery Name:\n#{query.name}",
      )
    end

    it "does not send the PM if skip_empty" do
      automation.upsert_field!("skip_empty", "boolean", { value: true })

      automation.update(last_updated_by_id: admin.id)

      expect { automation.trigger! }.to_not change { Post.count }
    end
  end
end
