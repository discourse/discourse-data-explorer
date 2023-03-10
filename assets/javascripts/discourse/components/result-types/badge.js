import Component from "@glimmer/component";
import { isEmpty } from "@ember/utils";
import { htmlSafe } from "@ember/template";
import { convertIconClass, iconHTML } from "discourse-common/lib/icon-library";

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
