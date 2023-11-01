import Component from "@glimmer/component";
import FullscreenCodeModal from "discourse/components/modal/fullscreen-code";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";
import { cached } from "@glimmer/tracking";

export default class Json extends Component {
  @service dialog;
  @service modal;

  @cached
  get parsedJson() {
    try {
      return JSON.parse(this.args.ctx.value);
    } catch {
      return null;
    }
  }

  @action
  viewJson() {
    this.modal.show(FullscreenCodeModal, {
      model: {
        code: this.parsedJson
          ? JSON.stringify(this.parsedJson, null, 2)
          : this.args.ctx.value,
        codeClasses: "",
      },
    });
  }
}
