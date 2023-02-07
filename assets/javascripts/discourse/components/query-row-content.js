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
import { cached } from "@glimmer/tracking";
import TextViewComponent from "./result-types/text";

export default class QueryRowContent extends Component {
  constructor() {
    super(...arguments);

    this.helpers = {
      "icon-or-image": icon_or_image_replacement,
      "category-link": category_badge_replacement,
      reltime: bound_date_replacement,
    };
  }

  @cached
  get results() {
    return this.args.columnComponents.map((t, idx) => {
      const params = {};
      const value = this.args.row[idx],
        id = parseInt(value, 10);

      const ctx = {
        value,
        id,
        baseuri: getURL(""),
      };

      if (this.args.row[idx] === null) {
        return {
          component: TextViewComponent,
          textValue: "NULL",
        };
      } else if (t.name === "text") {
        return {
          component: TextViewComponent,
          textValue: escapeExpression(this.args.row[idx]),
        };
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
        params.helpers = this.helpers;
      }

      try {
        return {
          component: t.component || TextViewComponent,
          ctx,
          params,
        };
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
