# frozen_string_literal: true

class DataExplorer::SmallBadgeSerializer < ApplicationSerializer
  attributes :id, :name, :badge_type, :description, :icon
end
