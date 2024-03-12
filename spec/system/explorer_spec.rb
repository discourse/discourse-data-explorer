# frozen_string_literal: true

RSpec.describe "Explorer", type: :system, js: true do
  fab!(:admin)
  fab!(:group) { Fabricate(:group, name: "group") }
  fab!(:group_user) { Fabricate(:group_user, user: admin, group: group) }

  before do
    SiteSetting.data_explorer_enabled = true
    sign_in admin
  end

  context "with a query using a default param" do
    fab!(:query_1) do
      Fabricate(
        :query,
        name: "My default param query",
        description: "Test default param query",
        sql: "-- [params]\n-- string :limit = 42\n\nSELECT * FROM users LIMIT :limit",
        user: admin,
      )
    end
    fab!(:query_group_1) { Fabricate(:query_group, query: query_1, group: group) }

    it "pre-fills the field with the default param" do
      visit("/g/group/reports/#{query_1.id}")

      expect(page).to have_field("limit", with: 42)
    end
  end

  context "with a group_list param" do
    fab!(:q2) do
      Fabricate(
        :query,
        name: "My query with group_list",
        description: "Test group_list query",

        sql: "-- [params]\n-- group_list :groups\n\nSELECT g.id,g.name FROM groups g WHERE g.name IN(:groups) ORDER BY g.name ASC",
        user: admin,
      )
    end

    it "supports setting a group_list param" do
      visit("/admin/plugins/explorer?id=#{q2.id}&params=%7B\"groups\"%3A\"admins%2Ctrust_level_1\"%7D")
      find(".query-run .btn-primary").click

      expect(page).to have_css(".query-results .result-header")

      expect(page).to have_css(".query-results tbody tr:nth-child(1) td:nth-child(2)", text: "admins")
      expect(page).to have_css(".query-results tbody tr:nth-child(2) td:nth-child(2)", text: "trust_level_1")
    end
  end

end
