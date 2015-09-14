
function icon_or_image_replacement(str, ctx) {
  str = Ember.get(ctx.contexts[0], str);
  if (Ember.isEmpty(str)) { return ""; }

  if (str.indexOf('fa-') === 0) {
    return new Handlebars.SafeString("<i class='fa " + str + "'></i>");
  } else {
    return new Handlebars.SafeString("<img src='" + str + "'>");
  }
}

function shorthandTinyAvatar(avatar_template, ctx) {
  return new Handlebars.SafeString(Discourse.Utilities.avatarImg({
    size: "tiny",
    extraClasses: '',
    avatarTemplate: avatar_template
  }));
}

const esc = Handlebars.Utils.escapeExpression;

const QueryRowContentComponent = Ember.Component.extend({
  tagName: "tr",

  render: function(buffer) {
    const self = this;
    const row = this.get('row');
    const parent = self.get('parent');
    const fallback = parent.get('fallbackTemplate');

    const parts = this.get('columnTemplates').map(function(t, idx) {
      const ctx = {};
      const params = {}
      if (t.name === "text") {
        return esc(row[idx]);
      } else if (t.name === "user") {
        ctx.user = parent.lookupUser(parseInt(row[idx]));
        if (!ctx.user) {
          return esc(row[idx]);
        }
      } else if (t.name === "badge") {
        ctx.badge = parent.lookupBadge(parseInt(row[idx]));
        params.helpers = {"icon-or-image": icon_or_image_replacement};
      } else if (t.name === "post") {
        ctx.post = parent.lookupPost(parseInt(row[idx]));
        params.helpers = {avatar: shorthandTinyAvatar};
      } else {
        ctx.value = row[idx];
      }

      return new Handlebars.SafeString((t.template || fallback)(ctx, params));
    });

    buffer.push("<td>" + parts.join("</td><td>") + "</td>");
  }
});

export default QueryRowContentComponent;
