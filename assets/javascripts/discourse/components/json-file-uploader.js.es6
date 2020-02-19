import {
  default as computed,
  on,
  observes
} from "discourse-common/utils/decorators";

export default Ember.Component.extend({
  fileInput: null,
  loading: false,
  expectedRootObjectName: null,
  hover: 0,

  classNames: ["json-uploader"],

  @on("didInsertElement")
  _initialize() {
    const $this = $(this.element);
    const fileInput = this.element.querySelector("#js-file-input");
    this.set("fileInput", fileInput);

    $(fileInput).on("change", () => this.fileSelected(fileInput.files));

    $this.on("dragover", e => {
      if (e.preventDefault) e.preventDefault();
      return false;
    });
    $this.on("dragenter", e => {
      if (e.preventDefault) e.preventDefault();
      this.set("hover", this.hover + 1);
      return false;
    });
    $this.on("dragleave", e => {
      if (e.preventDefault) e.preventDefault();
      this.set("hover", this.hover - 1);
      return false;
    });
    $this.on("drop", e => {
      if (e.preventDefault) e.preventDefault();

      this.set("hover", 0);
      this.fileSelected(e.dataTransfer.files);
      return false;
    });
  },

  @computed("extension")
  accept(extension) {
    return (
      ".json,application/json,application/x-javascript,text/json" +
      (extension ? `,${extension}` : "")
    );
  },

  @observes("destination", "expectedRootObjectName")
  setReady() {
    let parsed;
    try {
      parsed = JSON.parse(this.value);
    } catch (e) {
      this.set("ready", false);
      return;
    }

    const rootObject = parsed[this.expectedRootObjectName];

    if (rootObject !== null && rootObject !== undefined) {
      this.set("ready", true);
    } else {
      this.set("ready", false);
    }
  },

  actions: {
    selectFile() {
      $(this.fileInput).click();
    }
  },

  fileSelected(fileList) {
    let files = [];
    for (let i = 0; i < fileList.length; i++) {
      files[i] = fileList[i];
    }
    const fileNameRegex = /\.(json|txt)$/;
    files = files.filter(file => {
      if (fileNameRegex.test(file.name)) {
        return true;
      }
      if (file.type === "text/plain") {
        return true;
      }
      return false;
    });
    const firstFile = fileList[0];

    this.set("loading", true);

    const reader = new FileReader();
    reader.onload = evt => {
      this.setProperties({ value: evt.target.result, loading: false });
    };

    reader.readAsText(firstFile);
  }
});
