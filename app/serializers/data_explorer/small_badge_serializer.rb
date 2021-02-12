# frozen_string_literal: true

class DataExplorer::SmallBadgeSerializer < ApplicationSerializer
  attributes :id, :name, :display_name, :badge_type, :description, :icon
end
