import { ajax } from "discourse/lib/ajax";

export default {
  shouldRender(args, component) {
    let usersGroupIds = component.currentUser.groups.map(g => g.id)
    if (!usersGroupIds.includes(args.groupId)) return false // User not a part of group

    return true
    // ajax(`/explorer/show_reports_tab?group_id=${args.groupId}`)
      // .then(showTab => {
        // return showTab
      // })
  }
}
