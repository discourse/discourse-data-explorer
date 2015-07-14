import highlightSyntax from 'discourse/lib/highlight-syntax';

export default Ember.Component.extend({
  render(buffer) {
    buffer.push("<pre><code class='" + this.get('codeClass') + "'>");
    buffer.push(Handlebars.Utils.escapeExpression(this.get('value')));
    buffer.push("</code></pre>");
  },

  _refreshHighlight: Discourse.debounce(function() {
    this.rerender();
  }, 50).observes('value'),

  _applyHighlight: function() {
    highlightSyntax(this.$());
  }.on('didInsertElement')
});
