import Component from "@glimmer/component";
import { bind } from "discourse-common/utils/decorators";
import { tracked } from "@glimmer/tracking";

export default class OneTable extends Component {
  @tracked open = this.args.table.open;

  get styles() {
    return this.open ? "open" : "";
  }

  @bind
  toggleOpen() {
    this.open = !this.open;
  }
}
