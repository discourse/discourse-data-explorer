import { categoryLinkHTML } from "discourse/helpers/category-link";
import { autoUpdatingRelativeAge } from "discourse/lib/formatter";
import { iconHTML, convertIconClass } from "discourse-common/lib/icon-library";

function icon_or_image_replacement(str, ctx) {
  str = Ember.get(ctx.contexts[0], str);
  if (Ember.isEmpty(str)) {
    return "";
  }

  if (str.indexOf("fa-") > -1) {
    const icon = iconHTML(convertIconClass(str));
    return new Handlebars.SafeString(icon);
  } else {
    return new Handlebars.SafeString("<img src='" + str + "'>");
  }
}

function category_badge_replacement(str, ctx) {
  const category = Ember.get(ctx.contexts[0], str);
  return categoryLinkHTML(category, {
    allowUncategorized: true
  });
}

function bound_date_replacement(str, ctx) {
  const value = Ember.get(ctx.contexts[0], str);
  return new Handlebars.SafeString(
    autoUpdatingRelativeAge(new Date(value), { title: true })
  );
}

const esc = Handlebars.Utils.escapeExpression;

// consider moving this elsewhere
function guessUrl(t) {
  let [dest, name] = [t, t];

  const split = t.split(/,(.+)/);

  if (split.length > 1) {
    name = split[0];
    dest = split[1];
  }

  return [dest, name];
}

const QueryRowContentComponent = Ember.Component.extend({
  tagName: "tr",
  rowContents: null,

  didReceiveAttrs() {
    const row = this.row;
    const parentView = this.parentView;
    const fallback = this.fallbackTemplate;
    const helpers = {
      "icon-or-image": icon_or_image_replacement,
      "category-link": category_badge_replacement,
      reltime: bound_date_replacement
    };

    const parts = this.columnTemplates.map((t, idx) => {
      const value = row[idx],
        id = parseInt(value, 10);

      const ctx = {
        value,
        id,
        baseuri: Discourse.BaseUri === "/" ? "" : Discourse.BaseUri
      };
      const params = {};

      if (row[idx] === null) {
        return "NULL";
      } else if (t.name === "text") {
        return esc(row[idx]);
      }

      const lookupFunc = parentView[`lookup${t.name.capitalize()}`];
      if (lookupFunc) {
        ctx[t.name] = parentView[`lookup${t.name.capitalize()}`](id);
      }

      if (t.name === "url") {
        let [url, name] = guessUrl(value);
        ctx["href"] = url;
        ctx["target"] = name;
      }

      if (t.name === "category" || t.name === "badge" || t.name === "reltime") {
        // only replace helpers if needed
        params.helpers = helpers;
      }

      try {
        return new Handlebars.SafeString((t.template || fallback)(ctx, params));
      } catch (e) {
        return "error";
      }
    });

    this.set("rowContents", `<td>${parts.join("</td><td>")}</td>`.htmlSafe());
  }
});

export default QueryRowContentComponent;
