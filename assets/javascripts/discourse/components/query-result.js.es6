import { ajax } from 'discourse/lib/ajax';
import Badge from 'discourse/models/badge';
import { getOwner } from 'discourse-common/lib/get-owner';

function randomIdShort() {
  return 'xxxxxxxx'.replace(/[xy]/g, function() {
    /*eslint-disable*/
    return (Math.random() * 16 | 0).toString(16);
    /*eslint-enable*/
  });
}

function transformedRelTable(table, modelClass) {
  const result = {};
  table.forEach(function(item) {
    if (modelClass) {
      result[item.id] = modelClass.create(item);
    } else {
      result[item.id] = item;
    }
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
    if (!this.get('columns')) {
      return [];
    }
    return this.get('columns').map(function(colName) {
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

  fallbackTemplate: function() {
    return getOwner(this).lookup('template:explorer/text.raw');
  }.property(),

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

      // After `findRawTemplates` is in stable this should be updated to use that
      let template = getOwner(self).lookup('template:explorer/' + viewName + '.raw');
      if (!template) {
        template = Discourse.RAW_TEMPLATES[`javascripts/explorer/${viewName}`];
      }

      return {name: viewName, template };
    });
  }.property('content', 'columns.@each'),

  transformedUserTable: function() {
    return transformedRelTable(this.get('content.relations.user'));
  }.property('content.relations.user'),
  transformedBadgeTable: function() {
    return transformedRelTable(this.get('content.relations.badge'), Badge);
  }.property('content.relations.badge'),
  transformedPostTable: function() {
    return transformedRelTable(this.get('content.relations.post'));
  }.property('content.relations.post'),
  transformedTopicTable: function() {
    return transformedRelTable(this.get('content.relations.topic'));
  }.property('content.relations.topic'),

  transformedGroupTable: function() {
    return transformedRelTable(this.get('site.groups'));
  }.property('site.groups'),

  lookupUser(id) {
    return this.get('transformedUserTable')[id];
  },
  lookupBadge(id) {
    return this.get('transformedBadgeTable')[id];
  },
  lookupPost(id) {
    return this.get('transformedPostTable')[id];
  },
  lookupTopic(id) {
    return this.get('transformedTopicTable')[id];
  },
  lookupGroup(id) {
    return this.get('transformedGroupTable')[id];
  },

  lookupCategory(id) {
    return this.site.get('categoriesById')[id];
  },

  downloadResult(format) {
    // Create a frame to submit the form in (?)
    // to avoid leaving an about:blank behind
    let windowName = randomIdShort();
    const newWindowContents = "<style>body{font-size:36px;display:flex;justify-content:center;align-items:center;}</style><body>Click anywhere to close this window once the download finishes.<script>window.onclick=function(){window.close()};</script>";

    window.open('data:text/html;base64,' + btoa(newWindowContents), windowName);

    let form = document.createElement("form");
    form.setAttribute('id', 'query-download-result');
    form.setAttribute('method', 'post');
    form.setAttribute('action', Discourse.getURL('/admin/plugins/explorer/queries/' + this.get('query.id') + '/run.' + format + '?download=1'));
    form.setAttribute('target', windowName);
    form.setAttribute('style', 'display:none;');

    function addInput(name, value) {
      let field;
      field = document.createElement('input');
      field.setAttribute('name', name);
      field.setAttribute('value', value);
      form.appendChild(field);
    }

    addInput('params', JSON.stringify(this.get('params')));
    addInput('explain', this.get('hasExplain'));
    addInput('limit', '1000000');

    ajax('/session/csrf.json').then(function(csrf) {
      addInput('authenticity_token', csrf.csrf);

      document.body.appendChild(form);
      form.submit();
      Em.run.next('afterRender', function() {
        document.body.removeChild(form);
      });
    });
  },

  actions: {
    downloadResultJson() {
      this.downloadResult('json');
    },
    downloadResultCsv() {
      this.downloadResult('csv');
    }
  }

});

export default QueryResultComponent;
