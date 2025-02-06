import Component from "@glimmer/component";
import { htmlSafe } from "@ember/template";
import { isEmpty } from "@ember/utils";
import { convertIconClass, iconHTML } from "discourse/lib/icon-library";

export default class Badge extends Component {
  get iconOrImageReplacement() {
    if (isEmpty(this.args.ctx.badge.icon)) {
      return "";
    }

    if (this.args.ctx.badge.icon.indexOf("fa-") > -1) {
      const icon = iconHTML(convertIconClass(this.args.ctx.badge.icon));
      return htmlSafe(icon);
    } else {
      return htmlSafe("<img src='" + this.args.ctx.badge.icon + "'>");
    }
  }
}
