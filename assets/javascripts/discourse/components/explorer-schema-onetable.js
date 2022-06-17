import { on } from "discourse-common/utils/decorators";
import { reads } from "@ember/object/computed";

export default Ember.Component.extend({
  classNameBindings: [":schema-table", "open"],
  tagName: "li",

  open: reads("table.open"),

  @on("didInsertElement")
  _bindClicks() {
    $(this.element)
      .find(".schema-table-name")
      .click((e) => {
        this.set("table.open", !this.table.open);
        e.preventDefault();
      });
  },

  @on("willDestroyElement")
  _cleanup() {
    $(this.element).find(".schema-table-name").off("click");
  },
});
