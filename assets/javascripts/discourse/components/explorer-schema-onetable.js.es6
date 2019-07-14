import { on } from "ember-addons/ember-computed-decorators";

export default Ember.Component.extend({
  classNameBindings: [":schema-table", "open"],
  tagName: "li",

  open: Ember.computed.alias("table.open"),

  @on("didInsertElement")
  _bindClicks() {
    $(this.element)
      .find(".schema-table-name")
      .click(e => {
        this.set("open", !this.open);
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
