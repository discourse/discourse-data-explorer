import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { bind } from "discourse/lib/decorators";
import getURL from "discourse/lib/get-url";

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
  open(e) {
    e.preventDefault();
    this.visible = true;
  }

  @action
  close() {
    this.visible = false;
  }
}
