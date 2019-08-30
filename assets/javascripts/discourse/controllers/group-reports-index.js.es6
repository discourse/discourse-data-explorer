import Query from "discourse/plugins/discourse-data-explorer/discourse/models/query";
import { ajax } from "discourse/lib/ajax";
import {
  default as computed,
  observes
} from "ember-addons/ember-computed-decorators";

export default Ember.Controller.extend({
  queries: Ember.computed.filter('model', function(query) {
    return query.group_ids.includes(this.groupId.toString())
  }),
})
