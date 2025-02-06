import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { bind } from "discourse/lib/decorators";

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
