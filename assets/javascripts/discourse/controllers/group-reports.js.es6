import showModal from "discourse/lib/show-modal";
import Query from "discourse/plugins/discourse-data-explorer/discourse/models/query";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { ajax } from "discourse/lib/ajax";
import {
  default as computed,
  observes
} from "ember-addons/ember-computed-decorators";

const NoQuery = Query.create({ name: "No queries", fake: true });

export default Ember.Controller.extend({
})
