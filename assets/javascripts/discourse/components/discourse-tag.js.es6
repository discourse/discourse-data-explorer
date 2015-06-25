export default Ember.Component.extend({
  tagName: 'a',
  classNameBindings: [':discourse-tag'],
  attributeBindings: ['href', 'style'],

  href: function() {
    return "/tags/" + this.get('tagId');
  }.property('tagId'),

  style: function() {
    const count = parseFloat(this.get('count')),
        minCount = parseFloat(this.get('minCount')),
        maxCount = parseFloat(this.get('maxCount'));

    if (count && maxCount && minCount) {
      let ratio = (count - minCount) / maxCount;
      if (ratio) {
        ratio = ratio + 1.0;
        return "font-size: " + ratio + "em";
      }
    }
  }.property('count', 'scaleTo'),

  render(buffer) {
    buffer.push(Handlebars.Utils.escapeExpression(this.get('tagId')));
  },

  click(e) {
    e.preventDefault();
    Discourse.URL.routeTo(this.get('href'));
    return true;
  }
});
