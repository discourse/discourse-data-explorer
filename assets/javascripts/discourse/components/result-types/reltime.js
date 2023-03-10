import Component from "@glimmer/component";
import { autoUpdatingRelativeAge } from "discourse/lib/formatter";
import { htmlSafe } from "@ember/template";

export default class Reltime extends Component {
  get boundDateReplacement() {
    return htmlSafe(
      autoUpdatingRelativeAge(new Date(this.args.ctx.value), { title: true })
    );
  }
}
