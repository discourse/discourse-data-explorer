
const defaultRender = function(buffer, content) {
  buffer.push(Handlebars.Utils.escapeExpression(content));
};

const QueryRowContentComponent = Ember.Component.extend({
  tagName: "tr",

  render(buffer) {
    const row = this.get('row');
    const response = this.get('extra');
    this.get('colRenders').forEach(function(colRender, idx) {
      buffer.push("<td data-column-name=" + Handlebars.Utils.escapeExpression(colRender.name) + ">");
      colRender.render(buffer, row[idx], defaultRender, response);
      buffer.push("</td>");
    });
  }
});

export default QueryRowContentComponent;
