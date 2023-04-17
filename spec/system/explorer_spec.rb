# frozen_string_literal: true

RSpec.describe "Explorer", type: :system, js: true do
  fab!(:current_user) { Fabricate(:admin) }
  fab!(:group) { Fabricate(:group, name: "group") }
  fab!(:group_user) { Fabricate(:group_user, user: current_user, group: group) }

  before { SiteSetting.data_explorer_enabled = true }

  context "with a query using a default param" do
    fab!(:query_1) do
      Fabricate(
        :query,
        name: "My default param query",
        description: "Test default param query",
        sql: "-- [params]\n-- string :limit = 42\n\nSELECT * FROM users LIMIT :limit",
        user: current_user,
      )
    end
    fab!(:query_group_1) { Fabricate(:query_group, query: query_1, group: group) }

    it "pre-fills the field with the default param" do
      sign_in(current_user)
      visit("/g/group/reports/#{query_1.id}")

      expect(page).to have_field("limit", with: 42)
    end
  end
end
