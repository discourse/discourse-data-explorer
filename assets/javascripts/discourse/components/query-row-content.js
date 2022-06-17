import Component from "@ember/component";
import { categoryLinkHTML } from "discourse/helpers/category-link";
import { autoUpdatingRelativeAge } from "discourse/lib/formatter";
import { convertIconClass, iconHTML } from "discourse-common/lib/icon-library";
import getURL from "discourse-common/lib/get-url";
import { capitalize } from "@ember/string";
import { htmlSafe } from "@ember/template";
import { get } from "@ember/object";
import { isEmpty } from "@ember/utils";
import { escapeExpression } from "discourse/lib/utilities";

function icon_or_image_replacement(str, ctx) {
  str = get(ctx.contexts[0], str);
  if (isEmpty(str)) {
    return "";
  }

  if (str.indexOf("fa-") > -1) {
    const icon = iconHTML(convertIconClass(str));
    return htmlSafe(icon);
  } else {
    return htmlSafe("<img src='" + str + "'>");
  }
}

function category_badge_replacement(str, ctx) {
  const category = get(ctx.contexts[0], str);
  return categoryLinkHTML(category, {
    allowUncategorized: true,
  });
}

function bound_date_replacement(str, ctx) {
  const value = get(ctx.contexts[0], str);
  return htmlSafe(autoUpdatingRelativeAge(new Date(value), { title: true }));
}

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

const QueryRowContentComponent = Component.extend({
  tagName: "tr",
  rowContents: null,

  didReceiveAttrs() {
    const row = this.row;
    const parentView = this.parentView;
    const fallback = this.fallbackTemplate;
    const helpers = {
      "icon-or-image": icon_or_image_replacement,
      "category-link": category_badge_replacement,
      reltime: bound_date_replacement,
    };

    const parts = this.columnTemplates.map((t, idx) => {
      const value = row[idx],
        id = parseInt(value, 10);

      const ctx = {
        value,
        id,
        baseuri: getURL(""),
      };
      const params = {};

      if (row[idx] === null) {
        return "NULL";
      } else if (t.name === "text") {
        return escapeExpression(row[idx]);
      }

      const lookupFunc = parentView[`lookup${capitalize(t.name)}`];
      if (lookupFunc) {
        ctx[t.name] = lookupFunc.call(parentView, id);
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
        return htmlSafe((t.template || fallback)(ctx, params));
      } catch (e) {
        return "error";
      }
    });

    this.set("rowContents", htmlSafe(`<td>${parts.join("</td><td>")}</td>`));
  },
});

export default QueryRowContentComponent;
