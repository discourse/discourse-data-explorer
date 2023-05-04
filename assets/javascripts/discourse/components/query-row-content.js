import Component from "@glimmer/component";
import getURL from "discourse-common/lib/get-url";
import { capitalize } from "@ember/string";
import { escapeExpression } from "discourse/lib/utilities";
import { cached } from "@glimmer/tracking";
import TextViewComponent from "./result-types/text";

export default class QueryRowContent extends Component {
  @cached
  get results() {
    return this.args.columnComponents.map((t, idx) => {
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
          textValue: escapeExpression(this.args.row[idx].toString()),
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

      try {
        return {
          component: t.component || TextViewComponent,
          ctx,
        };
      } catch (e) {
        return "error";
      }
    });
  }
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
