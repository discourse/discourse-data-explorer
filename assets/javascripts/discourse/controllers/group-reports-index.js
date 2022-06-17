import { alias } from "@ember/object/computed";

export default Ember.Controller.extend({
  queries: alias("model.queries"),
});
