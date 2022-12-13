import Component from "@glimmer/component";
import getURL from "discourse-common/lib/get-url";
import { bind } from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";

export default class ShareReport extends Component {
  @tracked visible = false;
  element;

  get link() {
    return getURL(`/g/${this.args.group}/reports/${this.args.query.id}`);
  }

  @bind
  mouseDownHandler(e) {
    if (!this.element.contains(e.target)) {
      this.close();
    }
  }

  @bind
  keyDownHandler(e) {
    if (e.keyCode === 27) {
      this.close();
    }
  }

  @action
  registerListeners(element) {
    if (!element || this.isDestroying || this.isDestroyed) {
      return;
    }

    this.element = element;
    document.addEventListener("mousedown", this.mouseDownHandler);
    element.addEventListener("keydown", this.keyDownHandler);
  }

  @action
  unregisterListeners(element) {
    this.element = element;
    document.removeEventListener("mousedown", this.mouseDownHandler);
    element.removeEventListener("keydown", this.keyDownHandler);
  }

  @action
  focusInput(e) {
    e.select();
    e.focus();
  }

  @action
  open() {
    this.visible = true;
  }

  @action
  close() {
    this.visible = false;
  }
}
