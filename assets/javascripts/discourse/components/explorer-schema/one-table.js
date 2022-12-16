import Component from "@glimmer/component";
import { bind } from "discourse-common/utils/decorators";
import { tracked } from "@glimmer/tracking";

export default class ExplorerSchemaOneTable extends Component {
  @tracked open = this.args.table.open;

  get styles() {
    return this.open ? "open" : "";
  }

  @bind
  setTableOpen(value) {
    event.preventDefault();
    this.open = !value;
  }
}
