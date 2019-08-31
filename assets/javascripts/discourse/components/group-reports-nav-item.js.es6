import { ajax } from "discourse/lib/ajax";

export default Ember.Component.extend({
  groupId: null,
  showReportsTab: false,

  checkForReports() {
    const p1 = ajax(`/explorer/show_reports_tab?group_id=${this.groupId}`);
    return p1.then(show => {
      return this.set("showReportsTab", show);
    });
  },

  init(args) {
    this.set("groupId", args.groupId);
    let usersGroupIds = this.currentUser.groups.map(g => g.id);
    if (usersGroupIds.includes(this.groupId)) {
      // User is apart of the group. Now check if the group has reports
      this.checkForReports();
    }
    this._super(args);
  }
});
