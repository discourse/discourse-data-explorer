var ColumnHandlers = [];
var AssistedHandlers = {};
const Escape = Handlebars.Utils.escapeExpression;

import avatarTemplate from 'discourse/lib/avatar-template';
import { categoryLinkHTML } from 'discourse/helpers/category-link';

var defaultFallback = function(buffer, content, defaultRender) { defaultRender(buffer, content); };

function isoYMD(date) {
  return date.getUTCFullYear() + "-" + date.getUTCMonth() + "-" + date.getUTCDate();
}
function randomIdShort() {
  return 'xxxxxxxx'.replace(/[xy]/g, function() {
    return (Math.random() * 16 | 0).toString(16);
  });
}

function transformedRelTable(table) {
  const result = {};
  table.forEach(function(item) {
    result[item.id] = item;
  });
  return result;
}

const QueryResultComponent = Ember.Component.extend({
  layoutName: 'explorer-query-result',

  rows: Em.computed.alias('content.rows'),
  columns: Em.computed.alias('content.columns'),
  params: Em.computed.alias('content.params'),
  explainText: Em.computed.alias('content.explain'),

  hasExplain: Em.computed.notEmpty('content.explain'),
  colCount: function() {
    return this.get('content.columns').length;
  }.property('content.columns.length'),

  duration: function() {
    return I18n.t('explorer.run_time', {value: I18n.toNumber(this.get('content.duration'), {precision: 1})});
  }.property('content.duration'),

  parameterAry: function() {
    let arr = [];
    const params = this.get('params');
    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        arr.push({key: key, value: params[key]});
      }
    }
    return arr;
  }.property('params.@each'),

  columnDispNames: function() {
    const templates = this.get('columnTemplates');
    const self = this;
    if (!this.get('columns')) {
      return [];
    }
    return this.get('columns').map(function(colName, idx) {
      if (colName.endsWith("_id")) {
        return colName.slice(0, -3);
      }
      const dIdx = colName.indexOf('$');
      if (dIdx >= 0) {
        return colName.substring(dIdx + 1);
      }
      return colName;
    });
  }.property('content', 'columns.@each'),

  columnTemplates: function() {
    const self = this;
    if (!this.get('columns')) {
      return [];
    }
    return this.get('columns').map(function(colName, idx) {
      let viewName = "text";
      if (self.get('content.colrender')[idx]) {
        viewName = self.get('content.colrender')[idx];
      }
      return {name: viewName, template: self.container.lookup('template:explorer/' + viewName + '.raw')};
    });
  }.property('content', 'columns.@each'),

  transformedUserTable: function() {
    return transformedRelTable(this.get('content.relations.user'));
  }.property('content.relations.user'),

  lookupUser: function(id) {
    return this.get('transformedUserTable')[id];
  },

  downloadResult(format) {
    // Create a frame to submit the form in (?)
    // to avoid leaving an about:blank behind
    let windowName = randomIdShort();
    const newWindowContents = "<style>body{font-size:36px;display:flex;justify-content:center;align-items:center;}</style><body>Click anywhere to close this window once the download finishes.<script>window.onclick=function(){window.close()};</script>";

    const _ = window.open('data:text/html;base64,' + btoa(newWindowContents), windowName);

    let form = document.createElement("form");
    form.setAttribute('id', 'query-download-result');
    form.setAttribute('method', 'post');
    form.setAttribute('action', Discourse.getURL('/admin/plugins/explorer/queries/' + this.get('query.id') + '/run.' + format + '?download=1'));
    form.setAttribute('target', windowName);
    form.setAttribute('style', 'display:none;');

    function addInput(form, name, value) {
      let field;
      field = document.createElement('input');
      field.setAttribute('name', name);
      field.setAttribute('value', value);
      form.appendChild(field);
    }

    addInput(form, 'params', JSON.stringify(this.get('params')));
    addInput(form, 'explain', this.get('hasExplain'));
    addInput(form, 'limit', '1000000');

    Discourse.ajax('/session/csrf.json').then(function(csrf) {
      addInput(form, 'authenticity_token', csrf.csrf);

      document.body.appendChild(form);
      form.submit();
      Em.run.next('afterRender', function() {
        document.body.removeChild(form);
      })
    });
  },

  actions: {
    downloadResultJson() {
      this.downloadResult('json');
    },
    downloadResultCsv() {
      this.downloadResult('csv');
    }
  },

  parent: function() { return this; }.property()

});

export default QueryResultComponent;
