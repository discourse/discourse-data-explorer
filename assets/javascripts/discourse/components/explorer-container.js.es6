import { observes } from "discourse-common/utils/decorators";

export default Ember.Component.extend({
  @observes("hideSchema")
  _onHideSchema() {
    this.appEvents.trigger("ace:resize");
  },

  @observes("everEditing")
  _onInsertEditor() {
    Ember.run.schedule("afterRender", this, () => this._bindControls());
  },

  _bindControls() {
    if (this._state !== "inDOM") {
      return;
    }
    const $editPane = $(".query-editor");
    if (!$editPane.length) {
      return;
    }

    const oldGrippie = this.grippie;
    if (oldGrippie) {
      oldGrippie.off("mousedown mousemove mouseup");
    }

    const $grippie = $editPane.find(".grippie");
    const $target = $editPane.find(".panels-flex");
    const $document = $(document);

    const minWidth = $target.width();
    const minHeight = $target.height();

    this.set("grippie", $grippie);

    const mousemove = e => {
      const diffY = this.startY - e.screenY;
      const diffX = this.startX - e.screenX;

      const newHeight = Math.max(minHeight, this.startHeight - diffY);
      const newWidth = Math.max(minWidth, this.startWidth - diffX);

      $target.height(newHeight);
      $target.width(newWidth);
      $grippie.width(newWidth);
      this.appEvents.trigger("ace:resize");
    };

    const throttledMousemove = (event => {
      event.preventDefault();
      Ember.run.throttle(this, mousemove, event, 20);
    }).bind(this);

    const mouseup = (() => {
      $document.off("mousemove", throttledMousemove);
      $document.off("mouseup", mouseup);
      this.setProperties({
        startY: null,
        startX: null,
        startHeight: null,
        startWidth: null
      });
    }).bind(this);

    $grippie.on("mousedown", e => {
      this.setProperties({
        startY: e.screenY,
        startX: e.screenX,
        startHeight: $target.height(),
        startWidth: $target.width()
      });

      $document.on("mousemove", throttledMousemove);
      $document.on("mouseup", mouseup);
      e.preventDefault();
    });
  },

  didInsertElement() {
    this._super(...arguments);

    this._bindControls();
  },

  willDestroyElement() {
    this._super(...arguments);

    if (this.everEditing) {
      this.grippie && this.grippie.off("mousedown");
      this.set("grippie", null);
    }
  }
});
