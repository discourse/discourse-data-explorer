import {
  default as computed,
  observes
} from "discourse-common/utils/decorators";
import debounce from "discourse/lib/debounce";

export default Ember.Component.extend({
  actions: {
    collapseSchema() {
      this.set("hideSchema", true);
    }
  },

  @computed("schema")
  transformedSchema(schema) {
    for (let key in schema) {
      if (!schema.hasOwnProperty(key)) {
        continue;
      }

      schema[key].forEach(col => {
        const notes_components = [];
        if (col.primary) {
          notes_components.push("primary key");
        }
        if (col.is_nullable) {
          notes_components.push("null");
        }
        if (col.column_default) {
          notes_components.push("default " + col.column_default);
        }
        if (col.fkey_info) {
          notes_components.push("fkey " + col.fkey_info);
        }
        if (col.denormal) {
          notes_components.push("denormal " + col.denormal);
        }
        const notes = notes_components.join(", ");

        if (notes) {
          col.notes = notes;
        }

        if (col.enum || col.column_desc) {
          col.havepopup = true;
        }

        col.havetypeinfo = !!(col.notes || col.enum || col.column_desc);
      });
    }
    return schema;
  },

  @computed("filter")
  rfilter(filter) {
    if (!Ember.isBlank(filter)) {
      return new RegExp(filter);
    }
  },

  filterTables(schema) {
    let tables = [];
    const filter = this.rfilter,
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
      if (filter.source === key || filter.source + "s" === key) {
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
        schema[key].forEach(col => {
          if (filter.source === col.column_name) {
            filterCols.unshift(col);
          } else if (filter.test(col.column_name)) {
            filterCols.push(col);
          }
        });
        if (!Ember.isEmpty(filterCols)) {
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

  @observes("filter")
  triggerFilter: debounce(function() {
    this.set("filteredTables", this.filterTables(this.transformedSchema));
    this.set("loading", false);
  }, 500),

  @observes("filter")
  setLoading() {
    this.set("loading", true);
  },

  init() {
    this._super(...arguments);

    this.set("loading", true);
    this.triggerFilter();
  }
});
