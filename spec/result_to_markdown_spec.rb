# frozen_string_literal: true

describe DiscourseDataExplorer::ResultToMarkdown do
  fab!(:user) { Fabricate(:user) }
  fab!(:query) { DiscourseDataExplorer::Query.find(-1) }
  let(:query_params) { [%w[from_days_ago 0], %w[duration_days 15]] }
  let(:query_result) { DiscourseDataExplorer::DataExplorer.run_query(query, query_params) }

  before { SiteSetting.data_explorer_enabled = true }

  describe ".convert" do
    it "format results as a markdown table" do
      result = described_class.convert(query_result[:pg_result])

      table = <<~MD
        | liker_user | liked_user | count |
        | :-----: | :-----: | :-----: |
      MD

      expect(result).to include(table)
    end
  end
end
