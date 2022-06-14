import { ajax } from "discourse/lib/ajax";
import DiscourseRoute from "discourse/routes/discourse";
import { action } from "@ember/object";

export default DiscourseRoute.extend({
  controllerName: "group-reports-show",

  model(params) {
    const group = this.modelFor("group");
    return ajax(`/g/${group.name}/reports/${params.query_id}`)
      .then((response) => {
        let query = response.query;
        let queryGroup = response.query_group;

        const queryParamInfo = query.param_info;

        const queryParams = queryParamInfo.reduce((acc, param) => {
          acc[param.identifier] = param.default;
          return acc;
        }, {});

        return {
          model: Object.assign({ params: queryParams }, query),
          group,
          queryGroup,
        };
      })
      .catch(() => {
        this.transitionTo("group.members", group);
      });
  },

  setupController(controller, model) {
    controller.setProperties(model);
  },

  @action
  refreshModel() {
    this.refresh();
    return false;
  },
});
