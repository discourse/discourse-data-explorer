# frozen_string_literal: true

class DataExplorerQueryGroupBookmarkable < BaseBookmarkable
  def self.model
    DataExplorer::QueryGroup
  end

  def self.serializer
    UserDataExplorerQueryGroupBookmarkSerializer
  end

  def self.preload_associations
    [:data_explorer_queries, :groups]
  end

  def self.list_query(user, guardian)
    group_ids = user.visible_groups.pluck(:id) 
    return if group_ids.empty?
    user.bookmarks_of_type("DataExplorer::QueryGroup")
    .joins("INNER JOIN data_explorer_query_groups ON data_explorer_query_groups.id = bookmarks.bookmarkable_id
          AND bookmarks.bookmarkable_type = 'DataExplorer::QueryGroup'")
    .joins("LEFT JOIN data_explorer_queries ON data_explorer_queries.id = data_explorer_query_groups.query_id")
    .where("data_explorer_query_groups.group_id IN (?)", group_ids)
  end

  # Searchable only by data_explorer_queries name and description
  def self.search_query(bookmarks, query, ts_query, &bookmarkable_search)
    bookmarkable_search.call(bookmarks, 
      "data_explorer_queries.name ILIKE :q")
  end

  def self.reminder_handler(bookmark)
    bookmark.user.notifications.create!(
      notification_type: Notification.types[:bookmark_reminder],
      data: {
        title: bookmark.bookmarkable.query.name,
        display_username: bookmark.user.username,
        bookmark_name: bookmark.name,
        bookmarkable_url: "/g/#{bookmark.bookmarkable.group.name}/reports/#{bookmark.bookmarkable.query.id}"
      }.to_json
    )
  end

  def self.reminder_conditions(bookmark)
    bookmark.bookmarkable.present?
  end

  def self.can_see?(guardian, bookmark)
    return false if !bookmark.bookmarkable.group
    guardian.user_is_a_member_of_group?(bookmark.bookmarkable.group)
  end

end
