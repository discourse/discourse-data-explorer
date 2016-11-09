import debounce from 'discourse/lib/debounce';
import highlightSyntax from 'discourse/lib/highlight-syntax';
import { bufferedRender } from 'discourse-common/lib/buffered-render';

export default Ember.Component.extend(bufferedRender({
  buildBuffer(buffer) {
    buffer.push("<pre><code class='" + this.get('codeClass') + "'>");
    buffer.push(Handlebars.Utils.escapeExpression(this.get('value')));
    buffer.push("</code></pre>");
  },

  _refreshHighlight: debounce(function() {
    this.rerenderBuffer();
  }, 50).observes('value'),

  _applyHighlight: function() {
    highlightSyntax(this.$());
  }.on('didInsertElement')
}));
