export default Ember.Component.extend({

  transformedSchema: function() {
    const schema = this.get('schema');

    for (let key in schema) {
      if (!schema.hasOwnProperty(key)) {
        continue;
      }

      schema[key].forEach(function(col) {
        let notes = false;
        if (col.is_nullable) {
          notes = "null";
        }
        if (col.column_default) {
          if (notes) {
            notes += ", default " + col.column_default;
          } else {
            notes = "default " + col.column_default;
          }
        }
        if (notes) {
          col.notes = notes;
          col.havetypeinfo = true;
        }

        if (col.enum) {
          col.havetypeinfo = true;
        }

      });
    }
    return schema;
  }.property('schema'),

  rfilter: function() {
    if (!Em.isBlank(this.get('filter'))) {
      return new RegExp(this.get('filter'));
    }
  }.property('filter'),

  filterTables: function(schema) {
    let tables = [];
    const filter = this.get('rfilter'),
      haveFilter = !!filter;

    for (let key in schema) {
      if (!schema.hasOwnProperty(key)) {
        continue;
      }
      if (!haveFilter) {
        tables.push({
          name: key,
          columns: schema[key],
          open: false
        });
        continue;
      }

      // Check the table name vs the filter
      if (filter.source == key || filter.source + "s" == key) {
        tables.unshift({
          name: key,
          columns: schema[key],
          open: haveFilter
        });
      } else if (filter.test(key)) {
        // whole table matches
        tables.push({
          name: key,
          columns: schema[key],
          open: haveFilter
        });
      } else {
        // filter the columns
        let filterCols = [];
        schema[key].forEach(function(col) {
          if (filter.source == col.column_name) {
            filterCols.unshift(col);
          } else if (filter.test(col.column_name)) {
            filterCols.push(col);
          }
        });
        if (!Em.isEmpty(filterCols)) {
          tables.push({
            name: key,
            columns: filterCols,
            open: haveFilter
          });
        }
      }
    }
    return tables;
  },

  triggerFilter: Discourse.debounce(function() {
    this.set('filteredTables', this.filterTables(this.get('transformedSchema')));
    this.set('loading', false);
  }, 500).observes('filter'),

  setLoading: function() {
    this.set('loading', true);
  }.observes('filter'),

  tables: function() {
    if (!this.get('filteredTables')) {
      this.set('loading', true);
      this.triggerFilter();
      return [];
    }
    return this.get('filteredTables');
  }.property('transformedSchema', 'filteredTables')
});
