const layoutMap = {
  int: 'int',
  bigint: 'int',
  boolean: 'boolean',
  string: 'generic',
  time: 'generic',
  date: 'generic',
  datetime: 'generic',
  double: 'string',
  inet: 'generic',
  user_id: 'user_id',
  post_id: 'string',
  topic_id: 'int',
  category_id: 'int',
  group_id: 'int',
  badge_id: 'int',
  int_list: 'generic',
  string_list: 'generic'
};

function allowsInputTypeTime() {
  try {
    const inp = document.createElement('input');
    inp.attributes.type = 'time';
    inp.attributes.type = 'date';
    return true;
  } catch (e) {
    return false;
  }
}

export default Ember.Component.extend({

  classNameBindings: ['valid:valid:invalid', ':param'],

  boolTypes: [ {name: I18n.t('explorer.types.bool.true'), id: 'Y'}, {name: I18n.t('explorer.types.bool.false'), id: 'N'}, {name: I18n.t('explorer.types.bool.null_'), id: '#null'} ],

  value: function(key, value, previousValue) {
    if (arguments.length > 1) {
      this.get('params')[this.get('info.identifier')] = value.toString();
    }
    return this.get('params')[this.get('info.identifier')];
  }.property('params', 'pname'),

  valid: function() {
    const type = this.get('info.type'),
      value = this.get('value');

    if (Em.isEmpty(this.get('value'))) {
      return this.get('info.nullable');
    }

    function matches(regex) {
      return regex.test(value);
    }

    const intVal = parseInt(value, 10);
    const intValid = !isNaN(intVal) && intVal < 2147483648 && intVal > -2147483649;
    switch (type) {
      case 'int':
        return /^-?\d+$/.test(value) && intValid;
      case 'bigint':
        return /^-?\d+$/.test(value) && !isNaN(intVal);
      case 'boolean':
        return /^Y|N|#null|true|false/.test(value);
      case 'double':
        return !isNaN(parseFloat(value));
      case 'int_list':
        return value.split(',').every(function(i) {
          return /^(-?\d+|null)$/.test(i.trim());
        });
      case 'post_id':
        return /^\d+$/.test(value) || /\d+\/\d+(\?u=.*)?$/.test(value);
    }
    return true;
  }.property('value', 'info.type', 'info.nullable'),

  layoutType: function() {
    const type = this.get('info.type');
    if ((type === "time" || type === "date") && !allowsInputTypeTime()) {
      return "string";
    }
    if (layoutMap[type]) {
      return layoutMap[type];
    }
    return type;
  }.property('info.type'),

  layoutName: function() {
    return "admin/components/q-params/" + this.get('layoutType');
  }.property('layoutType')
});
