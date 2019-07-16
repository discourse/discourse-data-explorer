import { on, observes } from "ember-addons/ember-computed-decorators";
import debounce from "discourse/lib/debounce";
import highlightSyntax from "discourse/lib/highlight-syntax";
import { bufferedRender } from "discourse-common/lib/buffered-render";

export default Ember.Component.extend(
  bufferedRender({
    buildBuffer(buffer) {
      buffer.push("<pre><code class='" + this.codeClass + "'>");
      buffer.push(Handlebars.Utils.escapeExpression(this.value));
      buffer.push("</code></pre>");
    },

    @observes("value")
    _refreshHighlight: debounce(function() {
      this.rerenderBuffer();
    }, 50),

    @on("didInsertElement")
    _applyHighlight() {
      highlightSyntax($(this.element));
    }
  })
);
