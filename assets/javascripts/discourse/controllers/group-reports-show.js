import { popupAjaxError } from "discourse/lib/ajax-error";
import { ajax } from "discourse/lib/ajax";
import Bookmark, {
  NO_REMINDER_ICON,
  WITH_REMINDER_ICON,
} from "discourse/models/bookmark";
import { openBookmarkModal } from "discourse/controllers/bookmark";
import discourseComputed from "discourse-common/utils/decorators";
import { alias, gt } from "@ember/object/computed";

export default Ember.Controller.extend({
  showResults: false,
  explain: false,
  loading: false,
  results: alias("model.results"),
  hasParams: gt("model.param_info.length", 0),

  actions: {
    run() {
      this.setProperties({ loading: true, showResults: false });
      ajax(`/g/${this.get("group.name")}/reports/${this.model.id}/run`, {
        type: "POST",
        data: {
          params: JSON.stringify(this.model.params),
          explain: this.explain,
        },
      })
        .then((result) => {
          this.set("results", result);
          if (!result.success) {
            return;
          }

          this.set("showResults", true);
        })
        .catch((err) => {
          if (err.jqXHR && err.jqXHR.status === 422 && err.jqXHR.responseJSON) {
            this.set("results", err.jqXHR.responseJSON);
          } else {
            popupAjaxError(err);
          }
        })
        .finally(() => this.set("loading", false));
    },

    toggleBookmark() {
      return openBookmarkModal(
        this.queryGroup.bookmark ||
          Bookmark.create({
            bookmarkable_type: "DataExplorer::QueryGroup",
            bookmarkable_id: this.queryGroup.id,
            user_id: this.currentUser.id,
          }),
        {
          onAfterSave: (savedData) => {
            const bookmark = Bookmark.create(savedData);
            this.set("queryGroup.bookmark", bookmark);
            this.appEvents.trigger(
              "bookmarks:changed",
              savedData,
              bookmark.attachedTo()
            );
          },
          onAfterDelete: () => {
            this.set("queryGroup.bookmark", null);
          },
        }
      );
    },
  }, // actions

  @discourseComputed("queryGroup.bookmark")
  bookmarkLabel(bookmark) {
    return bookmark ? "bookmarked.edit_bookmark" : "bookmarked.title";
  },

  @discourseComputed("queryGroup.bookmark")
  bookmarkIcon(bookmark) {
    if (bookmark && bookmark.reminder_at) {
      return WITH_REMINDER_ICON;
    }
    return NO_REMINDER_ICON;
  },

  @discourseComputed("queryGroup.bookmark")
  bookmarkClassName(bookmark) {
    return bookmark
      ? ["bookmark", "bookmarked", "query-group-bookmark"].join(" ")
      : ["bookmark", "query-group-bookmark"].join(" ");
  },
});
