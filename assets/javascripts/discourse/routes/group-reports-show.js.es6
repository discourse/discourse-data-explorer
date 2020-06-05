import { ajax } from "discourse/lib/ajax";
import DiscourseRoute from "discourse/routes/discourse";

export default DiscourseRoute.extend({
  controllerName: "group-reports-show",

  model(params) {
    const group = this.modelFor("group");
    return ajax(`/g/${group.name}/reports/${params.query_id}`)
      .then(response => {
        const queryParamInfo = response.query.param_info;
        const queryParams = queryParamInfo.reduce((acc, param) => {
          acc[param.identifier] = param.default;
          return acc;
        }, {});

        return {
          model: Object.assign({ params: queryParams }, response.query),
          group
        };
      })
      .catch(() => {
        this.transitionTo("group.members", group);
      });
  },

  setupController(controller, model) {
    controller.setProperties(model);
  },

  actions: {
    refreshModel() {
      this.refresh();
      return false;
    }
  }
});
