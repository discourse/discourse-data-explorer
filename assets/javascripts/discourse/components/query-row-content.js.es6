import binarySearch from 'discourse/plugins/discourse-data-explorer/discourse/lib/binary-search';


const QueryRowContentComponent = Ember.Component.extend({
  tagName: "tr",

  transformedUserTable: function() {
    return transformedRelTable(this.get('extra.relations.user'));
  }.property('extra.relations.user'),

  render: function(buffer) {
    const self = this;
    const row = this.get('row');
    const relations = this.get('extra.relations');

    const parts = this.get('columnTemplates').map(function(t, idx) {
      const params = {};
      if (t.name === "text") {
        return row[idx];
      } else if (t.name === "user") {
        params.user = self.get('parent').lookupUser(parseInt(row[idx]));
      } else {
        params.value = row[idx];
      }

      return new Handlebars.SafeString(t.template(params));
    });

    buffer.push("<td>" + parts.join("</td><td>") + "</td>");
  }
});

export default QueryRowContentComponent;
