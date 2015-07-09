export default Ember.Component.extend({
  classNames: ['fa', 'fa-info', 'enum-info'],
  tagName: 'i',

  enuminfo: function() {
    const hash = this.get('col.enum');
    let result = [];
    for (let key in hash) {
      if (!hash.hasOwnProperty(key)) { continue; }
      result.push({value: key, name: hash[key]});
    }
    return result;
  }.property('col.enum')
});
