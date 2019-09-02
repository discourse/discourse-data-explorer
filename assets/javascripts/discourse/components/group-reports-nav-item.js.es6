import { ajax } from "discourse/lib/ajax";

export default Ember.Component.extend({
  group: null,
  showReportsTab: false,

  checkForReports() {
    const p1 = ajax(`/g/${this.group.name}/reports`);
    return p1.then(response => {
      return this.set("showReportsTab", response.queries.length > 0);
    });
  },

  init(args) {
    this.set("group", args.group);
    let usersGroupIds = this.currentUser.groups.map(g => g.id);
    if (usersGroupIds.includes(this.group.id)) {
      // User is apart of the group. Now check if the group has reports
      this.checkForReports();
    }
    this._super(args);
  }
});
