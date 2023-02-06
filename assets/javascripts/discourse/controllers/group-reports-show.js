import Controller from "@ember/controller";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { ajax } from "discourse/lib/ajax";
import Bookmark, {
  NO_REMINDER_ICON,
  WITH_REMINDER_ICON,
} from "discourse/models/bookmark";
import { openBookmarkModal } from "discourse/controllers/bookmark";
import { action } from "@ember/object";
import { bind } from "discourse-common/utils/decorators";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";

export default class GroupReportsShowController extends Controller {
  @service currentUser;

  @tracked showResults = false;
  @tracked loading = false;
  @tracked results = this.model.results;
  @tracked queryGroupBookmark = this.queryGroup?.bookmark;

  explain = false;

  get hasParams() {
    return this.model.param_info.length > 0;
  }

  get bookmarkLabel() {
    return this.queryGroupBookmark
      ? "bookmarked.edit_bookmark"
      : "bookmarked.title";
  }

  get bookmarkIcon() {
    if (this.queryGroupBookmark && this.queryGroupBookmark.reminder_at) {
      return WITH_REMINDER_ICON;
    }
    return NO_REMINDER_ICON;
  }

  get bookmarkClassName() {
    return this.queryGroupBookmark
      ? ["query-group-bookmark", "bookmarked"].join(" ")
      : "query-group-bookmark";
  }

  @bind
  async run() {
    this.loading = true;
    this.showResults = false;

    try {
      const response = await ajax(
        `/g/${this.get("group.name")}/reports/${this.model.id}/run`,
        {
          type: "POST",
          data: {
            params: JSON.stringify(this.model.params),
            explain: this.explain,
          },
        }
      );

      this.results = response;
      if (!response.success) {
        return;
      }
      this.showResults = true;
    } catch (error) {
      if (
        error.jqXHR &&
        error.jqXHR.status === 422 &&
        error.jqXHR.responseJSON
      ) {
        this.results = error.jqXHR.responseJSON;
      } else {
        popupAjaxError(error);
      }
    } finally {
      this.loading = false;
    }
  }

  @action
  toggleBookmark() {
    return openBookmarkModal(
      this.queryGroupBookmark ||
        Bookmark.create({
          bookmarkable_type: "DataExplorer::QueryGroup",
          bookmarkable_id: this.queryGroup.id,
          user_id: this.currentUser.id,
        }),
      {
        onAfterSave: (savedData) => {
          const bookmark = this.store.createRecord("bookmark", savedData);
          this.queryGroupBookmark = bookmark;
          this.appEvents.trigger(
            "bookmarks:changed",
            savedData,
            bookmark.attachedTo()
          );
        },
        onAfterDelete: () => {
          this.queryGroupBookmark = null;
        },
      }
    );
  }

  // This is necessary with glimmer's one way data stream to get the child's
  // changes of 'params' to bubble up.
  @action
  updateParams(identifier, value) {
    this.set(`model.params.${identifier}`, value);
  }
}
