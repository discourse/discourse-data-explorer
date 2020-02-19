import { default as computed, on } from "discourse-common/utils/decorators";

export default Ember.Component.extend({
  classNames: ["share-report"],

  group: null,
  query: null,
  visible: false,

  @computed("group", "query")
  link() {
    return Discourse.BaseUrl + "/g/" + this.group + "/reports/" + this.query.id;
  },

  _mouseDownHandler(event) {
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }
    if ($(this.element).has(event.target).length !== 0) {
      return;
    }

    this.send("close");

    return true;
  },

  _keydownHandler(event) {
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }

    if (event.keyCode === 27) {
      this.send("close");
    }
  },

  @on("init")
  _setupHandlers() {
    this._boundMouseDownHandler = Ember.run.bind(this, this._mouseDownHandler);
    this._boundKeydownHandler = Ember.run.bind(this, this._keydownHandler);
  },

  didInsertElement() {
    this._super(...arguments);

    $("html")
      .on("mousedown.outside-share-link", this._boundMouseDownHandler)
      .on("keydown.share-view", this._boundKeydownHandler);
  },

  willDestroyElement() {
    this._super(...arguments);

    $("html")
      .off("mousedown.outside-share-link", this._boundMouseDownHandler)
      .off("keydown.share-view", this._boundKeydownHandler);
  },

  actions: {
    open() {
      this.set("visible", true);
      window.setTimeout(
        () =>
          $(this.element)
            .find("input")
            .select()
            .focus(),
        160
      );
    },

    close() {
      this.set("visible", false);
    }
  }
});
