import { ajax } from "discourse/lib/ajax";

export default {
  shouldRender(args, component) {
    let usersGroupIds = component.currentUser.groups.map(g => g.id);
    if (!usersGroupIds.includes(args.groupId)) return false; // User not a part of group

    // Return true until we figure out the question below
    return true;

    // Can we use a promise here and check whether or not the group has any reports?
    // This does not wait to return the value of the promise; is there a better spot?
    const p1 = ajax(`/explorer/show_reports_tab?group_id=${args.groupId}`);
    return p1.then(show => {
      return show;
    });
  }
};
