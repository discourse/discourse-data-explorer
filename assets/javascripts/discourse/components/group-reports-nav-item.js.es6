import { ajax } from "discourse/lib/ajax";

export default Ember.Component.extend({
  group: null,
  showReportsTab: false,

  checkForReports() {
    return ajax(`/g/${this.group.name}/reports`).then(response => {
      return this.set("showReportsTab", response.queries.length > 0);
    });
  },

  init(args) {
    this.set("group", args.group);
    if (
      (this.get("currentUser.groups") || []).some(g => g.id === this.group.id)
    ) {
      // User is a part of the group. Now check if the group has reports
      this.checkForReports();
    }

    this._super(args);
  }
});
