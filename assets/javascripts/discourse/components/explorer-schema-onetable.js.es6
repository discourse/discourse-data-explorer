export default Ember.Component.extend({
  classNameBindings: [":schema-table", "open"],
  tagName: "li",

  open: Em.computed.alias("table.open"),

  _bindClicks: function() {
    const self = this;
    this.$()
      .find(".schema-table-name")
      .click(function(e) {
        self.set("open", !self.get("open"));
        e.preventDefault();
      });
  }.on("didInsertElement"),

  _cleanup: function() {
    this.$()
      .find(".schema-table-name")
      .off("click");
  }.on("willDestroyElement")
});
