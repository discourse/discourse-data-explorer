import Component from "@glimmer/component";
import { categoryLinkHTML } from "discourse/helpers/category-link";
import { autoUpdatingRelativeAge } from "discourse/lib/formatter";
import { convertIconClass, iconHTML } from "discourse-common/lib/icon-library";
import getURL from "discourse-common/lib/get-url";
import { capitalize } from "@ember/string";
import { htmlSafe } from "@ember/template";
import { get } from "@ember/object";
import { isEmpty } from "@ember/utils";
import { escapeExpression } from "discourse/lib/utilities";

export default class QueryRowContent extends Component {
  constructor() {
    super(...arguments);

    const helpers = {
      "icon-or-image": icon_or_image_replacement,
      "category-link": category_badge_replacement,
      reltime: bound_date_replacement,
    };

    this.results = this.args.columnTemplates.map((t, idx) => {
      const value = this.args.row[idx],
        id = parseInt(value, 10);

      const ctx = {
        value,
        id,
        baseuri: getURL(""),
      };
      const params = {};

      if (this.args.row[idx] === null) {
        return "NULL";
      } else if (t.name === "text") {
        return escapeExpression(this.args.row[idx]);
      }
      const lookupFunc = this.args[`lookup${capitalize(t.name)}`];
      if (lookupFunc) {
        ctx[t.name] = lookupFunc.call(this.args, id);
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
        return htmlSafe(
          (t.template || this.args.fallbackTemplate)(ctx, params)
        );
      } catch (e) {
        return "error";
      }
    });
  }
}

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

function guessUrl(t) {
  let [dest, name] = [t, t];

  const split = t.split(/,(.+)/);

  if (split.length > 1) {
    name = split[0];
    dest = split[1];
  }

  return [dest, name];
}
