# frozen_string_literal: true

describe "RecurringDataExplorerResultPm" do
  fab!(:automation) do
    Fabricate(
      :automation,
      script: DiscourseAutomation::Scriptable::RECURRING_DATA_EXPLORER_RESULT_PM,
      trigger: "recurring",
    )
  end

  fab!(:admin) { Fabricate(:admin) }
  fab!(:user) { Fabricate(:user) }
  fab!(:another_user) { Fabricate(:user) }
  fab!(:group_user) { Fabricate(:user) }
  fab!(:not_allowed_user) { Fabricate(:user) }
  fab!(:group) { Fabricate(:group, users: [user, another_user]) }
  fab!(:another_group) { Fabricate(:group, users: [group_user]) }
  let!(:recipients) { [user.username, not_allowed_user.username, another_user.username, another_group.name] }

  before do
    SiteSetting.data_explorer_enabled = true
    SiteSetting.discourse_automation_enabled = true

    @query = DataExplorer::Query.find_or_create_by!(Queries.default["-8"].to_h)
    @query.query_groups.find_or_create_by!(group_id: group.id)
    @query.query_groups.find_or_create_by!(group_id: another_group.id)

    automation.upsert_field!("query_id", "choices", { value: @query.id })
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
        expect {
          Jobs::DiscourseAutomationTracker.new.execute
        }.to change { Topic.count }.by(3)

        title = "Scheduled Report for #{@query.name}"
        expect(Topic.last(3).pluck(:title)).to eq([title, title, title])
      end
    end

    it "ensures only allowed users in recipients field receive reports via pm" do
      expect do
        automation.update(last_updated_by_id: admin.id)
        automation.trigger!
      end.to change { Topic.count }.by(3)

      created_topics = Topic.last(3)
      expect(created_topics.pluck(:archetype)).to eq([Archetype.private_message, Archetype.private_message, Archetype.private_message])
      expect(created_topics.map { |t| t.allowed_users.pluck(:username) }).to match_array([
        [user.username, Discourse.system_user.username],
        [another_user.username, Discourse.system_user.username],
        [group_user.username, Discourse.system_user.username],
      ])
    end

    it "has appropriate content from the report generator" do
      automation.update(last_updated_by_id: admin.id)
      automation.trigger!

      expect(Post.last.raw).to include("Hi #{group_user.username}, your data explorer report is ready.\n\nQuery Name:\nUser Participation Statistics")
    end
  end
end
