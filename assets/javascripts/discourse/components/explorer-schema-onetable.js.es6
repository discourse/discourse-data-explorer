import { on } from "discourse-common/utils/decorators";

export default Ember.Component.extend({
  classNameBindings: [":schema-table", "open"],
  tagName: "li",

  open: Ember.computed.reads("table.open"),

  @on("didInsertElement")
  _bindClicks() {
    $(this.element)
      .find(".schema-table-name")
      .click(e => {
        this.set("table.open", !this.table.open);
        e.preventDefault();
      });
  },

  @on("willDestroyElement")
  _cleanup() {
    $(this.element)
      .find(".schema-table-name")
      .off("click");
  }
});
